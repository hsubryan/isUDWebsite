'use client';

import React, { useState } from 'react';
import { Check, Edit3, Minus, Plus, X } from 'lucide-react';
import Link from 'next/link';
import type { PreliminaryStatus } from './PreliminaryChecklistInfo';

interface PreliminaryProgressProps {
  projectId: string;
  status: PreliminaryStatus;
  totalEarned: number;
  bonus: number;
}

function ResultIcon({ passed }: { passed: boolean }) {
  return (
    <div
      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white ${
        passed ? 'border-emerald-500 text-emerald-600' : 'border-red-500 text-red-600'
      }`}
    >
      {passed ? <Check className="h-4 w-4 stroke-[4]" /> : <X className="h-4 w-4 stroke-[4]" />}
    </div>
  );
}

function BulletColumns({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 pl-5 text-sm leading-6 text-slate-700 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => (
        <li key={item} className="list-disc whitespace-nowrap pl-1">
          {item}
        </li>
      ))}
    </ul>
  );
}

export const PreliminaryProgress: React.FC<PreliminaryProgressProps> = ({
  projectId,
  status,
  totalEarned,
  bonus,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const roundedScore = Math.round(status.scorePercentage);
  const finalScoreText = `${roundedScore}%`;
  const earnedCreditText = status.isThresholdMet
    ? `Based on the solutions selected, you earned ${totalEarned} credits and ${bonus} bonus credits. Your projected final score is ${finalScoreText}.`
    : `Based on the solutions selected, you earned ${totalEarned} credits and ${bonus} bonus credits. Your projected final score is ${finalScoreText}. This is insufficient to qualify for self-assessment. This project requires a minimum score of 78%. The sections listed below did not earn any credit. Please review these sections and implement additional solutions.`;

  return (
    <section className="rounded-sm border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-primary">Preliminary Certification Progress</h2>
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-primary transition-colors hover:bg-slate-100"
          aria-label={isExpanded ? 'Collapse preliminary progress' : 'Expand preliminary progress'}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <Minus className="h-4 w-4 stroke-[3]" /> : <Plus className="h-4 w-4 stroke-[3]" />}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-5 text-sm">
          <div className="flex gap-3">
            <ResultIcon passed={status.isQualifying} />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-700">Available Sections:</h3>
              <p className="mt-1 leading-6 text-slate-700">
                {status.isQualifying
                  ? 'You selected enough sections to qualify for self-assessment.'
                  : 'You have not selected enough sections to qualify for self-assessment.'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <ResultIcon passed={status.isThresholdMet} />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-700">Earned Credit:</h3>
              <p className="mt-1 leading-6 text-slate-700">
                {earnedCreditText}
              </p>
              {!status.isThresholdMet && <BulletColumns items={status.failedSections} />}
              <div className="mt-3 flex justify-end">
                <Link
                  href={`/projects/${projectId}/checklist`}
                  className="inline-flex items-center gap-1 text-xs text-secondary hover:underline"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit Solutions
                </Link>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <ResultIcon passed={status.isMandatoryMet} />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-700">Required Solutions:</h3>
              <p className="mt-1 leading-6 text-slate-700">
                {status.isMandatoryMet
                  ? 'You have selected all required solutions.'
                  : 'You have not selected all required solutions. Please review the following sections to ensure all required solutions are implemented.'}
              </p>
              {!status.isMandatoryMet && <BulletColumns items={status.missingMandatorySections} />}
              <div className="mt-3 flex justify-end">
                <Link
                  href={`/projects/${projectId}/checklist`}
                  className="inline-flex items-center gap-1 text-xs text-secondary hover:underline"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit Solutions
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
