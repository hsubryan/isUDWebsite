import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCachedLibrary } from '@/lib/libraryCache';
import { sortChecklistHierarchy } from '@/lib/naturalSort';
import { sortPhases, sortGoals } from '@/lib/phaseGoalOrder';

export async function GET(
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

    // Check if user is the owner OR a team member with ACTIVE status
    const project = await prisma.project.findFirst({
      where: {
        id,
        ...(systemRole === 'ADMIN'
          ? {}
          : {
              OR: [
                { userId },
                { 
                  teamMembers: { 
                    some: { 
                      userId,
                      status: 'ACTIVE'
                    } 
                  } 
                }
              ]
            })
      },
      include: {
        teamMembers: {
          where: { userId },
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    const membership = project.teamMembers[0];
    const userRole = systemRole === 'ADMIN' || project.userId === userId ? 'ADMIN' : (membership?.permission || 'VIEWER');
    const userStatus = membership?.status || 'ACTIVE';

    // Fetch full hierarchy (cached), project responses/toggles, and UI matrix data in parallel
    const [rawChapters, responses, toggles, allPhases, allGoals] = await Promise.all([
      getCachedLibrary(),
      prisma.projectResponse.findMany({ where: { projectId: id } }),
      prisma.sectionToggle.findMany({ where: { projectId: id } }),
      prisma.phase.findMany({ where: { archivedAt: null } }),
      prisma.goal.findMany({ where: { archivedAt: null } }),
    ]);

    const chapters = sortChecklistHierarchy(rawChapters);

    return NextResponse.json({
      chapters,
      responses,
      toggles,
      allPhases: sortPhases(allPhases),
      allGoals: sortGoals(allGoals),
      userRole,
      userStatus,
    });
  } catch (error: any) {
    console.error('Error fetching checklist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
