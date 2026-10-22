'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
} from 'lucide-react';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

type HeadingLevel = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
type SolutionStatus = 'DRAFT' | 'FINAL' | 'PUBLISHED';

type Lookup = { id: string; name: string; archivedAt: string | null };
type Goal = { id: string; abbr: string; text: string; archivedAt: string | null };
type Category = { id: string; name: string; description: string | null; archivedAt: string | null };

type Figure = {
  id: string;
  solutionId: string;
  slot: string;
  number: string | null;
  caption: string | null;
  altTag: string | null;
  status: string | null;
  url: string | null;
  archivedAt: string | null;
};

type Solution = {
  id: string;
  headingId: string;
  refNumber: number | null;
  v1StandardNumber: string | null;
  v2Number: string | null;
  sortOrder: number;
  text: string;
  status: SolutionStatus;
  naBox: boolean;
  required: boolean;
  points: number;
  instructionSubpart: number | null;
  instruction: string | null;
  archivedAt: string | null;
  goals: Goal[];
  phases: Lookup[];
  categories: Category[];
  facilityUseTypes: Lookup[];
  figures: Figure[];
};

type Heading = {
  id: string;
  level: HeadingLevel;
  parentId: string | null;
  v1Number: string | null;
  v2Number: string | null;
  title: string;
  credits: number | null;
  maxCredits: number | null;
  itemCount: number | null;
  minPoints1: number | null;
  minPoints2: number | null;
  minPoints3: number | null;
  minPercent1: number | null;
  minPercent2: number | null;
  minPercent3: number | null;
  instruction: string | null;
  designResource: string | null;
  detailedInstruction: string | null;
  sortOrder: number;
  archivedAt: string | null;
  facilityUseTypes: Lookup[];
};

type LibraryData = {
  headings: Heading[];
  solutions: Solution[];
  goals: Goal[];
  phases: Lookup[];
  categories: Category[];
  facilityUseTypes: Lookup[];
};

type Resource = 'heading' | 'solution' | 'figure' | 'goal' | 'phase' | 'category' | 'facilityUseType';

type EditTarget =
  | { resource: 'heading'; item: Partial<Heading> & { facilityUseTypeIds?: string[] } }
  | { resource: 'solution'; item: Partial<Solution> & { goalIds?: string[]; phaseIds?: string[]; categoryIds?: string[]; facilityUseTypeIds?: string[] } }
  | { resource: 'figure'; item: Partial<Figure> }
  | { resource: 'goal'; item: Partial<Goal> }
  | { resource: 'phase'; item: Partial<Lookup> }
  | { resource: 'category'; item: Partial<Category> }
  | { resource: 'facilityUseType'; item: Partial<Lookup> };

const emptyLibrary: LibraryData = { headings: [], solutions: [], goals: [], phases: [], categories: [], facilityUseTypes: [] };

const LEVEL_ORDER: HeadingLevel[] = ['H1', 'H2', 'H3', 'H4', 'H5'];

