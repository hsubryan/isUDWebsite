import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;
    const systemRole = (session.user as any).role;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        teamMembers: { where: { userId } },
        submissions: {
          where: { status: 'PENDING' },
          take: 1,
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const membership = project.teamMembers[0];
    const canEdit =
      systemRole === 'ADMIN' ||
      project.userId === userId ||
      (membership?.status === 'ACTIVE' && ['ADMIN', 'EDITOR'].includes(membership.permission));

    if (!canEdit) {
      return NextResponse.json({ error: 'Unauthorized: missing edit permissions' }, { status: 403 });
    }

    if (project.status !== 'IN_REVIEW') {
      return NextResponse.json({ error: 'Project is not currently under review' }, { status: 409 });
    }

    const submission = project.submissions[0];
    if (!submission) {
      return NextResponse.json({ error: 'No pending submission found for this project' }, { status: 409 });
    }

    if (submission.editAccessStatus === 'NONE') {
      await prisma.projectSubmission.update({
        where: { id: submission.id },
        data: {
          editAccessStatus: 'REQUESTED',
          editAccessRequestedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ editAccessStatus: 'REQUESTED' });
  } catch (error: any) {
    console.error('Error requesting edit access:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
