import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendTeamInviteEmail } from '@/lib/teamInviteEmail';

const validPermissions = ['ADMIN', 'EDITOR', 'VIEWER'];
const validRoles = ['PROJECT_MANAGER', 'ARCHITECT', 'CONSULTANT', 'DEVELOPMENT', 'OWNERSHIP', 'HR', 'ADVOCATE'];

async function getProjectAccess(projectId: string, userId: string, systemRole?: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...(systemRole === 'ADMIN'
        ? {}
        : {
            OR: [
              { userId },
              {
                teamMembers: {
                  some: {
                    userId,
                    status: 'ACTIVE',
                  },
                },
              },
            ],
          }),
    },
    include: {
      teamMembers: {
        where: { userId },
      },
    },
  });

  if (!project) return null;

  const membership = project.teamMembers[0];
  const canEdit =
    systemRole === 'ADMIN' ||
    project.userId === userId ||
    (membership?.status === 'ACTIVE' && ['ADMIN', 'EDITOR'].includes(membership.permission));

  return { project, canEdit };
}

// GET /api/projects/[id]/team
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const userId = (session.user as any).id;
    const systemRole = (session.user as any).role;

    const access = await getProjectAccess(projectId, userId, systemRole);
    if (!access) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    const team = await prisma.teamMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(team);
  } catch (error: any) {
    console.error('Error fetching team:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/[id]/team (Invite)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const userId = (session.user as any).id;
    const systemRole = (session.user as any).role;
    const body = await req.json();
    const { email, permission, role } = body;

    const access = await getProjectAccess(projectId, userId, systemRole);
    if (!access) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }
    if (!access.canEdit) {
      return NextResponse.json({ error: 'Unauthorized: missing team edit permissions' }, { status: 403 });
    }

    if (!email || !permission || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!validPermissions.includes(permission)) {
      return NextResponse.json({ error: 'Invalid permission' }, { status: 400 });
    }
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check if user is already a member
    const existing = await prisma.teamMember.findUnique({
      where: {
        projectId_email: {
          projectId,
          email: email.toLowerCase(),
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'User is already a team member or has a pending invite' }, { status: 400 });
    }

    // Check if the invited email belongs to an existing user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    const invite = await prisma.teamMember.create({
      data: {
        projectId,
        userId: user?.id || null,
        email: email.toLowerCase(),
        permission,
        role,
        status: 'PENDING',
      },
    });

    // If the invited address has no isUD account yet, let them know by email
    // so they aren't left waiting on a notification inside a site they can't sign into.
    if (!user) {
      try {
        await sendTeamInviteEmail({
          email: email.toLowerCase(),
          inviterName: session.user.name || 'A project manager',
          projectName: access.project.projectName,
        });
      } catch (emailError) {
        console.error('[TEAM_INVITE_EMAIL_ERROR]', emailError);
      }
    }

    return NextResponse.json(invite);
  } catch (error: any) {
    console.error('Error creating invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/team (Accept/Update)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const userId = (session.user as any).id;
    const systemRole = (session.user as any).role;
    const email = session.user.email?.toLowerCase();
    const body = await req.json().catch(() => ({}));

    if (body.memberId) {
      const access = await getProjectAccess(projectId, userId, systemRole);
      if (!access) {
        return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
      }
      if (!access.canEdit) {
        return NextResponse.json({ error: 'Unauthorized: missing team edit permissions' }, { status: 403 });
      }

      const updateData: any = {};
      if (body.permission) {
        if (!validPermissions.includes(body.permission)) {
          return NextResponse.json({ error: 'Invalid permission' }, { status: 400 });
        }
        updateData.permission = body.permission;
      }
      if (body.role) {
        if (!validRoles.includes(body.role)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
        updateData.role = body.role;
      }
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
      }

      const member = await prisma.teamMember.findFirst({
        where: {
          id: body.memberId,
          projectId,
        },
      });

      if (!member) {
        return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
      }

      const updated = await prisma.teamMember.update({
        where: { id: member.id },
        data: updateData,
      });

      return NextResponse.json(updated);
    }

    if (!email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    // Find the record to update
    const member = await prisma.teamMember.findUnique({
      where: {
        projectId_email: {
          projectId,
          email,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const updated = await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        status: 'ACTIVE',
        userId, // Ensure it's linked
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const userId = (session.user as any).id;
    const systemRole = (session.user as any).role;
    const email = session.user.email?.toLowerCase();
    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 });
    }

    const member = await prisma.teamMember.findFirst({
      where: {
        id: memberId,
        projectId,
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Self-decline: a pending invitee can remove their own invitation without
    // needing team-edit permissions, since they don't have any access yet.
    const isSelfDecline = member.status === 'PENDING' && email && member.email === email;

    if (!isSelfDecline) {
      const access = await getProjectAccess(projectId, userId, systemRole);
      if (!access) {
        return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
      }
      if (!access.canEdit) {
        return NextResponse.json({ error: 'Unauthorized: missing team edit permissions' }, { status: 403 });
      }
    }

    await prisma.teamMember.delete({
      where: { id: member.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting team member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
