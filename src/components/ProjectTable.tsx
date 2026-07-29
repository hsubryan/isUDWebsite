'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Search, Plus, Info, ChevronLeft, ChevronRight, AlertTriangle, Check, X, Loader2, BookOpen } from 'lucide-react';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { getCached, setCached } from '@/lib/clientCache';

const PROJECTS_CACHE_KEY = 'projects:list';

const tableHeaders = ['Name', 'Owner', 'Status', 'Date', 'Score'];

function formatProjectDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const projectStatusLabels: Record<string, string> = {
  ONGOING: 'Ongoing',
  IN_REVIEW: 'Submitted',
  COMPLETED: 'Certified',
  INACTIVE: 'Inactive',
};

function ScoreCircle({ score, size = 44 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100) / 100;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth="5" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F7941D"
          strokeWidth="5"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-xs font-extrabold text-primary">{Math.round(score)}</span>
    </div>
  );
}

function getDisplayScore(project: any) {
  return project.scorePercentage ?? ((project.totalEarned || project.score || 0) + (project.bonus || 0));
}

const tableColumnClass = 'grid-cols-[minmax(200px,1fr)_minmax(160px,1fr)_140px_160px_100px]';
const primaryLinkClass = 'inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-sm transition-all duration-200 hover:bg-[#002855] focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 active:scale-95';
const accentLinkClass = 'inline-flex items-center justify-center gap-2 rounded-sm bg-accent px-5 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-sm transition-all duration-200 hover:bg-[#d97c0c] focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 active:scale-95';

