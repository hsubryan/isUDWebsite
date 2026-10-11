'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

type Figure = {
  id: string;
  label: string;
  number: string | null;
  caption: string | null;
  altTag: string | null;
  url: string | null;
  archivedAt: string | null;
};

type Goal = {
  id: string;
  abbr: string;
  text: string;
  archivedAt: string | null;
};

type Phase = {
  id: string;
  name: string;
  archivedAt: string | null;
};

type FacilityUse = {
  id: string;
  name: string;
  archivedAt: string | null;
};

type Solution = {
  id: string;
  refId: string;
  standardNumber: string;
  text: string;
  points: number;
  isMandatory: boolean;
  instruction: string | null;
  sectionId: string;
  subSectionId: string | null;
  archivedAt: string | null;
  goals: Goal[];
  phases: Phase[];
  figures: Figure[];
};

type SubSection = {
  id: string;
  number: string;
  title: string;
  totalCredits: number;
  sectionId: string;
  archivedAt: string | null;
};

type Section = {
  id: string;
  number: string;
  title: string;
  totalCredits: number;
  minPoints1: number;
  minPoints2: number;
  minPoints3: number;
  detailedInstruction: string | null;
  chapterId: string;
  archivedAt: string | null;
  subSections: SubSection[];
  solutions: Solution[];
  facilityUses: FacilityUse[];
};

type Chapter = {
  id: string;
  number: string;
  title: string;
  totalCredits: number;
  archivedAt: string | null;
  sections: Section[];
};

type LibraryData = {
  chapters: Chapter[];
  goals: Goal[];
  phases: Phase[];
  facilityUses: FacilityUse[];
};

type Resource = 'chapter' | 'section' | 'subSection' | 'solution' | 'figure' | 'goal' | 'phase' | 'facilityUse';

type EditTarget =
  | { resource: 'chapter'; item: Partial<Chapter> }
  | { resource: 'section'; item: Partial<Section> }
  | { resource: 'subSection'; item: Partial<SubSection> }
  | { resource: 'solution'; item: Partial<Solution> & { goalIds?: string[]; phaseIds?: string[] } }
  | { resource: 'figure'; item: Partial<Figure> & { solutionId?: string } }
  | { resource: 'goal'; item: Partial<Goal> }
  | { resource: 'phase'; item: Partial<Phase> }
  | { resource: 'facilityUse'; item: Partial<FacilityUse> };

const emptyLibrary: LibraryData = { chapters: [], goals: [], phases: [], facilityUses: [] };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function nextNumber(items: Array<{ number: string }>) {
  const numbers = items
    .map((item) => Number(item.number))
    .filter((value) => Number.isFinite(value));
  return String((numbers.length ? Math.max(...numbers) : 0) + 1);
}

function nextSolutionNumber(chapter: Chapter | undefined, section: Section | undefined) {
  if (!chapter || !section) return '';
  const prefix = `${chapter.number}.${section.number}`;
  const values = section.solutions
    .map((solution) => Number(solution.standardNumber.split('.').at(-1)))
    .filter((value) => Number.isFinite(value));
  return `${prefix}.${(values.length ? Math.max(...values) : 0) + 1}`;
}

function isArchived(item: { archivedAt?: string | null }) {
  return Boolean(item.archivedAt);
}

function inputClass() {
  return 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/25';
}

function textareaClass() {
  return 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-relaxed text-slate-800 outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/25';
}

