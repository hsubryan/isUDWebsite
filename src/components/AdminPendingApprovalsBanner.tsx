'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';

export default function AdminPendingApprovalsBanner() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    fetch('/api/admin/project-approvals?status=pending')
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) setCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (!isAdmin || count === 0) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <Link
        href="/admin/project-approvals"
        className="flex items-center justify-between gap-3 rounded-sm border border-secondary/30 bg-amber-50 px-4 py-3 text-sm font-bold text-primary shadow-sm transition hover:bg-amber-100"
      >
        <span className="flex items-center gap-2">
          <ClipboardCheck size={16} />
          {count} project{count === 1 ? '' : 's'} awaiting approval
        </span>
        <span className="text-secondary underline">Review now</span>
      </Link>
    </div>
  );
}
