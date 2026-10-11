'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface SidebarProps {
  chapters: any[];
  activeChapterId: string;
  onChapterSelect: (id: string) => void;
  onSectionSelect: (chapterId: string, sectionId: string) => void;
}

export const ChecklistSidebar: React.FC<SidebarProps> = ({
  chapters,
  activeChapterId,
  onChapterSelect,
  onSectionSelect,
}) => {
  const [expandedChapterId, setExpandedChapterId] = useState(activeChapterId);

  const toggleChapter = (chapterId: string) => {
    setExpandedChapterId((prev) => (prev === chapterId ? '' : chapterId));
    onChapterSelect(chapterId);
  };

  return (
    <div className="w-80 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col pt-4">
      <div className="px-6 py-2 mb-4">
        <h2 className="text-[12px] font-extrabold text-slate-800 uppercase tracking-widest">Chapters</h2>
      </div>
      <nav className="flex-1 overflow-y-auto pr-px">
        {chapters.map((chapter) => {
          const isActiveChapter = activeChapterId === chapter.id;
          const isExpanded = expandedChapterId === chapter.id;

          return (
            <div key={chapter.id} className="border-b border-slate-100 last:border-0">
              <button
                onClick={() => toggleChapter(chapter.id)}
                className={`w-full flex items-center justify-between group py-4 px-6 transition-all duration-200 border-r-4 ${
                  isActiveChapter
                    ? 'bg-slate-50 border-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]'
                    : 'bg-transparent border-transparent hover:bg-slate-50/50 hover:border-slate-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className={`text-[15px] font-bold transition-colors ${
                    isActiveChapter ? 'text-primary' : 'text-slate-400 group-hover:text-slate-500'
                  }`}>
                    {chapter.number}
                  </span>
                  <span className={`text-[15px] font-medium text-left leading-tight transition-colors ${
                    isActiveChapter ? 'text-slate-900 font-bold' : 'text-slate-600 group-hover:text-slate-900'
                  }`}>
                    {chapter.title}
                  </span>
                </div>

                <ChevronRight className={`w-5 h-5 shrink-0 transition-transform duration-300 ${
                  isExpanded ? 'rotate-90 text-secondary' : 'text-slate-300'
                }`} />
              </button>

              {isExpanded && (
                <div className="bg-slate-50 border-t border-slate-100 py-2 pl-14 pr-4 space-y-1">
                  {chapter.sections.map((section: any) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => onSectionSelect(chapter.id, section.id)}
                      className="w-full rounded-sm px-3 py-2 text-left transition-colors text-primary hover:bg-primary/10"
                    >
                      <div className="flex gap-2">
                        <span className="font-bold">{chapter.number}.{section.number}</span>
                        <span className="text-sm font-semibold">{section.title}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-primary/50">
                        {section.totalCredits} credits · {section.solutions.length} solutions
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
};
