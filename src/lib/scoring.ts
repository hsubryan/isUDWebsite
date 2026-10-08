import { ResponseStatus } from '@prisma/client';

export type SolutionData = {
  id: string;
  points: number;
  isMandatory: boolean;
  standardNumber: string;
  subSectionId?: string | null;
};

export type SubSectionData = {
  id: string;
  minPoints1: number;
  minPoints2: number;
  minPoints3: number;
  totalCredits: number;
};

export type SectionData = {
  id: string;
  number: string;
  totalCredits: number;
  minPoints1: number;
  minPoints2: number;
  minPoints3: number;
  solutions: SolutionData[];
  subSections?: SubSectionData[];
};

export type ChapterData = {
  id: string;
  number: string;
  totalCredits: number;
  sections: SectionData[];
};

export type ResponseData = {
  solutionId: string;
  status: ResponseStatus;
};

export type ToggleData = {
  sectionId: string;
  isEnabled: boolean;
};

const preliminaryApplicableSections = new Set([
  '2.1',
  '2.2',
  '2.3',
  '2.4',
  '3.1',
  '3.2',
  '3.3',
  '3.4',
  '3.5',
  '3.6',
  '3.7',
  '3.8',
  '3.9',
  '3.10',
  '3.11',
  '3.12',
  '4.2',
  '4.4',
  '5.1',
  '5.2',
  '5.3',
  '5.4',
  '5.5',
  '5.6',
  '5.8',
  '6.1',
  '6.3',
  '6.4',
  '6.5',
  '6.6',
  '6.7',
  '6.9',
  '6.11',
  '6.12',
  '6.13',
  '6.14',
  '6.15',
  '6.16',
  '7.1',
  '7.2',
  '7.3',
  '7.4',
  '7.5',
  '7.6',
  '7.7',
  '7.8',
  '7.9',
  '7.10',
  '7.11',
  '7.12',
  '8.1',
  '8.2',
  '8.3',
  '8.4',
  '8.5',
  '8.6',
  '9.1',
  '9.2',
  '9.3',
]);

function compareStandardNumbers(a: string, b: string) {
  const aParts = a.split('.').map((part) => Number(part));
  const bParts = b.split('.').map((part) => Number(part));
  const length = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < length; i++) {
    const aValue = aParts[i] ?? -1;
    const bValue = bParts[i] ?? -1;

    if (aValue !== bValue) return aValue - bValue;
  }

  return a.localeCompare(b);
}

function getDisplaySectionNumber(chapterNumber: string, sectionNumber: string) {
  return `${chapterNumber}.${sectionNumber}`;
}

function getRequiredDisplayNumber(standardNumber: string, fallbackSectionNumber: string) {
  const parts = standardNumber.split('.');

  if (parts.length <= 2) return standardNumber || fallbackSectionNumber;

  return parts.slice(0, -1).join('.');
}

type TierResult = { credits: number; thresholdReached: number };

/**
 * Awards credits for a tiered "N Credits: Implement X of Y" group (a section,
 * or a subsection when a section delegates its thresholds to subsections).
 * Tier N (minPointsN) awards N credits - not "half vs full" - so this
 * generalizes correctly to 1-, 2-, and 3-tier sections alike. Falls back to
 * a flat points-per-solution sum (capped at totalCredits) when no tier is
 * configured at all.
 */
function scoreTieredGroup(
  implementedCount: number,
  minPoints1: number,
  minPoints2: number,
  minPoints3: number,
  totalCredits: number,
  rawPointsEarned: number
): TierResult {
  if (minPoints3 > 0 && implementedCount >= minPoints3) {
    return { credits: Math.min(3, totalCredits), thresholdReached: minPoints3 };
  }
  if (minPoints2 > 0 && implementedCount >= minPoints2) {
    return { credits: Math.min(2, totalCredits), thresholdReached: minPoints2 };
  }
  if (minPoints1 > 0 && implementedCount >= minPoints1) {
    return { credits: Math.min(1, totalCredits), thresholdReached: minPoints1 };
  }

  const hasThresholds = minPoints1 > 0 || minPoints2 > 0 || minPoints3 > 0;
  if (hasThresholds) return { credits: 0, thresholdReached: 0 };

  return { credits: Math.min(rawPointsEarned, totalCredits), thresholdReached: 0 };
}

/**
 * Calculates scores based on isUD threshold logic
 */
