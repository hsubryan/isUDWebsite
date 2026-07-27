import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ResponseStatus } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCachedScoringLibrary } from '@/lib/libraryCache';
import { calculateProjectScore } from '@/lib/scoring';
import { isProjectEditable } from '@/lib/projectEditability';

const validResponseStatuses = new Set(Object.values(ResponseStatus));

type ResponseChange = {
  solutionId: string;
  status: ResponseStatus;
};

type ToggleChange = {
  sectionId: string;
  isEnabled: boolean;
};

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
    const { responses, toggles } = await req.json();
    const rawResponseItems = Array.isArray(responses) ? responses : [];
    const rawToggleItems = Array.isArray(toggles) ? toggles : [];

    // Check if user is the owner OR a team member with ACTIVE status and EDITOR/ADMIN permission
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        teamMembers: {
          where: { userId },
        },
        submissions: {
          where: { status: 'PENDING' },
          take: 1,
          select: { editAccessStatus: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let membership = project.teamMembers[0];

    if (!membership && session.user.email) {
      membership = await prisma.teamMember.findUnique({
        where: {
          projectId_email: {
            projectId: id,
            email: session.user.email.toLowerCase(),
          },
        },
      }) as any;
    }

    const isOwner = project.userId === userId;
    const isSystemAdmin = systemRole === 'ADMIN';
    const isEditorOrAdmin = membership?.status === 'ACTIVE' && (membership?.permission === 'EDITOR' || membership?.permission === 'ADMIN');

    if (!isSystemAdmin && !isOwner && !isEditorOrAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Read-only access or missing permissions' }, { status: 403 });
    }

    if (!isProjectEditable(project.status, project.submissions[0]?.editAccessStatus)) {
      return NextResponse.json({ error: 'Project is not editable in its current status' }, { status: 409 });
    }

    const responseMap = new Map<string, ResponseStatus>();
    for (const item of rawResponseItems) {
      if (
        !item ||
        typeof item.solutionId !== 'string' ||
        typeof item.status !== 'string' ||
        !validResponseStatuses.has(item.status as ResponseStatus)
      ) {
        return NextResponse.json({ error: 'Invalid response payload' }, { status: 400 });
      }

      responseMap.set(item.solutionId, item.status as ResponseStatus);
    }

    const toggleMap = new Map<string, boolean>();
    for (const item of rawToggleItems) {
      if (!item || typeof item.sectionId !== 'string' || typeof item.isEnabled !== 'boolean') {
        return NextResponse.json({ error: 'Invalid toggle payload' }, { status: 400 });
      }

      toggleMap.set(item.sectionId, item.isEnabled);
    }

    const responseItems: ResponseChange[] = [...responseMap.entries()].map(([solutionId, status]) => ({
      solutionId,
      status,
    }));
    const toggleItems: ToggleChange[] = [...toggleMap.entries()].map(([sectionId, isEnabled]) => ({
      sectionId,
      isEnabled,
    }));

    const responseSolutionIds = responseItems
      .map((item) => item.solutionId);
    const toggleSectionIds = toggleItems
      .map((item) => item.sectionId);

    if (responseSolutionIds.length > 0) {
      const existingSolutions = await prisma.solution.findMany({
        where: { id: { in: responseSolutionIds }, archivedAt: null },
        select: { id: true },
      });

      if (existingSolutions.length !== responseSolutionIds.length) {
        return NextResponse.json({ error: 'One or more solution IDs are invalid' }, { status: 400 });
      }
    }

    if (toggleSectionIds.length > 0) {
      const existingSections = await prisma.section.findMany({
        where: { id: { in: toggleSectionIds }, archivedAt: null },
        select: { id: true },
      });

      if (existingSections.length !== toggleSectionIds.length) {
        return NextResponse.json({ error: 'One or more section IDs are invalid' }, { status: 400 });
      }
    }

    await prisma.$transaction([
      prisma.projectResponse.deleteMany({
        where: {
          projectId: id,
          solutionId: { in: responseSolutionIds },
        },
      }),
      ...(responseItems.length > 0
        ? [
            prisma.projectResponse.createMany({
              data: responseItems.map((item) => ({
                projectId: id,
                solutionId: item.solutionId,
                status: item.status,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
      prisma.sectionToggle.deleteMany({
        where: {
          projectId: id,
          sectionId: { in: toggleSectionIds },
        },
      }),
      ...(toggleItems.length > 0
        ? [
            prisma.sectionToggle.createMany({
              data: toggleItems.map((item) => ({
                projectId: id,
                sectionId: item.sectionId,
                isEnabled: item.isEnabled,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    // 3. Recalculate Score — library is cached; responses and toggles are fetched in parallel
    const [chapters, allResponses, allToggles] = await Promise.all([
      getCachedScoringLibrary(),
      prisma.projectResponse.findMany({ where: { projectId: id } }),
      prisma.sectionToggle.findMany({ where: { projectId: id } }),
    ]);

    const { totalScore } = calculateProjectScore(chapters, allResponses, allToggles);

    // 4. Persist Project Score
    await prisma.project.update({
      where: { id },
      data: { score: totalScore },
    });

    return NextResponse.json({ success: true, score: totalScore });
  } catch (error: any) {
    console.error('Error saving responses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
