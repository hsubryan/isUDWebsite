import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCachedScoringLibrary } from '@/lib/libraryCache';
import { calculateProjectScore } from '@/lib/scoring';
import { sortChecklistHierarchy } from '@/lib/naturalSort';
import { isProjectEditable } from '@/lib/projectEditability';

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
        facilityUses: {
          where: { archivedAt: null },
        },
        responses: true,
        sectionToggles: true,
        teamMembers: {
          where: { userId },
        },
        submissions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            editAccessStatus: true,
            editAccessRequestedAt: true,
            editAccessGrantedAt: true,
            reviewNote: true,
            rejectedAt: true,
            approvedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Determine current user's role
    // Default to ADMIN if they are the Project.userId (owner)
    const membership = project.teamMembers[0];
    const userRole = systemRole === 'ADMIN' || project.userId === userId ? 'ADMIN' : (membership?.permission || 'VIEWER');

    // Calculate scores using universal utility (cached library)
    const chapters = sortChecklistHierarchy(await getCachedScoringLibrary());

    const scores = calculateProjectScore(
      chapters || [],
      project.responses || [],
      project.sectionToggles || []
    );

    // Group scores for display
    const legacyChapterApplicable = project.legacyChapterApplicable
      ?.split(',')
      .map((value) => Number(value.trim()));
    const legacyChapterEarned = project.legacyChapterEarned
      ?.split(',')
      .map((value) => Number(value.trim()));
    const hasLegacyScores = project.legacyAwardPercentage !== null;

    const formattedChapterScores = (scores.chapterScores || []).map((score, index) => {
      const chapter = chapters[index];
      const legacyApplicable = legacyChapterApplicable?.[index];
      const legacyEarned = legacyChapterEarned?.[index];
      if (!chapter) return null;
      return {
        number: chapter.number,
        title: chapter.title,
        totalCredits: hasLegacyScores && Number.isFinite(legacyApplicable)
          ? legacyApplicable
          : score.total,
        earned: hasLegacyScores && Number.isFinite(legacyEarned)
          ? legacyEarned
          : score.earned,
      };
    }).filter(Boolean);

    const totalAvailable = hasLegacyScores
      ? project.legacyApplicableCredits || 0
      : (scores.chapterScores || []).reduce((sum, ch) => sum + (ch.total || 0), 0);
    const totalEarned = hasLegacyScores ? project.legacyEarnedCredits || 0 : scores.totalScore || 0;
    const totalBonus = hasLegacyScores ? project.legacyBonusCredits || 0 : scores.totalBonus;
    const scorePercentage = hasLegacyScores
      ? project.legacyAwardPercentage || 0
      : totalAvailable > 0
        ? ((scores.totalScore + scores.totalBonus) / totalAvailable) * 100
        : 0;
    const certificationThreshold = 78;

    const { submissions, ...projectFields } = project;

    return NextResponse.json({
      ...projectFields,
      currentSubmission: submissions[0] || null,
      userRole,
      userStatus: membership?.status || 'ACTIVE', // Owners are always ACTIVE
      chapterScores: formattedChapterScores,
      totalEarned,
      totalAvailable,
      bonus: totalBonus,
      certificationStatus: {
        failedSections: scores.failedSections,
        missingMandatorySections: scores.missingMandatorySections,
        activeSectionsCount: scores.activeSectionsCount,
        scorePercentage,
        isThresholdMet: scorePercentage >= certificationThreshold,
        isQualifying: scores.activeSectionsCount >= 1,
        isMandatoryMet: scores.missingMandatorySections.length === 0,
      }
    });
  } catch (error: any) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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
    const body = await req.json();

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

    const membership = project.teamMembers[0];
    const canEdit =
      systemRole === 'ADMIN' ||
      project.userId === userId ||
      (membership?.status === 'ACTIVE' && ['ADMIN', 'EDITOR'].includes(membership.permission));

    if (!canEdit) {
      return NextResponse.json({ error: 'Unauthorized: missing edit permissions' }, { status: 403 });
    }

    if (!isProjectEditable(project.status, project.submissions[0]?.editAccessStatus)) {
      return NextResponse.json({ error: 'Project is not editable in its current status' }, { status: 409 });
    }

    const {
      projectName,
      contactName,
      contactEmail,
      telephone,
      firmName,
      ownerName,
      address1,
      address2,
      city,
      state,
      zip,
      country,
      buildingArea,
      siteArea,
      certification,
      services,
      facilityUses,
    } = body;

    if (!projectName || !contactName || !contactEmail || !telephone) {
      return NextResponse.json({ error: 'Missing mandatory fields' }, { status: 400 });
    }

    const facilityNames = Array.isArray(facilityUses) ? facilityUses : [];

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        projectName,
        contactName,
        contactEmail,
        telephone,
        firmName,
        ownerName,
        address1,
        address2,
        city,
        state,
        zip,
        country: country || 'United States',
        buildingArea,
        siteArea,
        certification: certification || 'Guided Certification',
        services: Array.isArray(services) ? services : [],
        facilityUses: {
          set: facilityNames.map((name: string) => ({ name })),
        },
      },
      include: {
        facilityUses: {
          where: { archivedAt: null },
        },
      },
    });

    const relevantSections = await prisma.section.findMany({
      where: {
        archivedAt: null,
        facilityUses: {
          some: {
            name: { in: facilityNames },
            archivedAt: null,
          },
        },
      },
      select: { id: true },
    });

    const relevantSolutions = await prisma.solution.findMany({
      where: {
        archivedAt: null,
        sectionId: { in: relevantSections.map((section) => section.id) },
      },
      select: { id: true },
    });

    if (relevantSolutions.length > 0) {
      await prisma.projectResponse.createMany({
        data: relevantSolutions.map((solution) => ({
          projectId: id,
          solutionId: solution.id,
          status: 'NOT_IMPLEMENTED',
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json(updatedProject);
  } catch (error: any) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
