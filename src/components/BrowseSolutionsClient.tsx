'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, ChevronRight, Image as ImageIcon, Images, Minus, Plus, Printer, Search } from 'lucide-react';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

type Solution = {
  id: string;
  standardNumber: string;
  text: string;
  points: number;
  isMandatory: boolean;
  instruction: string | null;
  goals: { id: string; text: string }[];
  phases: { id: string; name: string }[];
  figures: {
    id: string;
    number: string | null;
    caption: string | null;
    altTag: string | null;
    url: string | null;
  }[];
};

type Section = {
  id: string;
  number: string;
  title: string;
  totalCredits: number;
  solutions: Solution[];
};

type Chapter = {
  id: string;
  number: string;
  title: string;
  totalCredits: number;
  sections: Section[];
};

type BrowseSolutionsClientProps = {
  chapters: Chapter[];
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function isDataImage(src: string) {
  return src.startsWith('data:image/');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function BrowseSolutionsClient({ chapters }: BrowseSolutionsClientProps) {
  const [activeChapterId, setActiveChapterId] = useState(chapters[0]?.id || '');
  const [activeSectionId, setActiveSectionId] = useState('');
  const [expandedSolutionIds, setExpandedSolutionIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');

  const activeChapter = chapters.find((chapter) => chapter.id === activeChapterId) || chapters[0];

  const visibleSections = useMemo(() => {
    if (!activeChapter) return [];
    const search = query.trim().toLowerCase();
    if (!search) return activeChapter.sections;

    return activeChapter.sections
      .map((section) => ({
        ...section,
        solutions: section.solutions.filter((solution) => {
          return (
            solution.standardNumber.toLowerCase().includes(search) ||
            solution.text.toLowerCase().includes(search) ||
            section.title.toLowerCase().includes(search)
          );
        }),
      }))
      .filter((section) => section.solutions.length > 0 || section.title.toLowerCase().includes(search));
  }, [activeChapter, query]);

  const selectedSections = activeSectionId
    ? visibleSections.filter((section) => section.id === activeSectionId)
    : visibleSections;

  const visibleSolutionIds = useMemo(
    () => selectedSections.flatMap((section) => section.solutions.map((solution) => solution.id)),
    [selectedSections]
  );
  const allSolutionsExpanded = visibleSolutionIds.length > 0
    && visibleSolutionIds.every((id) => expandedSolutionIds[id]);

  const toggleAllExpanded = () => {
    setExpandedSolutionIds((prev) => {
      const next = { ...prev };
      visibleSolutionIds.forEach((id) => { next[id] = !allSolutionsExpanded; });
      return next;
    });
  };

  const breadcrumbItems = [
    { label: 'My Projects', href: '/' },
    { label: 'Browse Solutions' },
  ];

  const handlePrint = () => {
    const printRoot = document.getElementById('checklist-print-root');
    if (!printRoot || !activeChapter) return;

    printRoot.innerHTML = `
      <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:16px;">
        <img src="/logo.png" style="height:36px;width:auto;" alt="isUD - Innovative solutions for Universal Design" />
        <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;">Innovative Solutions for Universal Design</span>
      </div>
      <div style="margin-bottom:20px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
        <span style="font-size:22px;font-weight:700;color:#1e293b;">${escapeHtml(activeChapter.number)}&nbsp;&nbsp;${escapeHtml(activeChapter.title)}</span>
      </div>
      ${selectedSections.map((section) => `
        <div style="margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="font-size:15px;color:#003366;">${escapeHtml(activeChapter.number)}.${escapeHtml(section.number)} ${escapeHtml(section.title)}</strong>
            <span style="font-size:11px;color:#64748b;font-weight:600;">${section.totalCredits} credits &middot; ${section.solutions.length} solutions</span>
          </div>
          ${section.solutions.map((solution) => `
            <div style="margin-bottom:14px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:4px;">
              <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:4px;">
                <span style="font-family:monospace;font-size:12px;font-weight:700;color:#B45309;">${escapeHtml(solution.standardNumber)}</span>
                ${solution.isMandatory ? '<span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#92400e;border:1px solid #fde68a;background:#fffbeb;padding:1px 6px;border-radius:3px;">Required</span>' : ''}
                <span style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:3px;">${solution.points} pts</span>
              </div>
              <p style="font-size:13px;line-height:1.5;color:#334155;margin:0 0 6px;">${escapeHtml(solution.text)}</p>
              ${solution.instruction ? `<p style="font-size:12px;line-height:1.5;color:#475569;margin:0 0 6px;"><strong>Instructions:</strong> ${escapeHtml(solution.instruction)}</p>` : ''}
              <p style="font-size:11px;color:#64748b;margin:0;">
                <strong>Goals:</strong> ${solution.goals.length ? solution.goals.map((g) => escapeHtml(g.text)).join(', ') : 'None listed'}
                &nbsp;&middot;&nbsp;
                <strong>Phases:</strong> ${solution.phases.length ? solution.phases.map((p) => escapeHtml(p.name)).join(', ') : 'None listed'}
              </p>
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;

    setTimeout(() => window.print(), 100);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="bg-white border border-slate-200 rounded-sm px-6 py-4 flex items-center shadow-sm">
        <h1 className="text-xl font-bold text-primary tracking-tight">Browse Solutions</h1>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden rounded-sm">
        <div className="flex flex-col gap-4 px-6 py-5 bg-white border-b border-slate-200 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Explore the Innovative Solutions for Universal Design
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search solutions"
                className="h-11 w-full min-w-72 rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-secondary focus:ring-2 focus:ring-secondary/30"
              />
            </label>
            <button
              type="button"
              onClick={handlePrint}
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#001d3d] active:scale-[0.98]"
            >
              <Printer size={16} />
              <span>Print</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
          <div className="lg:col-span-3 border-r border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Chapters</p>
            </div>
            <div className="max-h-[720px] overflow-y-auto">
              {chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => {
                    setActiveChapterId(chapter.id);
                    setActiveSectionId('');
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-6 py-4 text-left transition-all group border-b border-slate-100',
                    activeChapter?.id === chapter.id ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'
                  )}
                >
                  <div className="flex gap-4 min-w-0">
                    <span className={cn('text-xl font-bold shrink-0 w-7', activeChapter?.id === chapter.id ? 'text-secondary' : 'text-primary')}>
                      {chapter.number}
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <div className={cn('text-[15px] font-bold tracking-tight', activeChapter?.id === chapter.id ? 'text-primary' : 'text-slate-700')}>
                        {chapter.title}
                      </div>
                      <div className={cn('text-[13px]', activeChapter?.id === chapter.id ? 'text-secondary font-bold' : 'text-slate-500 font-medium')}>
                        {chapter.totalCredits} Credits · {chapter.sections.length} Sections
                      </div>
                    </div>
                  </div>
                  {activeChapter?.id === chapter.id ? (
                    <ArrowRight className="text-secondary shrink-0" size={22} strokeWidth={3} />
                  ) : (
                    <ChevronRight className="text-slate-300 shrink-0" size={22} strokeWidth={2} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-9 bg-white">
            {!activeChapter ? (
              <div className="p-10 text-sm text-slate-500">No solutions available.</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12">
                <aside className="xl:col-span-4 border-b xl:border-b-0 xl:border-r border-slate-200">
                  <div className="border-b border-slate-100 px-6 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Sections</p>
                  </div>
                  <div className="max-h-[720px] overflow-y-auto p-4 space-y-1">
                    <button
                      type="button"
                      onClick={() => setActiveSectionId('')}
                      className={cn(
                        'w-full rounded-sm px-3 py-2 text-left text-sm font-bold transition-colors',
                        activeSectionId === '' ? 'bg-accent text-white' : 'text-primary hover:bg-primary/10'
                      )}
                    >
                      All Sections
                    </button>
                    {visibleSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSectionId(section.id)}
                        className={cn(
                          'w-full rounded-sm px-3 py-2 text-left transition-colors',
                          activeSectionId === section.id ? 'bg-accent text-white' : 'text-primary hover:bg-primary/10'
                        )}
                      >
                        <div className="flex gap-2">
                          <span className="font-bold">{activeChapter.number}.{section.number}</span>
                          <span className="text-sm font-semibold">{section.title}</span>
                        </div>
                        <div className={cn('mt-0.5 text-xs', activeSectionId === section.id ? 'text-white/80' : 'text-primary/50')}>
                          {section.totalCredits} credits · {section.solutions.length} solutions
                        </div>
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="xl:col-span-8 p-6 space-y-8">
                  {visibleSolutionIds.length > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={toggleAllExpanded}
                        className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:border-secondary hover:text-secondary"
                      >
                        <Images className="h-4 w-4" aria-hidden="true" />
                        {allSolutionsExpanded ? 'Collapse All' : 'Expand All'}
                      </button>
                    </div>
                  )}
                  {selectedSections.length === 0 ? (
                    <div className="rounded-sm border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                      No solutions match your search.
                    </div>
                  ) : (
                    selectedSections.map((section) => (
                      <section key={section.id} className="space-y-3">
                        <div className="border-b border-slate-200 pb-2">
                          <h2 className="text-lg font-bold text-primary">
                            {activeChapter.number}.{section.number} {section.title}
                          </h2>
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            {section.totalCredits} credits · {section.solutions.length} solutions
                          </p>
                        </div>

                        <div className="divide-y divide-slate-100 rounded-sm border border-slate-200">
                          {section.solutions.map((solution) => {
                            const expanded = !!expandedSolutionIds[solution.id];
                            const figures = [
                              ...new Map(
                                (solution.figures || [])
                                  .filter((figure) => figure.url)
                                  .map((figure) => [`${figure.number || ''}|${figure.url}`, figure])
                              ).values(),
                            ];
                            return (
                              <div key={solution.id} className="bg-white">
                                <button
                                  type="button"
                                  onClick={() => setExpandedSolutionIds((prev) => ({ ...prev, [solution.id]: !expanded }))}
                                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                                >
                                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500">
                                    {expanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-xs font-bold text-secondary">{solution.standardNumber}</span>
                                      {solution.isMandatory && (
                                        <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                                          Required
                                        </span>
                                      )}
                                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        {solution.points} pts
                                      </span>
                                      {figures.length > 0 && (
                                        <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                                          <ImageIcon className="h-3 w-3" />
                                          {figures.length}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{solution.text}</p>
                                  </div>
                                </button>

                                {expanded && (
                                  <div className="border-t border-slate-100 bg-slate-50 px-12 py-4 text-sm text-slate-600 space-y-4">
                                    {solution.instruction && (
                                      <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Instructions</p>
                                        <p className="mt-1 leading-relaxed">{solution.instruction}</p>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                      <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Goals of UD</p>
                                        <p className="mt-1">{solution.goals.map((goal) => goal.text).join(', ') || 'None listed'}</p>
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Phases</p>
                                        <p className="mt-1">{solution.phases.map((phase) => phase.name).join(', ') || 'None listed'}</p>
                                      </div>
                                    </div>
                                    {figures.length > 0 && (
                                      <div className="space-y-4">
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Figures</p>
                                        {figures.map((figure) => (
                                          <figure key={figure.id} className="rounded-md border border-slate-200 bg-white p-4">
                                            {figure.url && isDataImage(figure.url) ? (
                                              // eslint-disable-next-line @next/next/no-img-element
                                              <img
                                                src={figure.url}
                                                alt={figure.altTag || figure.caption || figure.number || 'Solution figure'}
                                                className="mx-auto max-h-[420px] w-auto max-w-full rounded-sm object-contain"
                                                loading="lazy"
                                              />
                                            ) : (
                                              <Image
                                                src={figure.url || ''}
                                                alt={figure.altTag || figure.caption || figure.number || 'Solution figure'}
                                                width={900}
                                                height={600}
                                                className="mx-auto max-h-[420px] w-auto max-w-full rounded-sm object-contain"
                                                loading="lazy"
                                                unoptimized
                                              />
                                            )}
                                            {figure.caption && (
                                              <figcaption className="mt-3 text-center text-xs leading-5 text-slate-600">
                                                {figure.caption}
                                              </figcaption>
                                            )}
                                          </figure>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
