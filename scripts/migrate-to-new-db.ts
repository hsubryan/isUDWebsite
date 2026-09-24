import { PrismaClient } from '@prisma/client';

const OLD_DATABASE_URL = process.env.OLD_DATABASE_URL;
const NEW_DATABASE_URL = process.env.NEW_DATABASE_URL;

if (!OLD_DATABASE_URL || !NEW_DATABASE_URL) {
  console.error('Set OLD_DATABASE_URL and NEW_DATABASE_URL env vars before running this script.');
  process.exit(1);
}

const oldDb = new PrismaClient({ datasources: { db: { url: OLD_DATABASE_URL } } });
const newDb = new PrismaClient({ datasources: { db: { url: NEW_DATABASE_URL } } });

async function main() {
  console.log('Copying Chapters...');
  const chapters = await oldDb.chapter.findMany();
  for (const c of chapters) await newDb.chapter.create({ data: c });

  console.log('Copying Sections...');
  const sections = await oldDb.section.findMany();
  for (const s of sections) await newDb.section.create({ data: s });

  console.log('Copying SubSections...');
  const subSections = await oldDb.subSection.findMany();
  for (const s of subSections) await newDb.subSection.create({ data: s });

  console.log('Copying Goals...');
  const goals = await oldDb.goal.findMany();
  for (const g of goals) await newDb.goal.create({ data: g });

  console.log('Copying Phases...');
  const phases = await oldDb.phase.findMany();
  for (const p of phases) await newDb.phase.create({ data: p });

  console.log('Copying Solutions (with goal/phase links)...');
  const solutions = await oldDb.solution.findMany({
    include: { goals: true, phases: true },
  });
  for (const s of solutions) {
    const { goals: solGoals, phases: solPhases, ...rest } = s;
    await newDb.solution.create({
      data: {
        ...rest,
        goals: { connect: solGoals.map((g) => ({ id: g.id })) },
        phases: { connect: solPhases.map((p) => ({ id: p.id })) },
      },
    });
  }

  console.log('Copying Figures...');
  const figures = await oldDb.figure.findMany();
  for (const f of figures) await newDb.figure.create({ data: f });

  console.log('Copying FacilityUses (with section links)...');
  const facilityUses = await oldDb.facilityUse.findMany({ include: { sections: true } });
  for (const fu of facilityUses) {
    const { sections: fuSections, ...rest } = fu;
    await newDb.facilityUse.create({
      data: { ...rest, sections: { connect: fuSections.map((s) => ({ id: s.id })) } },
    });
  }

  console.log('Copying Users...');
  const users = await oldDb.user.findMany();
  for (const u of users) await newDb.user.create({ data: u });

  console.log('Copying Accounts (OAuth, if any)...');
  const accounts = await oldDb.account.findMany();
  for (const a of accounts) await newDb.account.create({ data: a });

  console.log('Copying Projects (with facilityUse links)...');
  const projects = await oldDb.project.findMany({ include: { facilityUses: true } });
  for (const p of projects) {
    const { facilityUses: pFacilityUses, ...rest } = p;
    await newDb.project.create({
      data: { ...rest, facilityUses: { connect: pFacilityUses.map((f) => ({ id: f.id })) } },
    });
  }

  console.log('Copying TeamMembers...');
  const teamMembers = await oldDb.teamMember.findMany();
  for (const t of teamMembers) await newDb.teamMember.create({ data: t });

  console.log('Copying SectionToggles...');
  const sectionToggles = await oldDb.sectionToggle.findMany();
  for (const st of sectionToggles) await newDb.sectionToggle.create({ data: st });

  console.log('Copying ProjectResponses...');
  const responses = await oldDb.projectResponse.findMany();
  for (const r of responses) await newDb.projectResponse.create({ data: r });

  console.log('Copying ProjectSubmissions...');
  const submissions = await oldDb.projectSubmission.findMany();
  for (const s of submissions) await newDb.projectSubmission.create({ data: s });

  console.log('Done. Verifying counts...');
  for (const model of [
    'chapter', 'section', 'subSection', 'goal', 'phase', 'solution', 'figure',
    'facilityUse', 'user', 'account', 'project', 'teamMember', 'sectionToggle',
    'projectResponse', 'projectSubmission',
  ] as const) {
    const [oldCount, newCount] = await Promise.all([
      (oldDb[model] as any).count(),
      (newDb[model] as any).count(),
    ]);
    const flag = oldCount === newCount ? 'OK' : 'MISMATCH';
    console.log(`${model}: old=${oldCount} new=${newCount} [${flag}]`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await oldDb.$disconnect();
    await newDb.$disconnect();
  });
