import { prisma } from './prisma';
import { prismaV2 } from './prisma-v2';

/**
 * Additive, one-directional sync: copies 1.0 content that has no match yet
 * into DB 2.0 (prisma-v2), and mirrors archive/restore state for content
 * this sync previously created. Never overwrites fields on an already-synced
 * 2.0 record - once a Heading/Solution exists in 2.0 it may evolve
 * independently there (percent thresholds, status, edited text, etc.).
 *
 * Matching keys:
 * - Chapter -> H1 Heading: exact title, parentId null.
 * - Section -> H2 Heading: exact title among the matched H1's children.
 * - SubSection -> H3 Heading: exact title among the matched H2's children.
 * - Solution -> Solution: v1StandardNumber === 1.0 standardNumber.
 *
 * 1.0 has no per-solution facility-use data (FacilityUse only attaches to
 * Section there), so only new H2 headings get facilityUseTypes copied (from
 * the 1.0 Section), matched by exact name; 2.0's 25 types are a different,
 * more granular set than 1.0's, so unmatched names are skipped and counted.
 * Figures aren't synced: 1.0's free-form figures don't map to 2.0's fixed
 * A-D slot model.
 */
export async function syncNewContentToDb2() {
  const summary = {
    newH2: 0,
    newH3: 0,
    newSolutions: 0,
    archivedMirrored: 0,
    restoredMirrored: 0,
    skippedChapterMismatches: [] as string[],
    skippedFacilityNames: new Set<string>(),
  };

  const chapters = await prisma.chapter.findMany({
    include: {
      sections: {
        include: {
          facilityUses: true,
          subSections: true,
          solutions: { include: { goals: true, phases: true } },
        },
      },
    },
  });

  const goals2 = await prismaV2.goal.findMany();
  const phases2 = await prismaV2.phase.findMany();
  const facilityTypes2 = await prismaV2.facilityUseType.findMany();
  const goalIdByText = new Map(goals2.map((g) => [g.text, g.id]));
  const phaseIdByName = new Map(phases2.map((p) => [p.name, p.id]));
  const facilityTypeIdByName = new Map(facilityTypes2.map((f) => [f.name, f.id]));

  for (const chapter of chapters) {
    const h1 = await prismaV2.heading.findFirst({
      where: { level: 'H1', parentId: null, title: chapter.title },
    });

    if (!h1) {
      summary.skippedChapterMismatches.push(chapter.title);
      continue;
    }

    for (const section of chapter.sections) {
      let h2 = await prismaV2.heading.findFirst({
        where: { level: 'H2', parentId: h1.id, title: section.title },
      });

      if (!h2) {
        const maxSortOrder = await prismaV2.heading.aggregate({
          where: { parentId: h1.id },
          _max: { sortOrder: true },
        });
        const facilityTypeIds: string[] = [];
        for (const facilityUse of section.facilityUses) {
          const id = facilityTypeIdByName.get(facilityUse.name);
          if (id) facilityTypeIds.push(id);
          else summary.skippedFacilityNames.add(facilityUse.name);
        }

        h2 = await prismaV2.heading.create({
          data: {
            level: 'H2',
            parentId: h1.id,
            v1Number: `${chapter.number}.${section.number}`,
            title: section.title,
            credits: section.totalCredits,
            minPoints1: section.minPoints1,
            minPoints2: section.minPoints2,
            minPoints3: section.minPoints3,
            detailedInstruction: section.detailedInstruction,
            sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
            archivedAt: section.archivedAt,
            facilityUseTypes: facilityTypeIds.length ? { connect: facilityTypeIds.map((id) => ({ id })) } : undefined,
          },
        });
        summary.newH2++;
      } else {
        await mirrorArchiveState(h2.id, section.archivedAt, summary);
      }

      // Solutions attached directly to the section (no subsection).
      for (const solution of section.solutions.filter((s) => !s.subSectionId)) {
        await syncSolution(solution, h2.id, summary, goalIdByText, phaseIdByName);
      }

      for (const subSection of section.subSections) {
        let h3 = await prismaV2.heading.findFirst({
          where: { level: 'H3', parentId: h2.id, title: subSection.title },
        });

        if (!h3) {
          const maxSortOrder = await prismaV2.heading.aggregate({
            where: { parentId: h2.id },
            _max: { sortOrder: true },
          });

          h3 = await prismaV2.heading.create({
            data: {
              level: 'H3',
              parentId: h2.id,
              v1Number: `${chapter.number}.${section.number}.${subSection.number}`,
              title: subSection.title,
              credits: subSection.totalCredits,
              minPoints1: subSection.minPoints1,
              minPoints2: subSection.minPoints2,
              minPoints3: subSection.minPoints3,
              sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
              archivedAt: subSection.archivedAt,
            },
          });
          summary.newH3++;
        } else {
          await mirrorArchiveState(h3.id, subSection.archivedAt, summary);
        }

        const subSolutions = section.solutions.filter((s) => s.subSectionId === subSection.id);
        for (const solution of subSolutions) {
          await syncSolution(solution, h3.id, summary, goalIdByText, phaseIdByName);
        }
      }
    }
  }

  return {
    ...summary,
    skippedFacilityNames: [...summary.skippedFacilityNames],
  };
}

