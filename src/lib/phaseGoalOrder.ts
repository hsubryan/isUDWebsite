export const PHASE_ORDER = [
  'Initiate',
  'Schematic Design',
  'Design Development',
  'Specifications',
  'Operations',
];

export const GOAL_ORDER = [
  'Body Fit',
  'Comfort',
  'Awareness',
  'Understanding',
  'Wellness',
  'Social Integration',
  'Personalization',
  'Cultural Appropriateness',
];

function byFixedOrder<T>(items: T[], order: string[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const aIndex = order.indexOf(key(a));
    const bIndex = order.indexOf(key(b));
    const aRank = aIndex === -1 ? order.length : aIndex;
    const bRank = bIndex === -1 ? order.length : bIndex;
    if (aRank !== bRank) return aRank - bRank;
    return key(a).localeCompare(key(b));
  });
}

export function sortPhases<T extends { name: string }>(phases: T[]): T[] {
  return byFixedOrder(phases, PHASE_ORDER, (phase) => phase.name);
}

export function sortGoals<T extends { text: string }>(goals: T[]): T[] {
  return byFixedOrder(goals, GOAL_ORDER, (goal) => goal.text);
}

/**
 * Deep-sorts the goals/phases nested under every solution in a chapter hierarchy
 * so any UI reading solution.goals/solution.phases directly gets the canonical order.
 */
export function sortChapterGoalsPhases<
  T extends {
    sections?: Array<{
      solutions?: Array<{
        goals?: Array<{ text: string }>;
        phases?: Array<{ name: string }>;
      }>;
    }>;
  }
>(chapters: T[]): T[] {
  return chapters.map((chapter) => ({
    ...chapter,
    sections: chapter.sections?.map((section) => ({
      ...section,
      solutions: section.solutions?.map((solution) => ({
        ...solution,
        goals: solution.goals ? sortGoals(solution.goals) : solution.goals,
        phases: solution.phases ? sortPhases(solution.phases) : solution.phases,
      })),
    })),
  }));
}
