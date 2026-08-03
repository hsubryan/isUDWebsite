'use client';

import React, { useEffect, useState, use, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ChecklistSidebar } from '@/components/ChecklistSidebar';
import { ChecklistSectionList } from '@/components/ChecklistSectionList';
import { ResponseStatus } from '@prisma/client';
import { Printer, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import ChecklistPrintModal from '@/components/ChecklistPrintModal';
import { calculateProjectScore } from '@/lib/scoring';
import { PreliminaryChecklistInfo } from '@/components/PreliminaryChecklistInfo';
import { getCached, setCached } from '@/lib/clientCache';

interface Params {
  id: string;
}

interface ChecklistPayload {
  chapters: any[];
  allPhases: any[];
  allGoals: any[];
  userRole: string;
  userStatus: string;
  responses: Array<{ solutionId: string; status: ResponseStatus }>;
  toggles: Array<{ sectionId: string; isEnabled: boolean }>;
}

function toResponseMap(responses: ChecklistPayload['responses']) {
  const map: Record<string, ResponseStatus> = {};
  responses.forEach((r) => { map[r.solutionId] = r.status; });
  return map;
}

function toToggleMap(toggles: ChecklistPayload['toggles']) {
  const map: Record<string, boolean> = {};
  toggles.forEach((t) => { map[t.sectionId] = t.isEnabled; });
  return map;
}

export default function ChecklistPage({ params }: { params: Promise<Params> }) {
  const { id } = use(params);
  const cacheKey = `checklist:${id}`;
  const cachedPayload = getCached<ChecklistPayload>(cacheKey);

  const [loading, setLoading] = useState(!cachedPayload);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const [chapters, setChapters] = useState<any[]>(cachedPayload?.chapters || []);
  const [activeChapterId, setActiveChapterId] = useState<string>(cachedPayload?.chapters?.[0]?.id || '');
  const [allPhases, setAllPhases] = useState<any[]>(cachedPayload?.allPhases || []);
  const [allGoals, setAllGoals] = useState<any[]>(cachedPayload?.allGoals || []);
  const chapterScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chapterScrollRef.current?.scrollTo({ top: 0 });
  }, [activeChapterId]);

  // Local state for edits
  const [responses, setResponses] = useState<Record<string, ResponseStatus>>(() => cachedPayload ? toResponseMap(cachedPayload.responses) : {});
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => cachedPayload ? toToggleMap(cachedPayload.toggles) : {});
  const responsesRef = useRef<Record<string, ResponseStatus>>(cachedPayload ? toResponseMap(cachedPayload.responses) : {});
  const togglesRef = useRef<Record<string, boolean>>(cachedPayload ? toToggleMap(cachedPayload.toggles) : {});
  const dirtyResponsesRef = useRef<Record<string, ResponseStatus>>({});
  const dirtyTogglesRef = useRef<Record<string, boolean>>({});
  const saveRequestRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const savePendingRef = useRef(false);

  const [userRole, setUserRole] = useState<string>(cachedPayload?.userRole || 'VIEWER');
  const [userStatus, setUserStatus] = useState<string>(cachedPayload?.userStatus || 'PENDING');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const fetchData = useCallback(async (isBackgroundRefresh: boolean) => {
    try {
      if (!isBackgroundRefresh) setLoading(true);
      setErrorMessage('');
      const res = await fetch(`/api/projects/${id}/checklist`);
      const data = await res.json();

      if (!res.ok || data.error) {
        if (!isBackgroundRefresh) setErrorMessage(data.error || 'Unable to load checklist.');
        return;
      }

      setCached<ChecklistPayload>(cacheKey, data);

      setChapters(data.chapters);
      setActiveChapterId((current) => current || data.chapters[0]?.id || '');
      setAllPhases(data.allPhases || []);
      setAllGoals(data.allGoals || []);
      setUserRole(data.userRole || 'VIEWER');
      setUserStatus(data.userStatus || 'PENDING');

      // Never clobber in-flight or unsaved local edits with a background refresh.
      const hasPendingEdits = saveInFlightRef.current
        || Object.keys(dirtyResponsesRef.current).length > 0
        || Object.keys(dirtyTogglesRef.current).length > 0;

      if (!hasPendingEdits) {
        const resMap = toResponseMap(data.responses);
        setResponses(resMap);
        responsesRef.current = resMap;

        const toggleMap = toToggleMap(data.toggles);
        setToggles(toggleMap);
        togglesRef.current = toggleMap;
      }
    } catch {
      if (!isBackgroundRefresh) setErrorMessage('Unable to load checklist. Please try again.');
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  }, [id, cacheKey]);

  useEffect(() => {
    fetchData(Boolean(cachedPayload));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  const saveLatestChecklist = useCallback(async () => {
    if (saveInFlightRef.current) {
      savePendingRef.current = true;
      return;
    }

    const requestId = saveRequestRef.current + 1;
    saveRequestRef.current = requestId;
    saveInFlightRef.current = true;
    savePendingRef.current = false;

    const responseChanges = { ...dirtyResponsesRef.current };
    const toggleChanges = { ...dirtyTogglesRef.current };
    dirtyResponsesRef.current = {};
    dirtyTogglesRef.current = {};

    if (Object.keys(responseChanges).length === 0 && Object.keys(toggleChanges).length === 0) {
      saveInFlightRef.current = false;
      setSaving(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      setSaving(true);
      setSaveError(false);

      const res = await fetch(`/api/projects/${id}/responses/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          responses: Object.entries(responseChanges).map(([solutionId, status]) => ({ solutionId, status })),
          toggles: Object.entries(toggleChanges).map(([sectionId, isEnabled]) => ({ sectionId, isEnabled })),
        }),
      });

      if (!res.ok) {
        dirtyResponsesRef.current = { ...responseChanges, ...dirtyResponsesRef.current };
        dirtyTogglesRef.current = { ...toggleChanges, ...dirtyTogglesRef.current };
        if (requestId === saveRequestRef.current) setSaveError(true);
        return;
      }

      if (requestId === saveRequestRef.current) setHasSaved(true);
    } catch {
      dirtyResponsesRef.current = { ...responseChanges, ...dirtyResponsesRef.current };
      dirtyTogglesRef.current = { ...toggleChanges, ...dirtyTogglesRef.current };
      if (requestId === saveRequestRef.current) setSaveError(true);
    } finally {
      clearTimeout(timeout);
      saveInFlightRef.current = false;

      if (savePendingRef.current) {
        saveLatestChecklist();
        return;
      }

      if (requestId === saveRequestRef.current) setSaving(false);
    }
  }, [id]);

  const hasPendingSave = useCallback(() => {
    return (
      saving ||
      saveInFlightRef.current ||
      Boolean(saveTimerRef.current) ||
      Object.keys(dirtyResponsesRef.current).length > 0 ||
      Object.keys(dirtyTogglesRef.current).length > 0
    );
  }, [saving]);

  const confirmNavigation = useCallback(() => {
    if (!hasPendingSave()) return true;
    return window.confirm('Checklist changes are still saving. Leave this page anyway?');
  }, [hasPendingSave]);

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    setSaving(true);
    setSaveError(false);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      saveLatestChecklist();
    }, 500);
  }, [saveLatestChecklist]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingSave()) return;

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingSave]);

  const handleStatusChange = (solId: string, status: ResponseStatus) => {
    const nextResponses = { ...responsesRef.current, [solId]: status };
    responsesRef.current = nextResponses;
    dirtyResponsesRef.current = { ...dirtyResponsesRef.current, [solId]: status };
    setResponses(nextResponses);
    scheduleAutoSave();
  };

  const handleSectionToggleChange = (sectionId: string, isEnabled: boolean) => {
    const nextToggles = { ...togglesRef.current, [sectionId]: isEnabled };
    togglesRef.current = nextToggles;
    dirtyTogglesRef.current = { ...dirtyTogglesRef.current, [sectionId]: isEnabled };
    setToggles(nextToggles);
    scheduleAutoSave();
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-96px)] items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading checklist data...</p>
        </div>
      </div>
    );
  }

  const activeChapter = chapters.find((c) => c.id === activeChapterId);

  const isReadOnly = userRole === 'VIEWER' || userStatus === 'PENDING';
  const toggleItems = Object.entries(toggles).map(([sectionId, isEnabled]) => ({ sectionId, isEnabled }));
  const responseItems = Object.entries(responses).map(([solutionId, status]) => ({ solutionId, status }));
  const checklistScore = calculateProjectScore(chapters, responseItems, toggleItems);
  const totalAvailable = checklistScore.chapterScores.reduce((sum, chapter) => sum + chapter.total, 0);
  const scorePercentage = totalAvailable > 0
    ? ((checklistScore.totalScore + checklistScore.totalBonus) / totalAvailable) * 100
    : 0;
  const scoreValue = checklistScore.totalScore + checklistScore.totalBonus;
  const preliminaryStatus = {
    failedSections: checklistScore.failedSections,
    missingMandatorySections: checklistScore.missingMandatorySections,
    activeSectionsCount: checklistScore.activeSectionsCount,
    scorePercentage,
    isThresholdMet: scorePercentage >= 78,
    isQualifying: checklistScore.activeSectionsCount >= 1,
    isMandatoryMet: checklistScore.missingMandatorySections.length === 0,
  };
  const scoreRadius = 17;
  const scoreCircumference = 2 * Math.PI * scoreRadius;
  const scoreOffset = scoreCircumference * (1 - Math.min(scoreValue, 100) / 100);

  if (errorMessage) {
    return (
      <div className="min-h-[calc(100vh-96px)] bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-sm border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Checklist unavailable</p>
          <h1 className="mt-3 text-2xl font-bold text-primary">We could not open this project checklist.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{errorMessage}</p>
          <div className="mt-6 flex gap-3">
            <Link href={`/projects/${id}`} className="rounded-sm bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#00264d]">
              Project Overview
            </Link>
            <Link href="/" className="rounded-sm border border-slate-200 bg-white px-5 py-2 text-sm font-bold text-primary transition-colors hover:border-secondary">
              My Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-96px)]">
      {/* Top Header Bar */}
      <div className="min-h-20 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 px-8 py-3 shrink-0">
        <div className="flex min-w-0 items-center gap-3 text-sm text-slate-500 font-medium">
          <Link href="/" onClick={(event) => !confirmNavigation() && event.preventDefault()} className="hover:text-primary transition-colors">My Projects</Link>
          <ChevronRight className="w-4 h-4 opacity-40" />
          <Link href={`/projects/${id}`} onClick={(event) => !confirmNavigation() && event.preventDefault()} className="hover:text-primary transition-colors">Project Overview</Link>
          <ChevronRight className="w-4 h-4 opacity-40" />
          <span className="font-bold text-slate-900">{isReadOnly ? 'View Solutions' : 'Edit Solutions'}</span>
          {isReadOnly && (
            <span className="ml-4 px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-200">
              Read-Only Mode
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-stretch overflow-hidden rounded-md border border-slate-200 bg-slate-50/80 shadow-sm xl:flex">
            <div className="flex items-center gap-5 px-4 py-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-700">Credits</p>
              <div className="flex items-center gap-4 text-center">
                <div className="min-w-12">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-800">Earned</p>
                  <p className="text-xl font-extrabold leading-6 text-primary">{checklistScore.totalScore}</p>
                </div>
                <div className="h-9 w-px bg-slate-200" />
                <div className="min-w-14">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-800">Available</p>
                  <p className="text-xl font-extrabold leading-6 text-primary">{totalAvailable}</p>
                </div>
                <div className="h-9 w-px bg-slate-200" />
                <div className="min-w-12">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-800">Bonus</p>
                  <p className="text-xl font-extrabold leading-6 text-primary">{checklistScore.totalBonus}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-l border-slate-200 bg-white px-4 py-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Score</p>
              <div className="relative flex h-11 w-11 items-center justify-center">
                <svg width="44" height="44" className="-rotate-90">
                  <circle cx="22" cy="22" r={scoreRadius} stroke="#e2e8f0" strokeWidth="6" fill="none" />
                  <circle
                    cx="22"
                    cy="22"
                    r={scoreRadius}
                    stroke="#F7941D"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={scoreCircumference}
                    strokeDashoffset={scoreOffset}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <span className="absolute text-base font-extrabold text-primary">{scoreValue}</span>
              </div>
            </div>
          </div>

          <PreliminaryChecklistInfo
            status={preliminaryStatus}
            totalEarned={checklistScore.totalScore}
            bonus={checklistScore.totalBonus}
          />

          <button
            onClick={() => setPrintModalOpen(true)}
            className="flex h-12 items-center gap-2 rounded-md bg-slate-100 px-6 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 active:scale-95"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            Print
          </button>

          {!isReadOnly && (
            <div role="status" aria-live="polite" className={`flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-md px-5 text-sm font-bold ${
              saveError
                ? 'bg-red-50 text-red-700 border border-red-100'
                : saving
                  ? 'bg-slate-100 text-slate-600'
                  : hasSaved
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-slate-50 text-slate-500 border border-slate-100'
            }`}>
              {saveError ? (
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
              ) : (
                <CheckCircle2 className={`h-4 w-4 ${saving ? 'animate-pulse' : ''}`} aria-hidden="true" />
              )}
              {saveError ? 'Save failed' : saving ? 'Saving...' : hasSaved ? 'Saved' : 'Auto-save on'}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden bg-slate-50">
          <ChecklistSidebar
          chapters={chapters}
          activeChapterId={activeChapterId}
          onChapterSelect={(chapterId) => {
            if (confirmNavigation()) setActiveChapterId(chapterId);
          }}
        />

        <div ref={chapterScrollRef} className="flex-1 overflow-y-auto relative bg-[#f8fafc]">
          {activeChapter && (
            <ChecklistSectionList
              chapter={activeChapter}
              responses={responses}
              toggles={toggles}
              allPhases={allPhases}
              allGoals={allGoals}
              onStatusChange={handleStatusChange}
              onSectionToggleChange={handleSectionToggleChange}
              readOnly={isReadOnly}
            />
          )}
        </div>
      </div>

      {printModalOpen && (
        <ChecklistPrintModal
          chapters={chapters}
          responses={responses}
          toggles={toggles}
          onClose={() => setPrintModalOpen(false)}
        />
      )}
    </div>
  );
}