export default function AdminEditSolutionsClient() {
  const [library, setLibrary] = useState<LibraryData>(emptyLibrary);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [activeChapterId, setActiveChapterId] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [figureUploadSolution, setFigureUploadSolution] = useState<Solution | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editPanelRef = useRef<HTMLDivElement | null>(null);

  const activeChapter = library.chapters.find((chapter) => chapter.id === activeChapterId) || library.chapters[0];
  const activeSection = activeChapter?.sections.find((section) => section.id === activeSectionId) || activeChapter?.sections[0];

  const filteredChapters = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return library.chapters;
    return library.chapters.filter((chapter) => {
      return (
        chapter.number.toLowerCase().includes(term) ||
        chapter.title.toLowerCase().includes(term) ||
        chapter.sections.some((section) =>
          section.title.toLowerCase().includes(term) ||
          section.solutions.some((solution) =>
            solution.standardNumber.toLowerCase().includes(term) ||
            solution.text.toLowerCase().includes(term)
          )
        )
      );
    });
  }, [library.chapters, query]);

  async function loadLibrary(nextShowArchived = showArchived) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/library?showArchived=${nextShowArchived ? 'true' : 'false'}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load library');
      setLibrary(data);
      setActiveChapterId((current) => data.chapters.some((chapter: Chapter) => chapter.id === current) ? current : data.chapters[0]?.id || '');
      setActiveSectionId((current) => {
        const chapter = data.chapters.find((item: Chapter) => item.id === activeChapterId) || data.chapters[0];
        return chapter?.sections.some((section: Section) => section.id === current) ? current : chapter?.sections[0]?.id || '';
      });
    } catch (err: any) {
      setError(err.message || 'Unable to load library');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary(showArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  useEffect(() => {
    if (!editTarget) return;
    window.setTimeout(() => {
      editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [editTarget]);

  async function apiAction(method: 'POST' | 'PATCH', body: Record<string, unknown>, success: string) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/library', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save change');
      setMessage(success);
      setEditTarget(null);
      await loadLibrary(showArchived);
    } catch (err: any) {
      setError(err.message || 'Unable to save change');
    } finally {
      setSaving(false);
    }
  }

  function editChapter(chapter?: Chapter) {
    setEditTarget({
      resource: 'chapter',
      item: chapter || { number: nextNumber(library.chapters), title: '', totalCredits: 0 },
    });
  }

  function editSection(section?: Section) {
    if (!activeChapter) return;
    setEditTarget({
      resource: 'section',
      item: section || {
        chapterId: activeChapter.id,
        number: nextNumber(activeChapter.sections),
        title: '',
        totalCredits: 0,
        minPoints1: 0,
        minPoints2: 0,
        minPoints3: 0,
        detailedInstruction: '',
        facilityUses: [],
      },
    });
  }

  function editSubSection(subSection?: SubSection) {
    if (!activeSection) return;
    setEditTarget({
      resource: 'subSection',
      item: subSection || {
        sectionId: activeSection.id,
        number: nextNumber(activeSection.subSections),
        title: '',
        totalCredits: 0,
      },
    });
  }

  function editSolution(solution?: Solution) {
    if (!activeChapter || !activeSection) return;
    setEditTarget({
      resource: 'solution',
      item: solution
        ? {
            ...solution,
            goalIds: solution.goals.map((goal) => goal.id),
            phaseIds: solution.phases.map((phase) => phase.id),
          }
        : {
            sectionId: activeSection.id,
            subSectionId: null,
            standardNumber: nextSolutionNumber(activeChapter, activeSection),
            refId: nextSolutionNumber(activeChapter, activeSection),
            text: '',
            points: 0,
            isMandatory: false,
            instruction: '',
            goalIds: [],
            phaseIds: [],
          },
    });
  }

  function editFigure(solution: Solution, figure?: Figure) {
    setEditTarget({
      resource: 'figure',
      item: figure || {
        solutionId: solution.id,
        label: 'Fig',
        number: '',
        caption: '',
        altTag: '',
        url: '',
      },
    });
  }

  function browseFigure(solution: Solution) {
    setFigureUploadSolution(solution);
    fileInputRef.current?.click();
  }

  async function handleFigureFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !figureUploadSolution) return;

    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (!allowedTypes.has(file.type)) {
      setError('Please select a PNG, JPEG, WebP, or GIF image.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be 4 MB or smaller.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('solutionId', figureUploadSolution.id);

      const response = await fetch('/api/admin/figures/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to upload figure');

      setMessage('Figure uploaded');
      await loadLibrary(showArchived);
    } catch (err: any) {
      setError(err.message || 'Unable to upload figure');
    } finally {
      setFigureUploadSolution(null);
      setSaving(false);
    }
  }

  function editSimple(resource: 'goal' | 'phase' | 'facilityUse', item?: Goal | Phase | FacilityUse) {
    if (resource === 'goal') {
      setEditTarget({ resource, item: item || { abbr: '', text: '' } });
    } else if (resource === 'phase') {
      setEditTarget({ resource, item: item || { name: '' } });
    } else {
      setEditTarget({ resource, item: item || { name: '' } });
    }
  }

  function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;

    const hasId = Boolean((editTarget.item as any).id);
    const body = hasId
      ? { resource: editTarget.resource, id: (editTarget.item as any).id, data: editTarget.item }
      : { action: 'create', resource: editTarget.resource, data: editTarget.item };
    apiAction(hasId ? 'PATCH' : 'POST', body, hasId ? 'Updated' : 'Created');
  }

  const archiveWarnings: Partial<Record<Resource, string>> = {
    chapter: 'Archiving this chapter will also hide every section, solution, and figure inside it from Browse Solutions and project checklists. Continue?',
    section: 'Archiving this section will also hide every solution and figure inside it from Browse Solutions and project checklists. Continue?',
    subSection: 'Archiving this subsection will also hide its solutions from Browse Solutions and project checklists. Continue?',
    solution: 'Archive this solution? It will be hidden from Browse Solutions and project checklists.',
  };

  function archiveAction(resource: Resource, id: string, archived: boolean) {
    if (!archived) {
      const warning = archiveWarnings[resource] || 'Archive this item?';
      if (!window.confirm(warning)) return;
    }
    apiAction('POST', { action: archived ? 'restore' : 'archive', resource, id }, archived ? 'Restored' : 'Archived');
  }

  function moveAction(resource: Resource, id: string, direction: 'up' | 'down') {
    apiAction('POST', { action: 'move', resource, id, direction }, 'Order updated');
  }

  const breadcrumbItems = [
    { label: 'My Projects', href: '/' },
    { label: 'Admin Dashboard' },
    { label: 'Edit Solutions' },
  ];

  return (
    <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFigureFileSelected}
      />
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex flex-col gap-4 border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Admin Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold text-primary">Edit Solutions</h1>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          <label className="relative block flex-1 lg:w-80 lg:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search library"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25"
            />
          </label>
          <label className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Show archived
          </label>
        </div>
      </div>

      {(message || error) && (
        <div className={cn('flex items-center gap-2 border px-4 py-3 text-sm font-semibold', error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
          {error ? <Trash2 className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {error || message}
        </div>
      )}

      {loading ? (
        <div className="flex h-80 items-center justify-center border border-slate-200 bg-white text-sm font-bold text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading solution library
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(320px,1.1fr)] xl:grid-cols-[280px_360px_minmax(460px,1fr)]">
          <aside className="min-w-0 border border-slate-200 bg-white shadow-sm">
            <PanelHeader label="Chapters" onAdd={() => editChapter()} />
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 2xl:max-h-[620px]">
              {filteredChapters.map((chapter) => (
                <ListRow
                  key={chapter.id}
                  active={activeChapter?.id === chapter.id}
                  archived={isArchived(chapter)}
                  title={`${chapter.number} ${chapter.title}`}
                  meta={`${chapter.totalCredits} credits, ${chapter.sections.length} sections`}
                  onSelect={() => {
                    setActiveChapterId(chapter.id);
                    setActiveSectionId(chapter.sections[0]?.id || '');
                  }}
                  onEdit={() => editChapter(chapter)}
                  onArchive={() => archiveAction('chapter', chapter.id, isArchived(chapter))}
                  onMoveUp={() => moveAction('chapter', chapter.id, 'up')}
                  onMoveDown={() => moveAction('chapter', chapter.id, 'down')}
                />
              ))}
            </div>
          </aside>

          <aside className="min-w-0 border border-slate-200 bg-white shadow-sm">
            <PanelHeader label="Sections and Subsections" onAdd={() => editSection()} disabled={!activeChapter} />
            {!activeChapter ? (
              <EmptyState text="Select a chapter to manage sections." />
            ) : (
              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 2xl:max-h-[620px]">
                {activeChapter.sections.map((section) => (
                  <div key={section.id}>
                    <ListRow
                      active={activeSection?.id === section.id}
                      archived={isArchived(section)}
                      title={`${activeChapter.number}.${section.number} ${section.title}`}
                      meta={`${section.totalCredits} credits, ${section.solutions.length} solutions`}
                      onSelect={() => setActiveSectionId(section.id)}
                      onEdit={() => editSection(section)}
                      onArchive={() => archiveAction('section', section.id, isArchived(section))}
                      onMoveUp={() => moveAction('section', section.id, 'up')}
                      onMoveDown={() => moveAction('section', section.id, 'down')}
                    />
                    {activeSection?.id === section.id && (
                      <div className="bg-slate-50 px-4 py-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Subsections</p>
                          <button
                            type="button"
                            onClick={() => editSubSection()}
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-2 text-xs font-bold text-primary ring-1 ring-slate-200 hover:bg-slate-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add
                          </button>
                        </div>
                        {section.subSections.length === 0 ? (
                          <p className="text-xs font-medium text-slate-400">No subsections.</p>
                        ) : (
                          <div className="space-y-1">
                            {section.subSections.map((subSection) => (
                              <ListRow
                                key={subSection.id}
                                compact
                                archived={isArchived(subSection)}
                                title={`${subSection.number} ${subSection.title}`}
                                meta={`${subSection.totalCredits} credits`}
                                onSelect={() => editSubSection(subSection)}
                                onEdit={() => editSubSection(subSection)}
                                onArchive={() => archiveAction('subSection', subSection.id, isArchived(subSection))}
                                onMoveUp={() => moveAction('subSection', subSection.id, 'up')}
                                onMoveDown={() => moveAction('subSection', subSection.id, 'down')}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>

          <section className="min-w-0 border border-slate-200 bg-white shadow-sm lg:col-span-2 xl:col-span-1">
            <PanelHeader label="Solutions" onAdd={() => editSolution()} disabled={!activeSection} />
            {!activeSection ? (
              <EmptyState text="Select a section to manage solutions." />
            ) : (
              <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100 2xl:max-h-[620px]">
                  {activeSection.solutions.map((solution) => (
                    <div key={solution.id} className={cn('p-4', isArchived(solution) && 'bg-slate-50 opacity-70')}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <button type="button" onClick={() => editSolution(solution)} className="min-w-0 flex-1 text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-secondary">{solution.standardNumber}</span>
                            {solution.isMandatory && <Badge text="Required" />}
                            {isArchived(solution) && <Badge text="Archived" muted />}
                            {solution.figures.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                                <ImageIcon className="h-3 w-3" />
                                {solution.figures.length}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm font-medium leading-relaxed text-slate-700">{solution.text}</p>
                        </button>
                        <RowActions
                          archived={isArchived(solution)}
                          onEdit={() => editSolution(solution)}
                          onArchive={() => archiveAction('solution', solution.id, isArchived(solution))}
                          onMoveUp={() => moveAction('solution', solution.id, 'up')}
                          onMoveDown={() => moveAction('solution', solution.id, 'down')}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => browseFigure(solution)}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-bold text-primary hover:bg-slate-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Figure
                        </button>
                        {solution.figures.map((figure) => (
                          <button
                            key={figure.id}
                            type="button"
                            onClick={() => editFigure(solution, figure)}
                            className={cn('inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-bold', isArchived(figure) ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            {figure.number || figure.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>

          <aside ref={editPanelRef} className="min-w-0 space-y-4 lg:col-span-2 xl:col-span-3">
            {editTarget ? (
              <EditForm
                target={editTarget}
                chapter={activeChapter}
                section={activeSection}
                chapters={library.chapters}
                goals={library.goals}
                phases={library.phases}
                facilityUses={library.facilityUses}
                saving={saving}
                onChange={(target) => setEditTarget(target)}
                onSubmit={saveEdit}
                onCancel={() => setEditTarget(null)}
              />
            ) : (
              <LibraryTools
                goals={library.goals}
                phases={library.phases}
                facilityUses={library.facilityUses}
                onEdit={editSimple}
                onArchive={(resource, id, archived) => archiveAction(resource, id, archived)}
              />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function PanelHeader({ label, onAdd, disabled }: { label: string; onAdd: () => void; disabled?: boolean }) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-slate-50 px-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-white shadow-sm hover:bg-[#001d3d] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Plus className="h-4 w-4" />
        Add
      </button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm font-medium text-slate-400">{text}</div>;
}

function Badge({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', muted ? 'bg-slate-200 text-slate-500' : 'bg-amber-50 text-amber-700')}>
      {text}
    </span>
  );
}

function ListRow({
  title,
  meta,
  active,
  archived,
  compact,
  onSelect,
  onEdit,
  onArchive,
  onMoveUp,
  onMoveDown,
}: {
  title: string;
  meta: string;
  active?: boolean;
  archived?: boolean;
  compact?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className={cn('flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center', compact ? 'rounded-md bg-white px-2 py-2' : 'px-4 py-3', active && 'bg-primary/5', archived && 'opacity-65')}>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-bold text-slate-800">{title}</div>
        <div className="truncate text-xs font-medium text-slate-400">{meta}</div>
      </button>
      <RowActions archived={archived} onEdit={onEdit} onArchive={onArchive} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
    </div>
  );
}

function RowActions({
  archived,
  onEdit,
  onArchive,
  onMoveUp,
  onMoveDown,
}: {
  archived?: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const button = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-primary';
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <button type="button" className={button} onClick={onMoveUp} title="Move up" aria-label="Move up">
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" className={button} onClick={onMoveDown} title="Move down" aria-label="Move down">
        <ArrowDown className="h-4 w-4" />
      </button>
      <button type="button" className={button} onClick={onEdit} title="Edit" aria-label="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      <button type="button" className={button} onClick={onArchive} title={archived ? 'Restore' : 'Archive'} aria-label={archived ? 'Restore' : 'Archive'}>
        {archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
      </button>
    </div>
  );
}

function LibraryTools({
  goals,
  phases,
  facilityUses,
  onEdit,
  onArchive,
}: {
  goals: Goal[];
  phases: Phase[];
  facilityUses: FacilityUse[];
  onEdit: (resource: 'goal' | 'phase' | 'facilityUse', item?: Goal | Phase | FacilityUse) => void;
  onArchive: (resource: Resource, id: string, archived: boolean) => void;
}) {
  return (
    <div className="border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Goals, Phases, Facility Uses</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SimpleList title="Goals" items={goals.map((goal) => ({ id: goal.id, label: `${goal.abbr}: ${goal.text}`, archived: isArchived(goal), item: goal }))} onAdd={() => onEdit('goal')} onEdit={(item) => onEdit('goal', item as Goal)} onArchive={(id, archived) => onArchive('goal', id, archived)} />
        <SimpleList title="Phases" items={phases.map((phase) => ({ id: phase.id, label: phase.name, archived: isArchived(phase), item: phase }))} onAdd={() => onEdit('phase')} onEdit={(item) => onEdit('phase', item as Phase)} onArchive={(id, archived) => onArchive('phase', id, archived)} />
        <SimpleList title="Facility Uses" items={facilityUses.map((facilityUse) => ({ id: facilityUse.id, label: facilityUse.name, archived: isArchived(facilityUse), item: facilityUse }))} onAdd={() => onEdit('facilityUse')} onEdit={(item) => onEdit('facilityUse', item as FacilityUse)} onArchive={(id, archived) => onArchive('facilityUse', id, archived)} />
      </div>
    </div>
  );
}

function SimpleList({
  title,
  items,
  onAdd,
  onEdit,
  onArchive,
}: {
  title: string;
  items: Array<{ id: string; label: string; archived: boolean; item: unknown }>;
  onAdd: () => void;
  onEdit: (item: unknown) => void;
  onArchive: (id: string, archived: boolean) => void;
}) {
  return (
    <div className="rounded-md border border-slate-200">
      <div className="flex h-10 items-center justify-between border-b border-slate-100 px-3">
        <p className="text-xs font-bold text-slate-500">{title}</p>
        <button type="button" onClick={onAdd} className="text-primary hover:text-secondary" aria-label={`Add ${title}`}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className={cn('flex items-center gap-2 px-3 py-2', item.archived && 'opacity-60')}>
            <button type="button" onClick={() => onEdit(item.item)} className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-slate-700">
              {item.label}
            </button>
            <button type="button" onClick={() => onArchive(item.id, item.archived)} className="text-slate-400 hover:text-primary" aria-label={item.archived ? 'Restore' : 'Archive'}>
              {item.archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditForm({
  target,
  chapter,
  section,
  chapters,
  goals,
  phases,
  facilityUses,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  target: EditTarget;
  chapter?: Chapter;
  section?: Section;
  chapters: Chapter[];
  goals: Goal[];
  phases: Phase[];
  facilityUses: FacilityUse[];
  saving: boolean;
  onChange: (target: EditTarget) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {

  const item = target.item as any;
  const update = (patch: Record<string, unknown>) => onChange({ ...target, item: { ...target.item, ...patch } } as EditTarget);

  return (
    <form onSubmit={onSubmit} className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">{item.id ? 'Edit' : 'Create'}</p>
          <h2 className="text-xl font-bold capitalize text-primary">{target.resource}</h2>
        </div>
        <div className="flex gap-2 sm:justify-end">
          <button type="button" onClick={onCancel} className="h-10 flex-1 rounded-md border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 sm:flex-none">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-[#001d3d] disabled:bg-slate-300 sm:flex-none">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
      {target.resource === 'chapter' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {item.id && <Field label="Number" value={item.number} onChange={(value) => update({ number: value })} />}
          <Field label="Total credits" type="number" value={item.totalCredits} onChange={(value) => update({ totalCredits: value })} />
          <Field label="Title" value={item.title} onChange={(value) => update({ title: value })} wide />
        </div>
      )}

      {target.resource === 'section' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectField
              label="Chapter"
              value={item.chapterId || chapter?.id || ''}
              onChange={(value) => update(
                item.id
                  ? { chapterId: value }
                  : { chapterId: value, number: nextNumber(chapters.find((ch) => ch.id === value)?.sections || []) }
              )}
              options={chapters.map((ch) => ({ value: ch.id, label: `${ch.number} ${ch.title}` }))}
            />
            {item.id && <Field label="Number" value={item.number} onChange={(value) => update({ number: value })} />}
            <Field label="Total credits" type="number" value={item.totalCredits} onChange={(value) => update({ totalCredits: value })} />
            <Field label="Title" value={item.title} onChange={(value) => update({ title: value })} wide />
            <Field label="Min points 1" type="number" value={item.minPoints1} onChange={(value) => update({ minPoints1: value })} />
            <Field label="Min points 2" type="number" value={item.minPoints2} onChange={(value) => update({ minPoints2: value })} />
            <Field label="Min points 3" type="number" value={item.minPoints3} onChange={(value) => update({ minPoints3: value })} />
          </div>
          <TextArea label="Detailed instruction" value={item.detailedInstruction} onChange={(value) => update({ detailedInstruction: value })} />
          <CheckboxGroup
            label="Facility uses"
            values={(item.facilityUseIds || item.facilityUses?.map((facilityUse: FacilityUse) => facilityUse.id) || []) as string[]}
            options={facilityUses.map((facilityUse) => ({ value: facilityUse.id, label: facilityUse.name }))}
            onChange={(values) => update({ facilityUseIds: values })}
          />
        </div>
      )}

      {target.resource === 'subSection' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Section"
            value={item.sectionId || section?.id || ''}
            onChange={(value) => update(
              item.id
                ? { sectionId: value }
                : { sectionId: value, number: nextNumber(chapters.flatMap((ch) => ch.sections).find((sec) => sec.id === value)?.subSections || []) }
            )}
            options={chapters.flatMap((ch) => ch.sections.map((sec) => ({ value: sec.id, label: `${ch.number}.${sec.number} ${sec.title}` })))}
          />
          {item.id && <Field label="Number" value={item.number} onChange={(value) => update({ number: value })} />}
          <Field label="Total credits" type="number" value={item.totalCredits} onChange={(value) => update({ totalCredits: value })} />
          <Field label="Title" value={item.title} onChange={(value) => update({ title: value })} wide />
        </div>
      )}

      {target.resource === 'solution' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            <SelectField
              label="Section"
              value={item.sectionId || section?.id || ''}
              onChange={(value) => {
                const nextSection = chapters.flatMap((ch) => ch.sections).find((sec) => sec.id === value);
                const nextChapter = chapters.find((ch) => ch.sections.some((sec) => sec.id === value));
                update(
                  item.id
                    ? { sectionId: value, subSectionId: '' }
                    : { sectionId: value, subSectionId: '', standardNumber: nextSolutionNumber(nextChapter, nextSection) }
                );
              }}
              options={chapters.flatMap((ch) => ch.sections.map((sec) => ({ value: sec.id, label: `${ch.number}.${sec.number} ${sec.title}` })))}
            />
            <SelectField label="Subsection" value={item.subSectionId || ''} onChange={(value) => update({ subSectionId: value })} options={[{ value: '', label: 'None' }, ...(chapters.flatMap((ch) => ch.sections).find((sec) => sec.id === (item.sectionId || section?.id))?.subSections || []).map((sub) => ({ value: sub.id, label: `${sub.number} ${sub.title}` }))]} />
            <Field label="Standard number" value={item.standardNumber} onChange={(value) => update({ standardNumber: value })} helperText={!item.id ? 'Auto-suggested — adjust if needed' : undefined} />
            <Field label="Reference ID" value={item.refId} onChange={(value) => update({ refId: value })} />
            <Field label="Points" type="number" value={item.points} onChange={(value) => update({ points: value })} />
            <label className="flex h-10 items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={Boolean(item.isMandatory)} onChange={(event) => update({ isMandatory: event.target.checked })} className="h-4 w-4 accent-primary" />
              Required
            </label>
          </div>
          <TextArea label="Solution text" value={item.text} onChange={(value) => update({ text: value })} minHeightClass="min-h-44" />
          {item.id && (
            <TextArea label="Instruction" value={item.instruction} onChange={(value) => update({ instruction: value })} minHeightClass="min-h-36" />
          )}
          <CheckboxGroup label="Applicable Goals" values={(item.goalIds || []) as string[]} options={goals.map((goal) => ({ value: goal.id, label: `${goal.abbr}: ${goal.text}` }))} onChange={(values) => update({ goalIds: values })} />
          <CheckboxGroup label="Applicable Phases" values={(item.phaseIds || []) as string[]} options={phases.map((phase) => ({ value: phase.id, label: phase.name }))} onChange={(values) => update({ phaseIds: values })} />
        </div>
      )}

      {target.resource === 'figure' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Solution" value={item.solutionId || ''} onChange={(value) => update({ solutionId: value })} options={chapters.flatMap((ch) => ch.sections.flatMap((sec) => sec.solutions.map((solution) => ({ value: solution.id, label: `${solution.standardNumber} ${solution.text.slice(0, 50)}` }))))} />
          <Field label="Label" value={item.label} onChange={(value) => update({ label: value })} />
          <Field label="Figure number" value={item.number} onChange={(value) => update({ number: value })} />
          <Field label="URL/path" value={item.url} onChange={(value) => update({ url: value })} />
          <Field label="Caption" value={item.caption} onChange={(value) => update({ caption: value })} wide />
          <Field label="Alt text" value={item.altTag} onChange={(value) => update({ altTag: value })} wide />
        </div>
      )}

      {target.resource === 'goal' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Abbreviation" value={item.abbr} onChange={(value) => update({ abbr: value })} />
          <Field label="Text" value={item.text} onChange={(value) => update({ text: value })} wide />
        </div>
      )}

      {target.resource === 'phase' && <Field label="Name" value={item.name} onChange={(value) => update({ name: value })} />}
      {target.resource === 'facilityUse' && <Field label="Name" value={item.name} onChange={(value) => update({ name: value })} />}
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text', wide, disabled, helperText }: { label: string; value: unknown; onChange: (value: string) => void; type?: string; wide?: boolean; disabled?: boolean; helperText?: string }) {
  return (
    <label className={cn('block', wide && 'sm:col-span-2')}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <input
        type={type}
        value={textValue(value)}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={cn(inputClass(), disabled && 'cursor-not-allowed bg-slate-50 text-slate-500')}
      />
      {helperText && <span className="mt-1 block text-xs font-medium text-slate-400">{helperText}</span>}
    </label>
  );
}

function TextArea({ label, value, onChange, minHeightClass = 'min-h-24' }: { label: string; value: unknown; onChange: (value: string) => void; minHeightClass?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <textarea value={textValue(value)} onChange={(event) => onChange(event.target.value)} className={cn(textareaClass(), minHeightClass)} />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass()}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxGroup({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: Array<{ value: string; label: string }>;
  onChange: (values: string[]) => void;
}) {
  const selected = new Set(values);
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-start gap-2 rounded bg-white p-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-100">
            <input
              type="checkbox"
              checked={selected.has(option.value)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(option.value);
                else next.delete(option.value);
                onChange([...next]);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
