import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAdminSession } from '@/lib/adminAuth';
import { compareNumericText, sortChecklistHierarchy } from '@/lib/naturalSort';
import { prisma } from '@/lib/prisma';

type Resource = 'chapter' | 'section' | 'subSection' | 'solution' | 'figure' | 'goal' | 'phase' | 'facilityUse';
type Direction = 'up' | 'down';
type FieldOptions = { required?: boolean; max?: number };

const SHORT_TEXT_MAX = 180;
const LONG_TEXT_MAX = 8000;
const URL_MAX = 2048;

const resources = new Set<Resource>([
  'chapter',
  'section',
  'subSection',
  'solution',
  'figure',
  'goal',
  'phase',
  'facilityUse',
]);

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

const uniqueFieldMessages: Record<string, string> = {
  standardNumber: 'A solution with that standard number already exists. Choose a different standard number.',
  number: 'That number is already used by a sibling item. Choose a different number.',
  abbr: 'A goal with that abbreviation already exists. Choose a different abbreviation.',
  name: 'That name is already in use. Choose a different name.',
};

function friendlyLibraryError(error: any) {
  if (error?.code === 'P2002') {
    const target = Array.isArray(error?.meta?.target) ? error.meta.target : [];
    const field = target.find((name: string) => uniqueFieldMessages[name]);
    return field ? uniqueFieldMessages[field] : 'That value conflicts with an existing item. Please use a different value.';
  }
  return error?.message || 'Unable to update library';
}

function stringField(name: string, value: unknown, { required = false, max = SHORT_TEXT_MAX }: FieldOptions = {}) {
  const cleaned = cleanString(value);
  if (required && !cleaned) throw new Error(`${name} is required`);
  if (cleaned.length > max) throw new Error(`${name} is too long`);
  return cleaned;
}

function nullableString(name: string, value: unknown, max = LONG_TEXT_MAX) {
  const cleaned = stringField(name, value, { max });
  return cleaned || null;
}

function numberValue(name: string, value: unknown, { required = false } = {}) {
  if ((value === undefined || value === null || value === '') && !required) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  if (parsed < 0 || parsed > 10000) throw new Error(`${name} is out of range`);
  return parsed;
}

function booleanValue(value: unknown) {
  return value === true;
}

function requireResource(value: unknown): Resource {
  if (!resources.has(value as Resource)) {
    throw new Error('Invalid resource');
  }
  return value as Resource;
}

function idArray(value: unknown, name: string) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 200 || !value.every((id) => typeof id === 'string' && id.length <= 80)) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

function figureUrl(value: unknown) {
  const url = nullableString('Figure URL', value, URL_MAX);
  if (!url) return null;
  if (url.startsWith('data:image/')) {
    throw new Error('Inline image data is not allowed. Upload figures through the image picker.');
  }
  if (url.startsWith('/figures/') || url.startsWith('https://')) return url;
  throw new Error('Figure URL must be an https URL or a /figures/ path');
}

function archivedWhere(showArchived: boolean) {
  return showArchived ? {} : { archivedAt: null };
}

// "Show archived" is a filter to review what's been archived, not a toggle
// to mix archived items back in with active ones.
function archivedOnlyWhere(showArchived: boolean) {
  return showArchived ? { archivedAt: { not: null } } : { archivedAt: null };
}

async function getLibrary(showArchived: boolean) {
  const chapters = sortChecklistHierarchy(await prisma.chapter.findMany({
    where: archivedWhere(showArchived),
    include: {
      sections: {
        where: archivedWhere(showArchived),
        include: {
          facilityUses: {
            where: archivedWhere(showArchived),
            orderBy: { name: 'asc' },
          },
          subSections: {
            where: archivedWhere(showArchived),
            orderBy: { number: 'asc' },
          },
          solutions: {
            where: archivedOnlyWhere(showArchived),
            include: {
              goals: {
                where: archivedWhere(showArchived),
                orderBy: { text: 'asc' },
              },
              phases: {
                where: archivedWhere(showArchived),
                orderBy: { name: 'asc' },
              },
              figures: {
                where: archivedWhere(showArchived),
                orderBy: { label: 'asc' },
              },
            },
          },
        },
      },
    },
  }));

  const [goals, phases, facilityUses] = await Promise.all([
    prisma.goal.findMany({ where: archivedWhere(showArchived), orderBy: { text: 'asc' } }),
    prisma.phase.findMany({ where: archivedWhere(showArchived), orderBy: { name: 'asc' } }),
    prisma.facilityUse.findMany({ where: archivedWhere(showArchived), orderBy: { name: 'asc' } }),
  ]);

  return { chapters, goals, phases, facilityUses };
}