export function calculateProjectScore(
  chapters: ChapterData[],
  responses: ResponseData[],
  toggles: ToggleData[] = []
) {
  const toggleMap = new Map(toggles.map((t) => [t.sectionId, t.isEnabled]));
  const responseMap = new Map(responses.map((r) => [r.solutionId, r.status]));

  let totalBonus = 0;
  const failedSections: string[] = [];
  const missingMandatorySectionsSet = new Set<string>();

  // 1 bonus credit for every 5 solutions implemented beyond a group's requirement
  function addBonus(credits: number, implementedCount: number, thresholdReached: number) {
    if (credits <= 0) return;
    const surplus = implementedCount - thresholdReached;
    if (surplus >= 5) totalBonus += Math.floor(surplus / 5);
  }

  const chapterScores = chapters.map((chapter) => {
    let chapterEarned = 0;
    let chapterAvailable = 0;

    chapter.sections.forEach((section) => {
      const isEnabled = toggleMap.get(section.id) !== false;
      if (!isEnabled) return;

      chapterAvailable += section.totalCredits;

      const implementedSolutions = section.solutions.filter(
        (sol) => responseMap.get(sol.id) === 'IMPLEMENTED'
      );
      const implementedCount = implementedSolutions.length;

      // 1. Check Mandatory Solutions
      const missingMandatory = section.solutions.filter(
        (sol) => sol.isMandatory && responseMap.get(sol.id) !== 'IMPLEMENTED'
      );
      missingMandatory.forEach((solution) => {
        missingMandatorySectionsSet.add(
          getRequiredDisplayNumber(solution.standardNumber, getDisplaySectionNumber(chapter.number, section.number))
        );
      });

      // 2. Tiered logic: some sections delegate their "N of M" thresholds down
      // to subsections instead of defining them directly (e.g. 4.1 Illumination
      // has three subsections, each worth 1 credit on its own criteria). Score
      // each such group independently, then sum - capped at the section total.
      let sectionCredits = 0;
      const subSections = section.subSections || [];

      if (subSections.length > 0) {
        const solutionsBySubSection = new Map<string, SolutionData[]>();
        const directSolutions: SolutionData[] = [];
        for (const sol of section.solutions) {
          if (sol.subSectionId) {
            const list = solutionsBySubSection.get(sol.subSectionId) || [];
            list.push(sol);
            solutionsBySubSection.set(sol.subSectionId, list);
          } else {
            directSolutions.push(sol);
          }
        }

        for (const sub of subSections) {
          const subSolutions = solutionsBySubSection.get(sub.id) || [];
          const subImplementedCount = subSolutions.filter((sol) => responseMap.get(sol.id) === 'IMPLEMENTED').length;
          const subRawPoints = subSolutions.reduce((sum, sol) => sum + (responseMap.get(sol.id) === 'IMPLEMENTED' ? sol.points : 0), 0);
          const result = scoreTieredGroup(subImplementedCount, sub.minPoints1, sub.minPoints2, sub.minPoints3, sub.totalCredits, subRawPoints);
          sectionCredits += result.credits;
          addBonus(result.credits, subImplementedCount, result.thresholdReached);
        }

        // Solutions attached to the section itself rather than a subsection -
        // score them against whatever section-level threshold remains.
        if (directSolutions.length > 0) {
          const directImplementedCount = directSolutions.filter((sol) => responseMap.get(sol.id) === 'IMPLEMENTED').length;
          const directRawPoints = directSolutions.reduce((sum, sol) => sum + (responseMap.get(sol.id) === 'IMPLEMENTED' ? sol.points : 0), 0);
          const remainingCredits = Math.max(0, section.totalCredits - sectionCredits);
          const result = scoreTieredGroup(directImplementedCount, section.minPoints1, section.minPoints2, section.minPoints3, remainingCredits, directRawPoints);
          sectionCredits += result.credits;
          addBonus(result.credits, directImplementedCount, result.thresholdReached);
        }

        sectionCredits = Math.min(sectionCredits, section.totalCredits);
      } else {
        const rawPoints = section.solutions.reduce((sum, sol) => sum + (responseMap.get(sol.id) === 'IMPLEMENTED' ? sol.points : 0), 0);
        const result = scoreTieredGroup(implementedCount, section.minPoints1, section.minPoints2, section.minPoints3, section.totalCredits, rawPoints);
        sectionCredits = result.credits;
        addBonus(result.credits, implementedCount, result.thresholdReached);
      }

      const displaySectionNumber = getDisplaySectionNumber(chapter.number, section.number);
      if (sectionCredits < 1 && preliminaryApplicableSections.has(displaySectionNumber)) {
        failedSections.push(displaySectionNumber);
      }

      chapterEarned += sectionCredits;
    });

    return {
      id: chapter.id,
      earned: Math.min(chapterEarned, chapterAvailable),
      total: chapterAvailable,
    };
  });

  const totalScore = chapterScores.reduce((sum, ch) => sum + ch.earned, 0);
  const finalBonus = Math.min(totalBonus, 10);
  const activeSectionsCount = chapters.reduce((cnt, ch) => {
    return cnt + ch.sections.filter(s => toggleMap.get(s.id) !== false).length;
  }, 0);

  return {
    chapterScores,
    totalScore,
    totalBonus: finalBonus,
    failedSections: [...new Set(failedSections)].sort(compareStandardNumbers),
    missingMandatorySections: [...missingMandatorySectionsSet].sort(compareStandardNumbers),
    activeSectionsCount,
  };
}
