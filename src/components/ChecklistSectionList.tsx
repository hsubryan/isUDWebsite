'use client';

import React, { useMemo, useState } from 'react';
import { Images } from 'lucide-react';
import { ChecklistSolutionItem } from './ChecklistSolutionItem';
import { ResponseStatus } from '@prisma/client';

interface SectionListProps {
  chapter: any;
  responses: Record<string, ResponseStatus>;
  toggles: Record<string, boolean>;
  allPhases: any[];
  allGoals: any[];
  onStatusChange: (solutionId: string, status: ResponseStatus) => void;
  onSectionToggleChange: (sectionId: string, isEnabled: boolean) => void;
  readOnly?: boolean;
}

export const ChecklistSectionList: React.FC<SectionListProps> = ({
  chapter,
  responses,
  toggles,
  allPhases,
  allGoals,
  onStatusChange,
  onSectionToggleChange,
  readOnly = false,
}) => {
  const [expandedFigureIds, setExpandedFigureIds] = useState<Set<string>>(new Set());

  const solutionIdsWithFigures = useMemo(() => {
    const ids = new Set<string>();
    chapter.sections.forEach((section: any) => {
      section.solutions.forEach((sol: any) => {
        if (Array.isArray(sol.figures) && sol.figures.some((figure: any) => figure.url)) {
          ids.add(sol.id);
        }
      });
    });
    return ids;
  }, [chapter]);

  const allFiguresExpanded = solutionIdsWithFigures.size > 0
    && [...solutionIdsWithFigures].every((id) => expandedFigureIds.has(id));

  const toggleAllFigures = () => {
    setExpandedFigureIds(allFiguresExpanded ? new Set() : new Set(solutionIdsWithFigures));
  };

  const toggleFigure = (solutionId: string) => {
    setExpandedFigureIds((prev) => {
      const next = new Set(prev);
      if (next.has(solutionId)) next.delete(solutionId);
      else next.add(solutionId);
      return next;
    });
  };

  return (
    <div className="p-8">
      <div className="mb-10 flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold text-slate-900">{chapter.number}</h1>
          <h1 className="text-3xl font-medium text-slate-800">{chapter.title}</h1>
        </div>

        {solutionIdsWithFigures.size > 0 && (
          <button
            type="button"
            onClick={toggleAllFigures}
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:border-secondary hover:text-secondary"
          >
            <Images className="h-4 w-4" aria-hidden="true" />
            {allFiguresExpanded ? 'Collapse All Images' : 'Expand All Images'}
          </button>
        )}
      </div>
      
      {/* Required Solutions Summary */}
      {(() => {
        const mandatorySolutions = chapter.sections.flatMap((s: any) => 
          toggles[s.id] === false
            ? []
            : s.solutions.filter((sol: any) => sol.isMandatory).map((sol: any) => ({ ...sol, sectionNumber: `${chapter.number}.${s.number}` }))
        );
        
        if (mandatorySolutions.length === 0) return null;
        
        return (
          <div className="mb-12 bg-amber-50 border border-amber-200 rounded-sm overflow-hidden shadow-sm">
            <div className="bg-amber-100/50 px-6 py-3 border-b border-amber-200">
              <h2 className="text-amber-900 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Required Universal Design Solutions for this Chapter
              </h2>
            </div>
            <div className="divide-y divide-amber-100">
              {mandatorySolutions.map((sol: any) => (
                <div key={`req-${sol.id}`} className="flex items-center gap-3">
                  <div className="shrink-0 w-16 text-center text-[11px] font-bold text-amber-700 bg-amber-100/30 py-4 h-full border-r border-amber-100">
                    {sol.sectionNumber}
                  </div>
                  <div className="flex-1">
                    <ChecklistSolutionItem
                      solution={sol}
                      status={responses[sol.id] || 'NOT_IMPLEMENTED'}
                      allPhases={allPhases}
                      allGoals={allGoals}
                      onStatusChange={(status) => onStatusChange(sol.id, status)}
                      readOnly={readOnly}
                      figuresExpanded={expandedFigureIds.has(sol.id)}
                      onToggleFigures={() => toggleFigure(sol.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="space-y-12">
        {chapter.sections.map((section: any) => {
          const displaySectionNumber = `${chapter.number}.${section.number}`;
          const isSectionEnabled = toggles[section.id] !== false;
          const totalSolutions = section.solutions.length;
          const implementedCount = section.solutions.filter(
            (sol: any) => responses[sol.id] === 'IMPLEMENTED'
          ).length;

          // Calculate earned credits based on thresholds or point-summing fallback
          let earned = 0;
          const hasThresholds = section.minPoints1 > 0 || section.minPoints2 > 0;

          if (isSectionEnabled) {
            if (hasThresholds) {
              if (section.minPoints3 > 0 && implementedCount >= section.minPoints3) earned = section.totalCredits;
              else if (section.minPoints2 > 0 && implementedCount >= section.minPoints2) earned = section.totalCredits;
              else if (section.minPoints1 > 0 && implementedCount >= section.minPoints1) earned = Math.max(1, Math.floor(section.totalCredits / 2));
            } else {
              // Point-summing fallback matching the scoring.ts implementation
              const rawScore = section.solutions.reduce((sum: number, sol: any) => {
                return sum + (responses[sol.id] === 'IMPLEMENTED' ? sol.points : 0);
              }, 0);
              earned = Math.min(rawScore, section.totalCredits);
            }
          }

          return (
            <div key={section.id} className={`relative group/sec transition-opacity ${isSectionEnabled ? '' : 'opacity-70'}`}>
              <div className="flex items-center justify-between mb-4 bg-white py-2">
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold text-primary">{displaySectionNumber}</span>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight group-hover/sec:text-primary transition-colors">
                    {section.title}
                  </h3>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">Section</span>
                    <button
                      type="button"
                      onClick={() => !readOnly && onSectionToggleChange(section.id, !isSectionEnabled)}
                      disabled={readOnly}
                      aria-pressed={isSectionEnabled}
                      aria-label={`${isSectionEnabled ? 'Exclude' : 'Include'} ${section.title}`}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 ${
                        isSectionEnabled ? 'bg-primary' : 'bg-slate-300'
                      } ${readOnly ? 'cursor-not-allowed opacity-50' : 'hover:shadow-sm'}`}
                    >
                      <span className={`text-[10px] font-bold absolute ${isSectionEnabled ? 'left-1.5 text-white' : 'right-1.5 text-slate-500'}`}>
                        {isSectionEnabled ? 'On' : 'Off'}
                      </span>
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                          isSectionEnabled ? 'translate-x-7' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">Solutions</span>
                    <div className="flex items-center h-7 px-3 rounded-full bg-slate-200/60 text-slate-600 text-sm font-bold min-w-[70px] justify-center">
                      <span className={implementedCount > 0 ? 'text-primary' : ''}>{implementedCount}</span>
                      <span className="mx-1 font-normal">of</span>
                      <span>{totalSolutions}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">Credits</span>
                    <div className="flex items-center h-7 px-3 rounded-full bg-slate-200/60 text-slate-600 text-sm font-bold min-w-[70px] justify-center">
                      <span className={earned > 0 ? 'text-primary transition-all duration-300' : ''}>{earned}</span>
                      <span className="mx-1 font-normal">of</span>
                      <span>{isSectionEnabled ? section.totalCredits : 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm ${isSectionEnabled ? '' : 'bg-slate-50'}`}>
                <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 h-10 flex items-center">
                  {!isSectionEnabled ? (
                    <span className="text-[12px] font-bold text-slate-600 uppercase tracking-widest">Section excluded from available credits</span>
                  ) : (section.minPoints1 > 0 || section.minPoints2 > 0) ? (
                    <span className="text-[12px] font-semibold text-slate-900">
                      {section.minPoints2 > 0 && `${section.totalCredits} Credits: Implement ${section.minPoints2} of ${totalSolutions}`}
                      {section.minPoints2 > 0 && section.minPoints1 > 0 && ' | '}
                      {section.minPoints1 > 0 && `${Math.max(1, Math.floor(section.totalCredits / 2))} Credit: Implement ${section.minPoints1} of ${totalSolutions}`}
                    </span>
                  ) : (
                    <span className="text-[12px] font-medium text-slate-600 uppercase tracking-widest">Standard Point Value</span>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {(() => {
                    let lastSubSectionId: string | null = null;
                    return section.solutions.map((sol: any) => {
                      const subSectionId = sol.subSectionId || null;
                      const showSubSectionHeading = Boolean(subSectionId && subSectionId !== lastSubSectionId && sol.subSection);
                      lastSubSectionId = subSectionId;

                      return (
                        <React.Fragment key={sol.id}>
                          {showSubSectionHeading && (
                            <div className="bg-slate-50 px-6 py-2">
                              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                {displaySectionNumber}.{sol.subSection.number} {sol.subSection.title}
                              </span>
                            </div>
                          )}
                          <ChecklistSolutionItem
                            solution={sol}
                            status={responses[sol.id] || 'NOT_IMPLEMENTED'}
                            allPhases={allPhases}
                            allGoals={allGoals}
                            onStatusChange={(status) => onStatusChange(sol.id, status)}
                            readOnly={readOnly || !isSectionEnabled}
                            figuresExpanded={expandedFigureIds.has(sol.id)}
                            onToggleFigures={() => toggleFigure(sol.id)}
                          />
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
