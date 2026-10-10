'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Plus, Minus, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponseStatus } from '@prisma/client';

interface SolutionProps {
  solution: any;
  status: ResponseStatus;
  allPhases: any[];
  allGoals: any[];
  onStatusChange: (status: ResponseStatus) => void;
  readOnly?: boolean;
  detailsExpanded?: boolean;
  onToggleDetails?: () => void;
}

function isDataUri(src: string) {
  return src.startsWith('data:');
}

export const ChecklistSolutionItem: React.FC<SolutionProps> = ({
  solution,
  status,
  allPhases,
  allGoals,
  onStatusChange,
  readOnly = false,
  detailsExpanded: detailsExpandedProp,
  onToggleDetails,
}) => {
  const [detailsExpandedState, setDetailsExpandedState] = useState(false);
  const [figureIndex, setFigureIndex] = useState(0);
  const expanded = detailsExpandedProp ?? detailsExpandedState;
  const toggleDetails = onToggleDetails ?? (() => setDetailsExpandedState((value) => !value));
  const figures: any[] = Array.isArray(solution.figures)
    ? [
        ...new Map<string, any>(
          solution.figures
            .filter((figure: any) => figure.url)
            .map((figure: any) => [`${figure.number || ''}|${figure.url}`, figure])
        ).values(),
      ]
    : [];

  const toggleImplemented = () => {
    onStatusChange(status === 'IMPLEMENTED' ? 'NOT_IMPLEMENTED' : 'IMPLEMENTED');
  };

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-4 py-4 px-2 hover:bg-slate-50 transition-colors group">
        <button
          type="button"
          onClick={toggleDetails}
          className="mt-1 p-0.5 rounded-full border-2 border-slate-500 text-slate-600 hover:border-primary hover:text-primary transition-colors"
          aria-label={expanded ? 'Hide solution details' : 'Show solution details'}
          aria-expanded={expanded}
        >
          {expanded ? <Minus className="w-3.5 h-3.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
        </button>

        <div className="flex-1 text-[15px] text-slate-700 leading-relaxed pt-0.5">
          {solution.isMandatory && (
            <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded mr-2 uppercase tracking-wider border border-amber-200">
              Required
            </span>
          )}
          {solution.text}
        </div>

        <div className="flex items-center gap-2 pr-2">
          {/* Status Selector - Single Toggle */}
          <button
            type="button"
            role="switch"
            onClick={() => !readOnly && toggleImplemented()}
            disabled={readOnly}
            aria-checked={status === 'IMPLEMENTED'}
            aria-label={`${status === 'IMPLEMENTED' ? 'Mark solution not implemented' : 'Mark solution implemented'}: ${solution.text}`}
            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 ${
              status === 'IMPLEMENTED' ? 'bg-primary' : 'bg-slate-300'
            } ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <span className={`absolute text-[11px] font-bold leading-none ${status === 'IMPLEMENTED' ? 'left-3 text-white' : 'right-3 text-slate-500'}`}>
              {status === 'IMPLEMENTED' ? 'Yes' : 'No'}
            </span>
            <span
              className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                status === 'IMPLEMENTED' ? 'translate-x-8' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bg-slate-50/50 p-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200 space-y-6">
          <div className="max-w-4xl overflow-x-auto">
            <table className="w-full text-xs text-slate-600 border-collapse shadow-sm rounded-lg overflow-hidden border border-slate-300">
              <thead>
                <tr className="bg-slate-200/70">
                  <th className="py-2.5 px-4 border border-slate-300 font-bold text-slate-700 w-32 text-left bg-slate-200">Phases</th>
                  <td className="py-2.5 px-4 border border-slate-300 bg-white">
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {allPhases.map((p) => {
                        const isMatched = solution.phases.some((ph: any) => ph.name === p.name);
                        return (
                          <div key={p.id} className={`flex items-center gap-1.5 ${isMatched ? 'text-orange-500 font-bold' : 'text-slate-600'}`}>
                            {isMatched && <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />}
                            {p.name}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
                <tr className="bg-slate-200/70">
                  <th className="py-2.5 px-4 border border-slate-300 font-bold text-slate-700 text-left bg-slate-200">Goals of UD</th>
                  <td className="py-2.5 px-4 border border-slate-300 bg-white">
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {allGoals.map((g) => {
                        const isMatched = solution.goals.some((go: any) => go.text === g.text);
                        return (
                          <div key={g.id} className={`${isMatched ? 'text-slate-900 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200' : 'text-slate-600'}`}>
                            {g.text}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              </thead>
            </table>
          </div>

          {figures.length > 0 && (
            <div className="max-w-xl mx-auto">
              <div className="relative rounded-md border border-slate-200 bg-slate-50 p-4 shadow-sm">
                {figures.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setFigureIndex((i) => (i - 1 + figures.length) % figures.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm hover:border-secondary hover:text-secondary transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}

                <figure>
                  {!isDataUri(figures[figureIndex].url) && (
                    <Image
                      src={figures[figureIndex].url}
                      alt={figures[figureIndex].altTag || figures[figureIndex].caption || figures[figureIndex].number || 'Solution figure'}
                      width={900}
                      height={600}
                      className="mx-auto max-h-[420px] w-auto max-w-full rounded-sm object-contain"
                      loading="lazy"
                      unoptimized
                    />
                  )}
                  {figures[figureIndex].caption && (
                    <figcaption className="mt-3 text-center text-xs leading-5 text-slate-600">
                      {figures[figureIndex].caption}
                    </figcaption>
                  )}
                </figure>

                {figures.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setFigureIndex((i) => (i + 1) % figures.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm hover:border-secondary hover:text-secondary transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              {figures.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {figures.map((figure: any, idx: number) => (
                    <button
                      key={figure.id}
                      type="button"
                      onClick={() => setFigureIndex(idx)}
                      className={`h-2 w-2 rounded-full transition-colors ${idx === figureIndex ? 'bg-primary' : 'bg-slate-300 hover:bg-slate-400'}`}
                      aria-label={`Go to image ${idx + 1} of ${figures.length}`}
                      aria-current={idx === figureIndex}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