export async function GET(req: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const showArchived = new URL(req.url).searchParams.get('showArchived') === 'true';
  return NextResponse.json(await getLibrary(showArchived));
}

async function createResource(resource: Resource, data: any) {
  switch (resource) {
    case 'chapter':
      return prisma.chapter.create({
        data: {
          number: stringField('Chapter number', data.number, { required: true, max: 40 }),
          title: stringField('Chapter title', data.title, { required: true, max: 240 }),
          totalCredits: numberValue('Total credits', data.totalCredits),
        },
      });
    case 'section': {
      const facilityUseIds = idArray(data.facilityUseIds, 'Facility uses');
      return prisma.section.create({
        data: {
          chapterId: stringField('Chapter', data.chapterId, { required: true, max: 80 }),
          number: stringField('Section number', data.number, { required: true, max: 40 }),
          title: stringField('Section title', data.title, { required: true, max: 240 }),
          totalCredits: numberValue('Total credits', data.totalCredits),
          minPoints1: Math.trunc(numberValue('Minimum points 1', data.minPoints1)),
          minPoints2: Math.trunc(numberValue('Minimum points 2', data.minPoints2)),
          minPoints3: Math.trunc(numberValue('Minimum points 3', data.minPoints3)),
          detailedInstruction: nullableString('Detailed instruction', data.detailedInstruction),
          facilityUses: facilityUseIds
            ? { connect: facilityUseIds.map((id: string) => ({ id })) }
            : undefined,
        },
      });
    }
    case 'subSection':
      return prisma.subSection.create({
        data: {
          sectionId: stringField('Section', data.sectionId, { required: true, max: 80 }),
          number: stringField('Subsection number', data.number, { required: true, max: 40 }),
          title: stringField('Subsection title', data.title, { required: true, max: 240 }),
          totalCredits: numberValue('Total credits', data.totalCredits),
        },
      });
    case 'solution': {
      const goalIds = idArray(data.goalIds, 'Goals');
      const phaseIds = idArray(data.phaseIds, 'Phases');
      return prisma.solution.create({
        data: {
          sectionId: stringField('Section', data.sectionId, { required: true, max: 80 }),
          subSectionId: nullableString('Subsection', data.subSectionId, 80),
          refId: stringField('Reference ID', data.refId, { required: true, max: 80 }),
          standardNumber: stringField('Standard number', data.standardNumber, { required: true, max: 80 }),
          text: stringField('Solution text', data.text, { required: true, max: LONG_TEXT_MAX }),
          points: numberValue('Points', data.points),
          isMandatory: booleanValue(data.isMandatory),
          instruction: nullableString('Instruction', data.instruction),
          goals: goalIds ? { connect: goalIds.map((id: string) => ({ id })) } : undefined,
          phases: phaseIds ? { connect: phaseIds.map((id: string) => ({ id })) } : undefined,
        },
      });
    }
    case 'figure':
      return prisma.figure.create({
        data: {
          solutionId: stringField('Solution', data.solutionId, { required: true, max: 80 }),
          label: stringField('Figure label', data.label, { max: 40 }) || 'Fig',
          number: nullableString('Figure number', data.number, SHORT_TEXT_MAX),
          caption: nullableString('Figure caption', data.caption, 1000),
          altTag: nullableString('Figure alt text', data.altTag, 1000),
          url: figureUrl(data.url),
        },
      });
    case 'goal':
      return prisma.goal.create({
        data: {
          abbr: stringField('Goal abbreviation', data.abbr, { required: true, max: 40 }),
          text: stringField('Goal text', data.text, { required: true, max: 500 }),
        },
      });
    case 'phase':
      return prisma.phase.create({ data: { name: stringField('Phase name', data.name, { required: true, max: 160 }) } });
    case 'facilityUse':
      return prisma.facilityUse.create({ data: { name: stringField('Facility use name', data.name, { required: true, max: 160 }) } });
  }
}

