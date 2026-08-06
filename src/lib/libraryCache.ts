import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';

/**
 * Full chapter library (chapters → sections → solutions → goals/phases/figures).
 * Used by the Browse Solutions page and the Checklist API.
 * Cached for 1 hour; invalidate with revalidateTag('chapter-library') after admin edits.
 */
export const getCachedLibrary = unstable_cache(
  async () => {
    return prisma.chapter.findMany({
      where: { archivedAt: null },
      orderBy: { number: 'asc' },
      include: {
        sections: {
          where: { archivedAt: null },
          orderBy: { number: 'asc' },
          include: {
            solutions: {
              where: { archivedAt: null },
              orderBy: { standardNumber: 'asc' },
              include: {
                subSection: {
                  select: { id: true, number: true, title: true },
                },
                goals: {
                  where: { archivedAt: null },
                },
                phases: {
                  where: { archivedAt: null },
                },
                figures: {
                  where: {
                    archivedAt: null,
                    url: { not: null },
                  },
                  orderBy: { label: 'asc' },
                },
              },
            },
          },
        },
      },
    });
  },
  ['chapter-library'],
  { revalidate: 3600, tags: ['chapter-library'] }
);

/**
 * Lightweight chapter library used solely for score calculation.
 * Only fetches the fields needed by calculateProjectScore.
 * Cached for 1 hour alongside the full library.
 */
export const getCachedScoringLibrary = unstable_cache(
  async () => {
    return prisma.chapter.findMany({
      where: { archivedAt: null },
      include: {
        sections: {
          where: { archivedAt: null },
          include: {
            solutions: {
              where: { archivedAt: null },
              select: { id: true, points: true, isMandatory: true, standardNumber: true },
            },
          },
        },
      },
    });
  },
  ['chapter-scoring-library'],
  { revalidate: 3600, tags: ['chapter-library'] }
);