function nextLevel(level: HeadingLevel): HeadingLevel {
  const index = LEVEL_ORDER.indexOf(level);
  return LEVEL_ORDER[Math.min(index + 1, LEVEL_ORDER.length - 1)];
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
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

export default function AdminDb2Client() {
  const [library, setLibrary] = useState<LibraryData>(emptyLibrary);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const editPanelRef = useRef<HTMLDivElement | null>(null);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Heading[]>();
    for (const heading of library.headings) {
      const key = heading.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(heading);
    }
    for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  }, [library.headings]);

  const solutionsByHeading = useMemo(() => {
    const map = new Map<string, Solution[]>();
    for (const solution of library.solutions) {
      if (!map.has(solution.headingId)) map.set(solution.headingId, []);
      map.get(solution.headingId)!.push(solution);
    }
    for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  }, [library.solutions]);

  const headingById = useMemo(() => new Map(library.headings.map((h) => [h.id, h])), [library.headings]);
  const activeHeading = headingById.get(activeHeadingId);
  const activeSolutions = activeHeading ? solutionsByHeading.get(activeHeading.id) || [] : [];

  const matchesQuery = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return null;
    const matchedHeadingIds = new Set<string>();
    for (const heading of library.headings) {
      if (heading.title.toLowerCase().includes(term)) matchedHeadingIds.add(heading.id);
    }
    for (const solution of library.solutions) {
      if (solution.text.toLowerCase().includes(term)) matchedHeadingIds.add(solution.headingId);
    }
    // Also include ancestors of any match, so the tree can show a path to it.
    const withAncestors = new Set(matchedHeadingIds);
    for (const id of matchedHeadingIds) {
      let current = headingById.get(id);
      while (current?.parentId) {
        withAncestors.add(current.parentId);
        current = headingById.get(current.parentId);
      }
    }
    return withAncestors;
  }, [query, library.headings, library.solutions, headingById]);

  async function loadLibrary(nextShowArchived = showArchived) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/db2?showArchived=${nextShowArchived ? 'true' : 'false'}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load DB 2.0 library');
      setLibrary(data);
      setActiveHeadingId((current) => (data.headings.some((h: Heading) => h.id === current) ? current : data.headings.find((h: Heading) => !h.parentId)?.id || ''));
      setExpandedIds((current) => {
        if (current.size > 0) return current;
        return new Set(data.headings.filter((h: Heading) => !h.parentId).map((h: Heading) => h.id));
      });
    } catch (err: any) {
      setError(err.message || 'Unable to load DB 2.0 library');
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
      const response = await fetch('/api/admin/db2', {
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

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function editHeading(heading?: Heading, parent?: Heading) {
    setEditTarget({
      resource: 'heading',
      item: heading
        ? { ...heading, facilityUseTypeIds: heading.facilityUseTypes.map((f) => f.id) }
        : { level: parent ? nextLevel(parent.level) : 'H1', parentId: parent?.id || null, title: '' },
    });
  }

  function editSolution(solution?: Solution) {
    setEditTarget({
      resource: 'solution',
      item: solution
        ? {
            ...solution,
            goalIds: solution.goals.map((g) => g.id),
            phaseIds: solution.phases.map((p) => p.id),
            categoryIds: solution.categories.map((c) => c.id),
            facilityUseTypeIds: solution.facilityUseTypes.map((f) => f.id),
          }
        : { headingId: activeHeading?.id || '', text: '', status: 'DRAFT', points: 0 },
    });
  }

  function editFigure(solution: Solution, figure?: Figure) {
    setEditTarget({ resource: 'figure', item: figure || { solutionId: solution.id, slot: 'A' } });
  }

  function archiveAction(resource: Resource, id: string, archived: boolean) {
    apiAction('POST', { resource, action: archived ? 'restore' : 'archive', id }, archived ? 'Restored' : 'Archived');
  }

  function moveAction(resource: Resource, id: string, direction: 'up' | 'down') {
    apiAction('POST', { resource, action: 'move', id, direction }, 'Reordered');
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    const { resource, item } = editTarget;
    const id = (item as any).id as string | undefined;
    const method = id ? 'PATCH' : 'POST';
    const body: Record<string, unknown> = id
      ? { resource, id, data: item }
      : { resource, action: 'create', data: item };
    apiAction(method, body, id ? 'Saved' : 'Created');
  }

  if (loading && library.headings.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm font-bold text-slate-500">Loading DB 2.0 library</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-12">
      <Breadcrumbs
        items={[
          { label: 'My Projects', href: '/' },
          { label: 'Admin Dashboard', href: '/admin/edit-solutions' },
          { label: 'DB 2.0' },
        ]}
      />

      <div className="border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-secondary">Admin Dashboard</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-primary">DB 2.0</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search headings and solutions"
                className="h-10 w-72 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-800 outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/25"
              />
            </div>
            <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-600">
              <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="h-4 w-4 accent-primary" />
              Show archived
            </label>
          </div>
        </div>
        {message && <p className="mt-3 text-sm font-bold text-emerald-600">{message}</p>}
        {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(360px,1fr)_minmax(460px,1.3fr)]">
        <aside className="min-w-0 border border-slate-200 bg-white shadow-sm">
          <PanelHeader label="Headings" onAdd={() => editHeading()} />
          <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-100 2xl:max-h-[760px]">
            {(childrenByParent.get(null) || []).length === 0 ? (
              <EmptyState text="No headings yet. Add an H1 to get started." />
            ) : (
              (childrenByParent.get(null) || []).map((heading) => (
                <HeadingNode
                  key={heading.id}
                  heading={heading}
                  depth={0}
                  childrenByParent={childrenByParent}
                  solutionsByHeading={solutionsByHeading}
                  activeHeadingId={activeHeadingId}
                  expandedIds={expandedIds}
                  matchesQuery={matchesQuery}
                  onToggleExpand={toggleExpand}
                  onSelect={setActiveHeadingId}
                  onEdit={editHeading}
                  onAddChild={(parent) => editHeading(undefined, parent)}
                  onArchive={(id, archived) => archiveAction('heading', id, archived)}
                  onMoveUp={(id) => moveAction('heading', id, 'up')}
                  onMoveDown={(id) => moveAction('heading', id, 'down')}
                />
              ))
            )}
          </div>
        </aside>

        <section className="min-w-0 border border-slate-200 bg-white shadow-sm">
          <PanelHeader label={activeHeading ? `Solutions — ${activeHeading.level} ${activeHeading.title}` : 'Solutions'} onAdd={() => editSolution()} disabled={!activeHeading} />
          {!activeHeading ? (
            <EmptyState text="Select a heading to manage its solutions." />
          ) : activeSolutions.length === 0 ? (
            <EmptyState text="No solutions directly on this heading yet." />
          ) : (
            <div className="max-h-[640px] overflow-y-auto divide-y divide-slate-100 2xl:max-h-[760px]">
              {activeSolutions.map((solution) => (
                <div key={solution.id} className={cn('p-4', isArchived(solution) && 'bg-slate-50 opacity-70')}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button type="button" onClick={() => editSolution(solution)} className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        {solution.v2Number && <span className="font-mono text-xs font-bold text-secondary">{solution.v2Number}</span>}
                        {solution.v1StandardNumber && <span className="font-mono text-[11px] font-medium text-slate-400" title="1.0 number">(was {solution.v1StandardNumber})</span>}
                        <Badge text={solution.status} muted={solution.status !== 'PUBLISHED'} />
                        {solution.required && <Badge text="Required" />}
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
                      onClick={() => editFigure(solution)}
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
                        {figure.slot}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div ref={editPanelRef}>
        {editTarget && (
          <EditForm
            target={editTarget}
            headings={library.headings}
            goals={library.goals}
            phases={library.phases}
            categories={library.categories}
            facilityUseTypes={library.facilityUseTypes}
            saving={saving}
            onChange={setEditTarget}
            onSubmit={handleSubmit}
            onCancel={() => setEditTarget(null)}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SimpleList
          title="Goals"
          items={library.goals.map((goal) => ({ id: goal.id, label: `${goal.abbr}: ${goal.text}`, archived: isArchived(goal), item: goal }))}
          onAdd={() => setEditTarget({ resource: 'goal', item: {} })}
          onEdit={(item) => setEditTarget({ resource: 'goal', item: item as Goal })}
          onArchive={(id, archived) => archiveAction('goal', id, archived)}
        />
        <SimpleList
          title="Phases"
          items={library.phases.map((phase) => ({ id: phase.id, label: phase.name, archived: isArchived(phase), item: phase }))}
          onAdd={() => setEditTarget({ resource: 'phase', item: {} })}
          onEdit={(item) => setEditTarget({ resource: 'phase', item: item as Lookup })}
          onArchive={(id, archived) => archiveAction('phase', id, archived)}
        />
        <SimpleList
          title="Categories"
          items={library.categories.map((category) => ({ id: category.id, label: category.name, archived: isArchived(category), item: category }))}
          onAdd={() => setEditTarget({ resource: 'category', item: {} })}
          onEdit={(item) => setEditTarget({ resource: 'category', item: item as Category })}
          onArchive={(id, archived) => archiveAction('category', id, archived)}
        />
        <SimpleList
          title="Facility Use Types"
          items={library.facilityUseTypes.map((facility) => ({ id: facility.id, label: facility.name, archived: isArchived(facility), item: facility }))}
          onAdd={() => setEditTarget({ resource: 'facilityUseType', item: {} })}
          onEdit={(item) => setEditTarget({ resource: 'facilityUseType', item: item as Lookup })}
          onArchive={(id, archived) => archiveAction('facilityUseType', id, archived)}
        />
      </div>
    </div>
  );
}

function HeadingNode({
  heading,
  depth,
  childrenByParent,
  solutionsByHeading,
  activeHeadingId,
  expandedIds,
  matchesQuery,
  onToggleExpand,
  onSelect,
  onEdit,
  onAddChild,
  onArchive,
  onMoveUp,
  onMoveDown,
}: {
  heading: Heading;
  depth: number;
  childrenByParent: Map<string | null, Heading[]>;
  solutionsByHeading: Map<string, Solution[]>;
  activeHeadingId: string;
  expandedIds: Set<string>;
  matchesQuery: Set<string> | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onEdit: (heading: Heading) => void;
  onAddChild: (heading: Heading) => void;
  onArchive: (id: string, archived: boolean) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  if (matchesQuery && !matchesQuery.has(heading.id)) return null;

  const children = childrenByParent.get(heading.id) || [];
  const isExpanded = expandedIds.has(heading.id);
  const isActive = activeHeadingId === heading.id;
  const solutionCount = (solutionsByHeading.get(heading.id) || []).length;
  const archived = Boolean(heading.archivedAt);

  return (
    <div>
      <div className={cn('flex items-center gap-1 py-2 pr-3', archived && 'opacity-60')} style={{ paddingLeft: 8 + depth * 20 }}>
        {children.length > 0 ? (
          <button type="button" onClick={() => onToggleExpand(heading.id)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100">
            <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(heading.id)}
          className={cn('min-w-0 flex-1 truncate rounded-sm px-2 py-1 text-left text-sm', isActive ? 'bg-primary/10 font-bold text-primary' : 'font-medium text-slate-700 hover:bg-slate-50')}
        >
          <span className="mr-2 text-[10px] font-bold uppercase text-slate-400">{heading.level}</span>
          {heading.title}
          {solutionCount > 0 && <span className="ml-2 text-xs font-normal text-slate-400">({solutionCount})</span>}
        </button>
        <button type="button" onClick={() => onAddChild(heading)} title="Add child heading" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-primary">
          <Plus className="h-3.5 w-3.5" />
        </button>
        <RowActions
          archived={archived}
          onEdit={() => onEdit(heading)}
          onArchive={() => onArchive(heading.id, archived)}
          onMoveUp={() => onMoveUp(heading.id)}
          onMoveDown={() => onMoveDown(heading.id)}
        />
      </div>
      {isExpanded && children.map((child) => (
        <HeadingNode
          key={child.id}
          heading={child}
          depth={depth + 1}
          childrenByParent={childrenByParent}
          solutionsByHeading={solutionsByHeading}
          activeHeadingId={activeHeadingId}
          expandedIds={expandedIds}
          matchesQuery={matchesQuery}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onArchive={onArchive}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      ))}
    </div>
  );
}

function PanelHeader({ label, onAdd, disabled }: { label: string; onAdd: () => void; disabled?: boolean }) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-slate-50 px-4">
      <p className="truncate text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-white shadow-sm hover:bg-[#001d3d] disabled:cursor-not-allowed disabled:bg-slate-300"
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
  const button = 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-primary';
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" className={button} onClick={onMoveUp} title="Move up" aria-label="Move up">
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={button} onClick={onMoveDown} title="Move down" aria-label="Move down">
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={button} onClick={onEdit} title="Edit" aria-label="Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={button} onClick={onArchive} title={archived ? 'Restore' : 'Archive'} aria-label={archived ? 'Restore' : 'Archive'}>
        {archived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
      </button>
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
        {items.length === 0 && <div className="px-3 py-3 text-xs font-medium text-slate-400">None yet.</div>}
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
  headings,
  goals,
  phases,
  categories,
  facilityUseTypes,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  target: EditTarget;
  headings: Heading[];
  goals: Goal[];
  phases: Lookup[];
  categories: Category[];
  facilityUseTypes: Lookup[];
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
        {target.resource === 'heading' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SelectField label="Level" value={item.level || 'H1'} onChange={(value) => update({ level: value })} options={LEVEL_ORDER.map((lvl) => ({ value: lvl, label: lvl }))} />
              <SelectField
                label="Parent heading"
                value={item.parentId || ''}
                onChange={(value) => update({ parentId: value || null })}
                options={[{ value: '', label: 'None (top level)' }, ...headings.filter((h) => h.id !== item.id).map((h) => ({ value: h.id, label: `${h.level} — ${h.title}` }))]}
              />
              <Field label="Title" value={item.title} onChange={(value) => update({ title: value })} wide />
              <Field label="v1 number" value={item.v1Number} onChange={(value) => update({ v1Number: value })} />
              <Field label="v2 number" value={item.v2Number} onChange={(value) => update({ v2Number: value })} />
              <Field label="Credits" type="number" value={item.credits} onChange={(value) => update({ credits: value })} />
              <Field label="Max credits" type="number" value={item.maxCredits} onChange={(value) => update({ maxCredits: value })} />
              <Field label="Item count" type="number" value={item.itemCount} onChange={(value) => update({ itemCount: value })} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Min points 1" type="number" value={item.minPoints1} onChange={(value) => update({ minPoints1: value })} />
              <Field label="Min points 2" type="number" value={item.minPoints2} onChange={(value) => update({ minPoints2: value })} />
              <Field label="Min points 3" type="number" value={item.minPoints3} onChange={(value) => update({ minPoints3: value })} />
              <Field label="Min percent 1" type="number" value={item.minPercent1} onChange={(value) => update({ minPercent1: value })} />
              <Field label="Min percent 2" type="number" value={item.minPercent2} onChange={(value) => update({ minPercent2: value })} />
              <Field label="Min percent 3" type="number" value={item.minPercent3} onChange={(value) => update({ minPercent3: value })} />
            </div>
            <TextArea label="Instruction" value={item.instruction} onChange={(value) => update({ instruction: value })} />
            <TextArea label="Detailed instruction" value={item.detailedInstruction} onChange={(value) => update({ detailedInstruction: value })} />
            <Field label="Design resource" value={item.designResource} onChange={(value) => update({ designResource: value })} wide />
            <CheckboxGroup
              label="Facility use types"
              values={(item.facilityUseTypeIds || []) as string[]}
              options={facilityUseTypes.map((f) => ({ value: f.id, label: f.name }))}
              onChange={(values) => update({ facilityUseTypeIds: values })}
            />
          </div>
        )}

        {target.resource === 'solution' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              <SelectField
                label="Heading"
                value={item.headingId || ''}
                onChange={(value) => update({ headingId: value })}
                options={headings.map((h) => ({ value: h.id, label: `${h.level} — ${h.title}` }))}
              />
              <SelectField label="Status" value={item.status || 'DRAFT'} onChange={(value) => update({ status: value })} options={[{ value: 'DRAFT', label: 'Draft' }, { value: 'FINAL', label: 'Final' }, { value: 'PUBLISHED', label: 'Published' }]} />
              <Field label="v2 number (new)" value={item.v2Number} onChange={(value) => update({ v2Number: value })} />
              <Field label="v1 standard number (old)" value={item.v1StandardNumber} onChange={(value) => update({ v1StandardNumber: value })} />
              <Field label="Ref number" type="number" value={item.refNumber} onChange={(value) => update({ refNumber: value })} />
              <Field label="Points" type="number" value={item.points} onChange={(value) => update({ points: value })} />
              <Field label="Instruction subpart" type="number" value={item.instructionSubpart} onChange={(value) => update({ instructionSubpart: value })} />
              <label className="flex h-10 items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={Boolean(item.required)} onChange={(event) => update({ required: event.target.checked })} className="h-4 w-4 accent-primary" />
                Required
              </label>
              <label className="flex h-10 items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={Boolean(item.naBox)} onChange={(event) => update({ naBox: event.target.checked })} className="h-4 w-4 accent-primary" />
                N/A box available
              </label>
            </div>
            <TextArea label="Solution text" value={item.text} onChange={(value) => update({ text: value })} minHeightClass="min-h-32" />
            <TextArea label="Instruction" value={item.instruction} onChange={(value) => update({ instruction: value })} />
            <CheckboxGroup label="Goals" values={(item.goalIds || []) as string[]} options={goals.map((goal) => ({ value: goal.id, label: `${goal.abbr}: ${goal.text}` }))} onChange={(values) => update({ goalIds: values })} />
            <CheckboxGroup label="Phases" values={(item.phaseIds || []) as string[]} options={phases.map((phase) => ({ value: phase.id, label: phase.name }))} onChange={(values) => update({ phaseIds: values })} />
            <CheckboxGroup label="Categories" values={(item.categoryIds || []) as string[]} options={categories.map((category) => ({ value: category.id, label: category.name }))} onChange={(values) => update({ categoryIds: values })} />
            <CheckboxGroup label="Facility use types" values={(item.facilityUseTypeIds || []) as string[]} options={facilityUseTypes.map((f) => ({ value: f.id, label: f.name }))} onChange={(values) => update({ facilityUseTypeIds: values })} />
          </div>
        )}

        {target.resource === 'figure' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Slot" value={item.slot || 'A'} onChange={(value) => update({ slot: value })} options={['A', 'B', 'C', 'D'].map((slot) => ({ value: slot, label: slot }))} />
            <Field label="Figure number" value={item.number} onChange={(value) => update({ number: value })} />
            <Field label="URL/path" value={item.url} onChange={(value) => update({ url: value })} />
            <Field label="Status" value={item.status} onChange={(value) => update({ status: value })} />
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
        {target.resource === 'facilityUseType' && <Field label="Name" value={item.name} onChange={(value) => update({ name: value })} wide />}

        {target.resource === 'category' && (
          <div className="space-y-4">
            <Field label="Name" value={item.name} onChange={(value) => update({ name: value })} wide />
            <TextArea label="Description" value={item.description} onChange={(value) => update({ description: value })} />
          </div>
        )}
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text', wide, helperText }: { label: string; value: unknown; onChange: (value: string) => void; type?: string; wide?: boolean; helperText?: string }) {
  return (
    <label className={cn('block', wide && 'sm:col-span-2')}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <input type={type} value={textValue(value)} onChange={(event) => onChange(event.target.value)} className={inputClass()} />
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
        {options.length === 0 && <p className="text-xs font-medium text-slate-400">None yet.</p>}
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
              className="mt-0.5 h-3.5 w-3.5 accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
