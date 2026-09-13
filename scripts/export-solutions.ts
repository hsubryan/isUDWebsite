import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function main() {
  console.log('🔄 Exporting active solutions from database...');

  const solutions = await prisma.solution.findMany({
    where: { archivedAt: null },
    include: {
      section: {
        include: {
          chapter: true,
        },
      },
      subSection: true,
      goals: true,
      phases: true,
      figures: {
        where: { archivedAt: null },
      },
    },
  });

  // Sort solutions naturally by standardNumber
  solutions.sort((a, b) => {
    const aParts = a.standardNumber.split('.').map(Number);
    const bParts = b.standardNumber.split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });

  const headers = [
    'SL_No', 'Ref#', 'Standard#', 'Head_Level',
    'H1#', 'H1_Ch_Title', 'H1_Credits',
    'H2#', 'H2_Sec_Title', 'H2_Credits',
    'H3#', 'H3_Sec_Title', 'H3_Credits',
    'Item#', 'Standard_Text', 'Prerequisite',
    'Goals', 'Phases', 'Points',
    'Instruction Subpart', 'Instruction',
    'FigA_No', 'FigA_Caption', 'FigA_AltTag', 'FigA_Status',
    'FigB_No', 'FigB_Caption', 'FigB_AltTag', 'FigB_Status',
    'FigC_No', 'FigC_Caption', 'FigC_AltTag', 'FigC_Status',
    'FigD_No', 'FigD_Caption', 'FigD_AltTag', 'FigD_Status'
  ];

  const csvRows = [headers.join(',')];

  solutions.forEach((sol, idx) => {
    const slNo = idx + 1;
    const refId = sol.refId || '';
    const standardNo = sol.standardNumber;
    const headLevel = sol.subSection ? 'H3' : 'H2';

    const ch = sol.section?.chapter;
    const h1No = ch?.number || '';
    const h1Title = ch?.title || '';
    const h1Credits = ch?.totalCredits ?? '';

    const sec = sol.section;
    const h2No = sec?.number || '';
    const h2Title = sec?.title || '';
    const h2Credits = sec?.totalCredits ?? '';

    const sub = sol.subSection;
    const h3No = sub ? sub.number : '0';
    const h3Title = sub ? sub.title : '';
    const h3Credits = sub ? (sub.totalCredits ?? '') : '0';

    const standardNoParts = standardNo.split('.');
    const itemNo = standardNoParts[standardNoParts.length - 1] || '1';

    const text = sol.text;
    const prerequisite = sol.isMandatory ? 'Required' : '';

    // Join goals with space to match seed format
    const goalsStr = sol.goals.map(g => g.text).join(' ');
    // Join phases with space
    const phasesStr = sol.phases.map(p => p.name).join(' ');

    const points = sol.points;
    const instructionSubpart = '1';
    const instruction = sol.instruction || '';

    // Match figures to A, B, C, D
    const figA = sol.figures.find(f => f.label === 'FigA' || f.label === 'Fig_A');
    const figB = sol.figures.find(f => f.label === 'FigB' || f.label === 'Fig_B');
    const figC = sol.figures.find(f => f.label === 'FigC' || f.label === 'Fig_C');
    const figD = sol.figures.find(f => f.label === 'FigD' || f.label === 'Fig_D');

    const row = [
      escapeCSV(slNo),
      escapeCSV(refId),
      escapeCSV(standardNo),
      escapeCSV(headLevel),
      escapeCSV(h1No),
      escapeCSV(h1Title),
      escapeCSV(h1Credits),
      escapeCSV(h2No),
      escapeCSV(h2Title),
      escapeCSV(h2Credits),
      escapeCSV(h3No),
      escapeCSV(h3Title),
      escapeCSV(h3Credits),
      escapeCSV(itemNo),
      escapeCSV(text),
      escapeCSV(prerequisite),
      escapeCSV(goalsStr),
      escapeCSV(phasesStr),
      escapeCSV(points),
      escapeCSV(instructionSubpart),
      escapeCSV(instruction),
      escapeCSV(figA?.number || ''),
      escapeCSV(figA?.caption || ''),
      escapeCSV(figA?.altTag || ''),
      escapeCSV(figA ? 'Latest Version' : ''),
      escapeCSV(figB?.number || ''),
      escapeCSV(figB?.caption || ''),
      escapeCSV(figB?.altTag || ''),
      escapeCSV(figB ? 'Latest Version' : ''),
      escapeCSV(figC?.number || ''),
      escapeCSV(figC?.caption || ''),
      escapeCSV(figC?.altTag || ''),
      escapeCSV(figC ? 'Latest Version' : ''),
      escapeCSV(figD?.number || ''),
      escapeCSV(figD?.caption || ''),
      escapeCSV(figD?.altTag || ''),
      escapeCSV(figD ? 'Latest Version' : '')
    ];

    csvRows.push(row.join(','));
  });

  const outputPath = path.join(process.cwd(), 'isUD_Active_Solutions.csv');
  fs.writeFileSync(outputPath, csvRows.join('\r\n'), 'utf8');
  console.log(`✅ Successfully exported ${solutions.length} solutions to: ${outputPath}`);
}

main()
  .catch((e) => {
    console.error('❌ Error exporting solutions:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
