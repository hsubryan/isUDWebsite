'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GOAL_DEFINITIONS } from '@/lib/goalDefinitions';

export default function GoalTooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  const definition = GOAL_DEFINITIONS[text];
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  if (!definition) return <>{children}</>;

  function show() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.top, left: rect.left + rect.width / 2 });
  }

  function hide() {
    setCoords(null);
  }

  return (
    <span
      ref={triggerRef}
      className="cursor-help"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
    >
      {children}
      {coords && typeof document !== 'undefined' &&
        createPortal(
          // Rendered via a portal to document.body and positioned with
          // `fixed` (viewport coordinates from getBoundingClientRect) so it
          // can never be clipped by an ancestor's overflow-hidden/auto -
          // e.g. the scrollable checklist table.
          <span
            className="pointer-events-none fixed z-[9999] w-56 -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-white p-2.5 text-xs font-normal normal-case leading-snug text-slate-600 shadow-lg"
            style={{ top: coords.top - 8, left: coords.left }}
          >
            {definition}
            <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-slate-200 bg-white" />
          </span>,
          document.body
        )}
    </span>
  );
}