async function mirrorArchiveState(
  headingId: string,
  archivedAt: Date | null,
  summary: { archivedMirrored: number; restoredMirrored: number }
) {
  const current = await prismaV2.heading.findUnique({ where: { id: headingId }, select: { archivedAt: true } });
  const wasArchived = Boolean(current?.archivedAt);
  const isArchived = Boolean(archivedAt);
  if (wasArchived === isArchived) return;

  await prismaV2.heading.update({ where: { id: headingId }, data: { archivedAt } });
  if (isArchived) summary.archivedMirrored++;
  else summary.restoredMirrored++;
}

async function syncSolution(
  solution: {
    id: string;
    standardNumber: string;
    text: string;
    points: number;
    isMandatory: boolean;
    instruction: string | null;
    archivedAt: Date | null;
    goals: { text: string }[];
    phases: { name: string }[];
  },
  headingId: string,
  summary: { newSolutions: number; archivedMirrored: number; restoredMirrored: number },
  goalIdByText: Map<string, string>,
  phaseIdByName: Map<string, string>
) {
  const existing = await prismaV2.solution.findFirst({ where: { v1StandardNumber: solution.standardNumber } });

  if (existing) {
    const wasArchived = Boolean(existing.archivedAt);
    const isArchived = Boolean(solution.archivedAt);
    if (wasArchived !== isArchived) {
      await prismaV2.solution.update({ where: { id: existing.id }, data: { archivedAt: solution.archivedAt } });
      if (isArchived) summary.archivedMirrored++;
      else summary.restoredMirrored++;
    }
    return;
  }

  const maxSortOrder = await prismaV2.solution.aggregate({
    where: { headingId },
    _max: { sortOrder: true },
  });

  const goalIds = solution.goals.map((g) => goalIdByText.get(g.text)).filter((id): id is string => Boolean(id));
  const phaseIds = solution.phases.map((p) => phaseIdByName.get(p.name)).filter((id): id is string => Boolean(id));

  await prismaV2.solution.create({
    data: {
      headingId,
      v1StandardNumber: solution.standardNumber,
      sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 1,
      text: solution.text,
      status: 'DRAFT',
      required: solution.isMandatory,
      points: solution.points,
      instruction: solution.instruction,
      archivedAt: solution.archivedAt,
      goals: goalIds.length ? { connect: goalIds.map((id) => ({ id })) } : undefined,
      phases: phaseIds.length ? { connect: phaseIds.map((id) => ({ id })) } : undefined,
    },
  });
  summary.newSolutions++;
}