export default function ProjectTable() {
  const { data: session } = useSession();
  const cachedProjects = getCached<any[]>(PROJECTS_CACHE_KEY);
  const [projects, setProjects] = useState<any[]>(cachedProjects || []);
  const [isLoading, setIsLoading] = useState(!cachedProjects);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('date');
  const [filterBy, setFilterBy] = useState('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'MINE' | 'SHARED'>('ALL');
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const PROJECTS_PER_PAGE = 25;

  const fetchProjects = useCallback(async () => {
    try {
      setFetchError(null);
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`Failed to load projects (${response.status})`);
      }
      const data = await response.json();
      setProjects(data);
      setCached(PROJECTS_CACHE_KEY, data);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      // Only surface the error if we have nothing cached to fall back on.
      if (!getCached(PROJECTS_CACHE_KEY)) {
        setFetchError(error.message || 'Failed to load projects. Please refresh the page.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    window.addEventListener('team-invitation-accepted', fetchProjects);
    return () => window.removeEventListener('team-invitation-accepted', fetchProjects);
  }, [fetchProjects]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filterBy, sortBy, ownershipFilter]);

  const handleAcceptInvite = async (projectId: string) => {
    setProcessingInviteId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}/team`, { method: 'PATCH' });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('team-invitation-accepted', { detail: { projectId } }));
        await fetchProjects();
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
    } finally {
      setProcessingInviteId(null);
    }
  };

  const handleDeclineInvite = async (projectId: string, memberId: string) => {
    if (!window.confirm('Decline this project invitation?')) return;
    setProcessingInviteId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}/team?memberId=${memberId}`, { method: 'DELETE' });
      if (res.ok) await fetchProjects();
    } catch (error) {
      console.error('Error declining invitation:', error);
    } finally {
      setProcessingInviteId(null);
    }
  };

  const isEmpty = projects.length === 0;
  const visibleProjects = useMemo(() => {
    const search = query.trim().toLowerCase();

    return projects
      .filter((project) => {
        const statusMatch = filterBy === 'ALL' || project.status === filterBy;
        const ownershipMatch =
          ownershipFilter === 'ALL' ||
          (ownershipFilter === 'MINE' && project.relationship === 'owner') ||
          (ownershipFilter === 'SHARED' && (project.relationship === 'shared' || project.relationship === 'pending'));
        const searchMatch =
          !search ||
          project.projectName?.toLowerCase().includes(search) ||
          project.accountOwnerName?.toLowerCase().includes(search) ||
          String(project.projectNumber || '').includes(search);

        return statusMatch && ownershipMatch && searchMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return (a.projectName || '').localeCompare(b.projectName || '');
        if (sortBy === 'score') {
          // Sort by the same value shown in the score circle, not the raw
          // credit total, since those can rank differently.
          return getDisplayScore(b) - getDisplayScore(a);
        }
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [projects, filterBy, ownershipFilter, query, sortBy]);

  const totalPages = Math.ceil(visibleProjects.length / PROJECTS_PER_PAGE);
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * PROJECTS_PER_PAGE;
    return visibleProjects.slice(startIndex, startIndex + PROJECTS_PER_PAGE);
  }, [visibleProjects, currentPage]);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 2) {
        end = 4;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 3;
      }
      
      if (start > 2) {
        pages.push('...');
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const newProjectHref = session ? '/projects/new' : '/register?callbackUrl=/projects/new';
  const newProjectLabel = session ? 'Add Project' : 'Create Account to Start Project';
  const emptyProjectLabel = session ? 'Start a Project' : 'Create Account to Start Project';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Page Title Bar */}
      <div className="bg-white border border-slate-200 rounded-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <h1 className="text-xl font-bold text-primary tracking-tight">My Projects</h1>
        <div className="flex items-center gap-1 rounded-sm border border-slate-200 bg-slate-50 p-1">
          {([
            { value: 'ALL', label: 'All Projects' },
            { value: 'MINE', label: 'My Projects' },
            { value: 'SHARED', label: 'Shared Projects' },
          ] as const).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setOwnershipFilter(tab.value)}
              className={`rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                ownershipFilter === tab.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-500 hover:bg-white hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link href={newProjectHref} className={primaryLinkClass}>
            <Plus size={18} aria-hidden="true" />
            {newProjectLabel}
          </Link>
          
          <Link href="/solutions" className={accentLinkClass}>
            <BookOpen size={18} aria-hidden="true" />
            Browse Solutions
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-4">
          <label className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              suppressHydrationWarning
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="h-9 w-48 rounded-sm border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-primary outline-none transition-all focus:border-secondary focus:ring-2 focus:ring-secondary/30"
            />
          </label>
          <div className="flex items-center gap-3">
            <label htmlFor="project-sort" className="text-sm font-bold text-muted uppercase tracking-wider">Sort By</label>
            <select
              id="project-sort"
              suppressHydrationWarning
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="bg-white border border-slate-200 rounded-sm px-4 py-2 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary focus:border-secondary transition-all outline-none"
            >
              <option value="date">Date created</option>
              <option value="name">Name</option>
              <option value="score">Score</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="project-filter" className="text-sm font-bold text-muted uppercase tracking-wider">Filter By</label>
            <select
              id="project-filter"
              suppressHydrationWarning
              value={filterBy}
              onChange={(event) => setFilterBy(event.target.value)}
              className="bg-white border border-slate-200 rounded-sm px-4 py-2 text-sm font-medium text-primary focus:ring-2 focus:ring-secondary focus:border-secondary transition-all outline-none"
            >
              <option value="ALL">All</option>
              <option value="ONGOING">Ongoing</option>
              <option value="IN_REVIEW">Submitted</option>
              <option value="COMPLETED">Certified</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
        <div className={`grid ${tableColumnClass} min-w-[900px] border-b border-slate-100 bg-slate-50/50`}>
          {tableHeaders.map((header, index) => (
            <div key={header} className={`px-6 py-4 text-xs font-bold text-muted uppercase tracking-widest ${index < 2 ? 'text-left' : 'text-center'}`}>
              {header}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Loading Projects...</p>
          </div>
        ) : fetchError ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4 text-center px-6">
            <p className="text-base font-semibold text-red-600">{fetchError}</p>
            <button
              onClick={fetchProjects}
              className="text-sm font-medium text-primary underline underline-offset-2 hover:text-secondary"
            >
              Try again
            </button>
          </div>
        ) : isEmpty ? (
          <div className="py-24 flex flex-col items-center text-center space-y-12">
            <div className="space-y-2">
              <h2 className="text-xl font-medium text-slate-800">
                Thank you for creating an isUD account.
              </h2>
              <p className="text-lg text-[#F7941D] font-bold tracking-tight italic">
                The path to certification is easy!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              <Link href="/solutions" className={accentLinkClass}>
                <BookOpen size={20} className="opacity-70" aria-hidden="true" />
                Browse Solutions
              </Link>
              <Link href={newProjectHref} className={primaryLinkClass}>
                <Plus size={22} className="opacity-70" aria-hidden="true" />
                {emptyProjectLabel}
              </Link>
            </div>


            <Link href="/guide" className={primaryLinkClass}>
               <Info size={18} className="opacity-70" aria-hidden="true" />
               Learn how it works!
            </Link>

          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <p className="text-sm font-bold text-slate-700 uppercase tracking-widest">No Matching Projects</p>
            <p className="text-sm text-slate-500">Adjust the search, sort, or status filter.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[900px] divide-y divide-slate-100">
                {paginatedProjects.map((project) => (
                  project.relationship === 'pending' ? (
                    <div key={project.id} className="flex flex-wrap items-center justify-between gap-4 bg-amber-50/60 px-6 py-4">
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={18} className="shrink-0 text-amber-600" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-bold text-slate-800">{project.projectName}</p>
                          <p className="text-xs font-medium text-amber-700">Pending invitation &mdash; accept or decline to continue</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAcceptInvite(project.id)}
                          disabled={processingInviteId === project.id}
                          className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-1.5 text-xs font-bold text-white transition-all hover:bg-[#92400e] disabled:opacity-50"
                        >
                          {processingInviteId === project.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeclineInvite(project.id, project.pendingMemberId)}
                          disabled={processingInviteId === project.id}
                          className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50"
                        >
                          <X size={14} aria-hidden="true" />
                          Decline
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={project.id}
                      className={`grid ${tableColumnClass} min-h-[72px] items-center hover:bg-slate-50/50 transition-colors group`}
                    >
                        <div className="px-6 py-3 text-sm font-bold text-left">
                          <Link href={`/projects/${project.id}`} className="text-slate-800 hover:text-secondary transition-colors underline-offset-2 hover:underline">
                            {project.projectName}
                          </Link>
                        </div>
                        <div className="px-6 py-3 text-sm text-slate-600 text-left">
                          {project.accountOwnerName || 'N/A'}
                        </div>
                        <div className="px-6 py-3 text-center">
                          <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${
                            project.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            project.status === 'IN_REVIEW' ? 'bg-slate-200 text-slate-700' :
                            project.status === 'ONGOING' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {projectStatusLabels[project.status] || project.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="px-6 py-3 text-sm text-slate-600 text-center">
                          {formatProjectDate(project.createdAt)}
                        </div>
                        <div className="px-6 py-3 text-center">
                          <div className="mx-auto flex h-11 w-11 items-center justify-center">
                            <ScoreCircle score={getDisplayScore(project)} />
                          </div>
                        </div>
                    </div>
                  )
                ))}
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Showing {Math.min((currentPage - 1) * PROJECTS_PER_PAGE + 1, visibleProjects.length)} to {Math.min(currentPage * PROJECTS_PER_PAGE, visibleProjects.length)} of {visibleProjects.length} projects
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    aria-label="Previous Page"
                    className="inline-flex items-center justify-center rounded-sm border border-slate-200 bg-white p-2 text-primary shadow-sm transition-all hover:bg-slate-50 disabled:opacity-55 disabled:pointer-events-none active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center space-x-1">
                    {getPageNumbers().map((page, idx) => {
                      if (page === '...') {
                        return (
                          <span
                            key={`dots-${idx}`}
                            className="inline-flex h-8 w-8 items-center justify-center text-xs font-bold text-slate-400"
                          >
                            ...
                          </span>
                        );
                      }

                      const isCurrent = page === currentPage;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page as number)}
                          aria-current={isCurrent ? 'page' : undefined}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-sm text-xs font-extrabold transition-all outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                            isCurrent
                              ? 'bg-secondary text-white shadow-sm'
                              : 'border border-slate-200 bg-white text-primary hover:bg-slate-50 active:scale-95'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    aria-label="Next Page"
                    className="inline-flex items-center justify-center rounded-sm border border-slate-200 bg-white p-2 text-primary shadow-sm transition-all hover:bg-slate-50 disabled:opacity-55 disabled:pointer-events-none active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