async function updateResource(resource: Resource, id: string, data: any) {
  switch (resource) {
    case 'chapter':
      return prisma.chapter.update({
        where: { id },
        data: {
          number: stringField('Chapter number', data.number, { required: true, max: 40 }),
          title: stringField('Chapter title', data.title, { required: true, max: 240 }),
          totalCredits: numberValue('Total credits', data.totalCredits),
        },
      });
    case 'section': {
      const facilityUseIds = idArray(data.facilityUseIds, 'Facility uses');
      return prisma.section.update({
        where: { id },
        data: {
          chapterId: stringField('Chapter', data.chapterId, { required: true, max: 80 }),
          number: stringField('Section number', data.number, { required: true, max: 40 }),
          title: stringField('Section title', data.title, { required: true, max: 240 }),
          totalCredits: numberValue('Total credits', data.totalCredits),
          minPoints1: Math.trunc(numberValue('Minimum points 1', data.minPoints1)),
          minPoints2: Math.trunc(numberValue('Minimum points 2', data.minPoints2)),
          minPoints3: Math.trunc(numberValue('Minimum points 3', data.minPoints3)),
          detailedInstruction: nullableString('Detailed instruction', data.detailedInstruction),
          facilityUses: facilityUseIds
            ? { set: facilityUseIds.map((facilityUseId: string) => ({ id: facilityUseId })) }
            : undefined,
        },
      });
    }
    case 'subSection':
      return prisma.subSection.update({
        where: { id },
        data: {
          sectionId: stringField('Section', data.sectionId, { required: true, max: 80 }),
          number: stringField('Subsection number', data.number, { required: true, max: 40 }),
          title: stringField('Subsection title', data.title, { required: true, max: 240 }),
          totalCredits: numberValue('Total credits', data.totalCredits),
        },
      });
    case 'solution': {
      const goalIds = idArray(data.goalIds, 'Goals');
      const phaseIds = idArray(data.phaseIds, 'Phases');
      return prisma.solution.update({
        where: { id },
        data: {
          sectionId: stringField('Section', data.sectionId, { required: true, max: 80 }),
          subSectionId: nullableString('Subsection', data.subSectionId, 80),
          refId: stringField('Reference ID', data.refId, { required: true, max: 80 }),
          standardNumber: stringField('Standard number', data.standardNumber, { required: true, max: 80 }),
          text: stringField('Solution text', data.text, { required: true, max: LONG_TEXT_MAX }),
          points: numberValue('Points', data.points),
          isMandatory: booleanValue(data.isMandatory),
          instruction: nullableString('Instruction', data.instruction),
          goals: goalIds ? { set: goalIds.map((goalId: string) => ({ id: goalId })) } : undefined,
          phases: phaseIds ? { set: phaseIds.map((phaseId: string) => ({ id: phaseId })) } : undefined,
        },
      });
    }
    case 'figure':
      return prisma.figure.update({
        where: { id },
        data: {
          solutionId: stringField('Solution', data.solutionId, { required: true, max: 80 }),
          label: stringField('Figure label', data.label, { max: 40 }) || 'Fig',
          number: nullableString('Figure number', data.number, SHORT_TEXT_MAX),
          caption: nullableString('Figure caption', data.caption, 1000),
          altTag: nullableString('Figure alt text', data.altTag, 1000),
          url: figureUrl(data.url),
        },
      });
    case 'goal':
      return prisma.goal.update({
        where: { id },
        data: {
          abbr: stringField('Goal abbreviation', data.abbr, { required: true, max: 40 }),
          text: stringField('Goal text', data.text, { required: true, max: 500 }),
        },
      });
    case 'phase':
      return prisma.phase.update({ where: { id }, data: { name: stringField('Phase name', data.name, { required: true, max: 160 }) } });
    case 'facilityUse':
      return prisma.facilityUse.update({ where: { id }, data: { name: stringField('Facility use name', data.name, { required: true, max: 160 }) } });
  }
}

async function setArchive(resource: Resource, id: string, archived: boolean) {
  const data = { archivedAt: archived ? new Date() : null };

  switch (resource) {
    case 'chapter':
      return prisma.chapter.update({ where: { id }, data });
    case 'section':
      return prisma.section.update({ where: { id }, data });
    case 'subSection':
      return prisma.subSection.update({ where: { id }, data });
    case 'solution':
      return prisma.solution.update({ where: { id }, data });
    case 'figure':
      return prisma.figure.update({ where: { id }, data });
    case 'goal':
      return prisma.goal.update({ where: { id }, data });
    case 'phase':
      return prisma.phase.update({ where: { id }, data });
    case 'facilityUse':
      return prisma.facilityUse.update({ where: { id }, data });
  }
}

