import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import { prismaV2 } from '@/lib/prisma-v2';

type Resource = 'heading' | 'solution' | 'figure' | 'goal' | 'phase' | 'category' | 'facilityUseType';
type Direction = 'up' | 'down';
type FieldOptions = { required?: boolean; max?: number };

const SHORT_TEXT_MAX = 180;
const LONG_TEXT_MAX = 8000;

const HEADING_LEVELS = new Set(['H1', 'H2', 'H3', 'H4', 'H5']);
const SOLUTION_STATUSES = new Set(['DRAFT', 'FINAL', 'PUBLISHED']);
const FIGURE_SLOTS = new Set(['A', 'B', 'C', 'D']);

const resources = new Set<Resource>(['heading', 'solution', 'figure', 'goal', 'phase', 'category', 'facilityUseType']);

const uniqueFieldMessages: Record<string, string> = {
  abbr: 'A goal with that abbreviation already exists. Choose a different abbreviation.',
  text: 'That text is already in use. Choose a different value.',
  name: 'That name is already in use. Choose a different name.',
  solutionId_slot: 'That figure slot (A-D) is already used on this solution.',
};

function friendlyError(error: any) {
  if (error?.code === 'P2002') {
    const target = Array.isArray(error?.meta?.target) ? error.meta.target : [];
    const field = target.find((name: string) => uniqueFieldMessages[name]) || target.join('_');
    return uniqueFieldMessages[field] || 'That value conflicts with an existing item. Please use a different value.';
  }
  return error?.message || 'Unable to update DB 2.0';
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
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

function nullableNumber(name: string, value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

function numberValue(name: string, value: unknown) {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
  return parsed;
}

function booleanValue(value: unknown) {
  return value === true;
}

function requireResource(value: unknown): Resource {
  if (!resources.has(value as Resource)) throw new Error('Invalid resource');
  return value as Resource;
}

function idArray(value: unknown, name: string) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 200 || !value.every((id) => typeof id === 'string' && id.length <= 80)) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

function requireLevel(value: unknown) {
  const level = cleanString(value);
  if (!HEADING_LEVELS.has(level)) throw new Error('Heading level must be H1-H5');
  return level as 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
}

function requireStatus(value: unknown) {
  const status = cleanString(value) || 'DRAFT';
  if (!SOLUTION_STATUSES.has(status)) throw new Error('Status must be DRAFT, FINAL, or PUBLISHED');
  return status as 'DRAFT' | 'FINAL' | 'PUBLISHED';
}

function requireSlot(value: unknown) {
  const slot = cleanString(value).toUpperCase();
  if (!FIGURE_SLOTS.has(slot)) throw new Error('Figure slot must be A, B, C, or D');
  return slot as 'A' | 'B' | 'C' | 'D';
}

function archivedWhere(showArchived: boolean) {
  return showArchived ? {} : { archivedAt: null };
}

async function getLibrary(showArchived: boolean) {
  const [headings, solutions, goals, phases, categories, facilityUseTypes] = await Promise.all([
    prismaV2.heading.findMany({
      where: archivedWhere(showArchived),
      orderBy: { sortOrder: 'asc' },
      include: { facilityUseTypes: true, facilityLocks: { include: { facilityType: true } } },
    }),
    prismaV2.solution.findMany({
      where: archivedWhere(showArchived),
      orderBy: [{ v2Number: 'asc' }, { sortOrder: 'asc' }],
      include: { goals: true, phases: true, categories: true, facilityUseTypes: true, figures: { where: archivedWhere(showArchived) } },
    }),
    prismaV2.goal.findMany({ where: archivedWhere(showArchived), orderBy: { text: 'asc' } }),
    prismaV2.phase.findMany({ where: archivedWhere(showArchived), orderBy: { name: 'asc' } }),
    prismaV2.category.findMany({ where: archivedWhere(showArchived), orderBy: { name: 'asc' } }),
    prismaV2.facilityUseType.findMany({ where: archivedWhere(showArchived), orderBy: { name: 'asc' } }),
  ]);

  return { headings, solutions, goals, phases, categories, facilityUseTypes };
}

export async function GET(req: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  const showArchived = new URL(req.url).searchParams.get('showArchived') === 'true';
  return NextResponse.json(await getLibrary(showArchived));
}

async function createResource(resource: Resource, data: any) {
  switch (resource) {
    case 'heading': {
      const facilityUseTypeIds = idArray(data.facilityUseTypeIds, 'Facility use types');
      const parentId = nullableString('Parent heading', data.parentId, 80);
      const siblingMax = await prismaV2.heading.aggregate({
        where: { parentId, archivedAt: null },
        _max: { sortOrder: true },
      });
      return prismaV2.heading.create({
        data: {
          level: requireLevel(data.level),
          parentId,
          title: stringField('Heading title', data.title, { required: true, max: 240 }),
          v1Number: nullableString('v1 number', data.v1Number, 40),
          v2Number: nullableString('v2 number', data.v2Number, 40),
          credits: nullableNumber('Credits', data.credits),
          maxCredits: nullableNumber('Max credits', data.maxCredits),
          itemCount: nullableNumber('Item count', data.itemCount),
          minPoints1: nullableNumber('Min points 1', data.minPoints1),
          minPoints2: nullableNumber('Min points 2', data.minPoints2),
          minPoints3: nullableNumber('Min points 3', data.minPoints3),
          minPercent1: nullableNumber('Min percent 1', data.minPercent1),
          minPercent2: nullableNumber('Min percent 2', data.minPercent2),
          minPercent3: nullableNumber('Min percent 3', data.minPercent3),
          instruction: nullableString('Instruction', data.instruction),
          designResource: nullableString('Design resource', data.designResource),
          detailedInstruction: nullableString('Detailed instruction', data.detailedInstruction),
          sortOrder: (siblingMax._max.sortOrder ?? 0) + 1,
          facilityUseTypes: facilityUseTypeIds ? { connect: facilityUseTypeIds.map((id: string) => ({ id })) } : undefined,
        },
      });
    }
    case 'solution': {
      const goalIds = idArray(data.goalIds, 'Goals');
      const phaseIds = idArray(data.phaseIds, 'Phases');
      const categoryIds = idArray(data.categoryIds, 'Categories');
      const facilityUseTypeIds = idArray(data.facilityUseTypeIds, 'Facility use types');
      const headingId = stringField('Heading', data.headingId, { required: true, max: 80 });
      const requestedSortOrder = data.sortOrder === undefined || data.sortOrder === null || data.sortOrder === ''
        ? null
        : numberValue('Sort order', data.sortOrder);
      const siblingMax = await prismaV2.solution.aggregate({
        where: { headingId, archivedAt: null },
        _max: { sortOrder: true },
      });
      return prismaV2.solution.create({
        data: {
          headingId,
          refNumber: nullableNumber('Ref number', data.refNumber),
          v1StandardNumber: nullableString('v1 standard number', data.v1StandardNumber, 40),
          v2Number: nullableString('v2 number', data.v2Number, 40),
          text: stringField('Solution text', data.text, { required: true, max: LONG_TEXT_MAX }),
          status: requireStatus(data.status),
          naBox: booleanValue(data.naBox),
          required: booleanValue(data.required),
          points: numberValue('Points', data.points),
          instructionSubpart: nullableNumber('Instruction subpart', data.instructionSubpart),
          instruction: nullableString('Instruction', data.instruction),
          sortOrder: requestedSortOrder ?? (siblingMax._max.sortOrder ?? 0) + 1,
          goals: goalIds ? { connect: goalIds.map((id: string) => ({ id })) } : undefined,
          phases: phaseIds ? { connect: phaseIds.map((id: string) => ({ id })) } : undefined,
          categories: categoryIds ? { connect: categoryIds.map((id: string) => ({ id })) } : undefined,
          facilityUseTypes: facilityUseTypeIds ? { connect: facilityUseTypeIds.map((id: string) => ({ id })) } : undefined,
        },
      });
    }
    case 'figure':
      return prismaV2.figure.create({
        data: {
          solutionId: stringField('Solution', data.solutionId, { required: true, max: 80 }),
          slot: requireSlot(data.slot),
          number: nullableString('Figure number', data.number, SHORT_TEXT_MAX),
          caption: nullableString('Figure caption', data.caption, 1000),
          altTag: nullableString('Figure alt text', data.altTag, 1000),
          status: nullableString('Figure status', data.status, SHORT_TEXT_MAX),
          url: nullableString('Figure URL', data.url, 2048),
        },
      });
    case 'goal':
      return prismaV2.goal.create({
        data: {
          abbr: stringField('Goal abbreviation', data.abbr, { required: true, max: 40 }),
          text: stringField('Goal text', data.text, { required: true, max: 500 }),
        },
      });
    case 'phase':
      return prismaV2.phase.create({ data: { name: stringField('Phase name', data.name, { required: true, max: 160 }) } });
    case 'category':
      return prismaV2.category.create({
        data: {
          name: stringField('Category name', data.name, { required: true, max: 160 }),
          description: nullableString('Description', data.description, 2000),
        },
      });
    case 'facilityUseType':
      return prismaV2.facilityUseType.create({ data: { name: stringField('Facility use type name', data.name, { required: true, max: 200 }) } });
  }
}

async function updateResource(resource: Resource, id: string, data: any) {
  switch (resource) {
    case 'heading': {
      const facilityUseTypeIds = idArray(data.facilityUseTypeIds, 'Facility use types');
      return prismaV2.heading.update({
        where: { id },
        data: {
          level: requireLevel(data.level),
          parentId: nullableString('Parent heading', data.parentId, 80),
          title: stringField('Heading title', data.title, { required: true, max: 240 }),
          v1Number: nullableString('v1 number', data.v1Number, 40),
          v2Number: nullableString('v2 number', data.v2Number, 40),
          credits: nullableNumber('Credits', data.credits),
          maxCredits: nullableNumber('Max credits', data.maxCredits),
          itemCount: nullableNumber('Item count', data.itemCount),
          minPoints1: nullableNumber('Min points 1', data.minPoints1),
          minPoints2: nullableNumber('Min points 2', data.minPoints2),
          minPoints3: nullableNumber('Min points 3', data.minPoints3),
          minPercent1: nullableNumber('Min percent 1', data.minPercent1),
          minPercent2: nullableNumber('Min percent 2', data.minPercent2),
          minPercent3: nullableNumber('Min percent 3', data.minPercent3),
          instruction: nullableString('Instruction', data.instruction),
          designResource: nullableString('Design resource', data.designResource),
          detailedInstruction: nullableString('Detailed instruction', data.detailedInstruction),
          facilityUseTypes: facilityUseTypeIds ? { set: facilityUseTypeIds.map((facilityId: string) => ({ id: facilityId })) } : undefined,
        },
      });
    }
    case 'solution': {
      const goalIds = idArray(data.goalIds, 'Goals');
      const phaseIds = idArray(data.phaseIds, 'Phases');
      const categoryIds = idArray(data.categoryIds, 'Categories');
      const facilityUseTypeIds = idArray(data.facilityUseTypeIds, 'Facility use types');
      return prismaV2.solution.update({
        where: { id },
        data: {
          headingId: stringField('Heading', data.headingId, { required: true, max: 80 }),
          refNumber: nullableNumber('Ref number', data.refNumber),
          v1StandardNumber: nullableString('v1 standard number', data.v1StandardNumber, 40),
          v2Number: nullableString('v2 number', data.v2Number, 40),
          text: stringField('Solution text', data.text, { required: true, max: LONG_TEXT_MAX }),
          status: requireStatus(data.status),
          naBox: booleanValue(data.naBox),
          required: booleanValue(data.required),
          points: numberValue('Points', data.points),
          instructionSubpart: nullableNumber('Instruction subpart', data.instructionSubpart),
          instruction: nullableString('Instruction', data.instruction),
          sortOrder: numberValue('Sort order', data.sortOrder),
          goals: goalIds ? { set: goalIds.map((goalId: string) => ({ id: goalId })) } : undefined,
          phases: phaseIds ? { set: phaseIds.map((phaseId: string) => ({ id: phaseId })) } : undefined,
          categories: categoryIds ? { set: categoryIds.map((categoryId: string) => ({ id: categoryId })) } : undefined,
          facilityUseTypes: facilityUseTypeIds ? { set: facilityUseTypeIds.map((facilityId: string) => ({ id: facilityId })) } : undefined,
        },
      });
    }
    case 'figure':
      return prismaV2.figure.update({
        where: { id },
        data: {
          solutionId: stringField('Solution', data.solutionId, { required: true, max: 80 }),
          slot: requireSlot(data.slot),
          number: nullableString('Figure number', data.number, SHORT_TEXT_MAX),
          caption: nullableString('Figure caption', data.caption, 1000),
          altTag: nullableString('Figure alt text', data.altTag, 1000),
          status: nullableString('Figure status', data.status, SHORT_TEXT_MAX),
          url: nullableString('Figure URL', data.url, 2048),
        },
      });
    case 'goal':
      return prismaV2.goal.update({
        where: { id },
        data: {
          abbr: stringField('Goal abbreviation', data.abbr, { required: true, max: 40 }),
          text: stringField('Goal text', data.text, { required: true, max: 500 }),
        },
      });
    case 'phase':
      return prismaV2.phase.update({ where: { id }, data: { name: stringField('Phase name', data.name, { required: true, max: 160 }) } });
    case 'category':
      return prismaV2.category.update({
        where: { id },
        data: {
          name: stringField('Category name', data.name, { required: true, max: 160 }),
          description: nullableString('Description', data.description, 2000),
        },
      });
    case 'facilityUseType':
      return prismaV2.facilityUseType.update({ where: { id }, data: { name: stringField('Facility use type name', data.name, { required: true, max: 200 }) } });
  }
}

async function setArchive(resource: Resource, id: string, archived: boolean) {
  const data = { archivedAt: archived ? new Date() : null };

  switch (resource) {
    case 'heading':
      return prismaV2.heading.update({ where: { id }, data });
    case 'solution':
      return prismaV2.solution.update({ where: { id }, data });
    case 'figure':
      return prismaV2.figure.update({ where: { id }, data });
    case 'goal':
      return prismaV2.goal.update({ where: { id }, data });
    case 'phase':
      return prismaV2.phase.update({ where: { id }, data });
    case 'category':
      return prismaV2.category.update({ where: { id }, data });
    case 'facilityUseType':
      return prismaV2.facilityUseType.update({ where: { id }, data });
  }
}

// Heading/Solution use a plain Int sortOrder with no uniqueness constraint, so
// reordering is a direct swap - unlike 1.0's chapter/section/solution reorder,
// which has to route through a temp value because `number`/`standardNumber`
// are unique-constrained strings.
async function moveResource(resource: Resource, id: string, direction: Direction) {
  if (resource === 'heading') {
    const current = await prismaV2.heading.findUnique({ where: { id } });
    if (!current) throw new Error('Heading not found');
    const siblings = await prismaV2.heading.findMany({
      where: { parentId: current.parentId, archivedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return swapSortOrder('heading', siblings, id, direction);
  }

  if (resource === 'solution') {
    const current = await prismaV2.solution.findUnique({ where: { id } });
    if (!current) throw new Error('Solution not found');
    const siblings = await prismaV2.solution.findMany({
      where: { headingId: current.headingId, archivedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return swapSortOrder('solution', siblings, id, direction);
  }

  throw new Error('This resource cannot be reordered');
}

async function swapSortOrder(
  model: 'heading' | 'solution',
  siblings: Array<{ id: string; sortOrder: number }>,
  id: string,
  direction: Direction
) {
  const index = siblings.findIndex((item) => item.id === id);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
    return { moved: false };
  }

  const current = siblings[index];
  const target = siblings[targetIndex];

  if (model === 'heading') {
    await prismaV2.$transaction([
      prismaV2.heading.update({ where: { id: current.id }, data: { sortOrder: target.sortOrder } }),
      prismaV2.heading.update({ where: { id: target.id }, data: { sortOrder: current.sortOrder } }),
    ]);
  } else {
    await prismaV2.$transaction([
      prismaV2.solution.update({ where: { id: current.id }, data: { sortOrder: target.sortOrder } }),
      prismaV2.solution.update({ where: { id: target.id }, data: { sortOrder: current.sortOrder } }),
    ]);
  }

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
      return NextResponse.json(result, { status: 201 });
    }

    const id = cleanString(body.id);
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (action === 'archive') {
      const result = await setArchive(resource, id, true);
      return NextResponse.json(result);
    }

    if (action === 'restore') {
      const result = await setArchive(resource, id, false);
      return NextResponse.json(result);
    }

    if (action === 'move') {
      const direction = body.direction === 'up' ? 'up' : 'down';
      const result = await moveResource(resource, id, direction);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: friendlyError(error) }, { status: error?.code === 'P2002' ? 409 : 400 });
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
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: friendlyError(error) }, { status: error?.code === 'P2002' ? 409 : 400 });
  }
}