async function moveResource(resource: Resource, id: string, direction: Direction) {
  if (resource === 'chapter') {
    const current = await prisma.chapter.findUnique({ where: { id } });
    if (!current) throw new Error('Chapter not found');
    const siblings = (await prisma.chapter.findMany({ where: { archivedAt: null } }))
      .sort((a, b) => compareNumericText(a.number, b.number));
    return swapField('chapter', siblings, id, direction, 'number');
  }

  if (resource === 'section') {
    const current = await prisma.section.findUnique({ where: { id } });
    if (!current) throw new Error('Section not found');
    const siblings = (await prisma.section.findMany({ where: { chapterId: current.chapterId, archivedAt: null } }))
      .sort((a, b) => compareNumericText(a.number, b.number));
    return swapField('section', siblings, id, direction, 'number');
  }

  if (resource === 'subSection') {
    const current = await prisma.subSection.findUnique({ where: { id } });
    if (!current) throw new Error('Subsection not found');
    const siblings = (await prisma.subSection.findMany({ where: { sectionId: current.sectionId, archivedAt: null } }))
      .sort((a, b) => compareNumericText(a.number, b.number));
    return swapField('subSection', siblings, id, direction, 'number');
  }

  if (resource === 'solution') {
    const current = await prisma.solution.findUnique({ where: { id } });
    if (!current) throw new Error('Solution not found');
    const siblings = (await prisma.solution.findMany({ where: { sectionId: current.sectionId, archivedAt: null } }))
      .sort((a, b) => compareNumericText(a.standardNumber, b.standardNumber));
    return swapField('solution', siblings, id, direction, 'standardNumber');
  }

  throw new Error('This resource cannot be reordered');
}

async function swapField<T extends { id: string }>(
  resource: 'chapter' | 'section' | 'subSection' | 'solution',
  siblings: T[],
  id: string,
  direction: Direction,
  field: 'number' | 'standardNumber'
) {
  const index = siblings.findIndex((item) => item.id === id);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
    return { moved: false };
  }

  const current = siblings[index] as T & Record<typeof field, string | number>;
  const target = siblings[targetIndex] as T & Record<typeof field, string | number>;

  // The (chapterId, number)/(sectionId, number)/(standardNumber) unique indexes
  // are not deferrable, and Postgres checks them per row as a multi-row UPDATE
  // executes - so a single "CASE id WHEN ... END" statement can still hit a
  // transient collision when swapping two values that already exist. Route the
  // swap through a temp value that can't collide with a real sibling instead,
  // inside one transaction so it's still all-or-nothing.
  const tableMap = {
    chapter: '"Chapter"',
    section: '"Section"',
    subSection: '"SubSection"',
    solution: '"Solution"',
  } as const;
  const columnMap = {
    number: '"number"',
    standardNumber: '"standardNumber"',
  } as const;

  const table = tableMap[resource];
  const column = columnMap[field];
  const tempValue = `__reorder_temp_${current.id}`;

  await prisma.$transaction([
    prisma.$executeRawUnsafe(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, tempValue, current.id),
    prisma.$executeRawUnsafe(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, current[field], target.id),
    prisma.$executeRawUnsafe(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, target[field], current.id),
  ]);

  return { moved: true };
}

export async function POST(req: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const body = await req.json();
    const resource = requireResource(body.resource);
    const action = cleanString(body.action) || 'create';

    if (action === 'create') {
      const result = await createResource(resource, body.data || {});
      revalidateTag('chapter-library');
      return NextResponse.json(result, { status: 201 });
    }

    const id = cleanString(body.id);
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (action === 'archive') {
      const result = await setArchive(resource, id, true);
      revalidateTag('chapter-library');
      return NextResponse.json(result);
    }

    if (action === 'restore') {
      const result = await setArchive(resource, id, false);
      revalidateTag('chapter-library');
      return NextResponse.json(result);
    }

    if (action === 'move') {
      const direction = body.direction === 'up' ? 'up' : 'down';
      const result = await moveResource(resource, id, direction);
      revalidateTag('chapter-library');
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: friendlyLibraryError(error) }, { status: error?.code === 'P2002' ? 409 : 400 });
  }
}

export async function PATCH(req: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const body = await req.json();
    const resource = requireResource(body.resource);
    const id = cleanString(body.id);

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const result = await updateResource(resource, id, body.data || {});
    revalidateTag('chapter-library');
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: friendlyLibraryError(error) }, { status: error?.code === 'P2002' ? 409 : 400 });
  }
}
