'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, ExternalLink, Loader2, Search } from 'lucide-react';
import Breadcrumbs from '@/components/ui/Breadcrumbs';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

type ProjectApproval = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedTo: string;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  reviewNote: string | null;
  project: {
    id: string;
    projectNumber: number;
    projectName: string;
    contactName: string;
    contactEmail: string;
    firmName: string | null;
    ownerName: string | null;
    status: string;
    score: number;
    updatedAt: string;
    user: {
      name: string;
      email: string;
    };
  };
};

function formatDate(value: string | null) {
  if (!value) return 'Not approved';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function AdminProjectApprovalsClient() {
  const [items, setItems] = useState<ProjectApproval[]>([]);
  const [status, setStatus] = useState<ApprovalStatus>('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  async function loadApprovals(nextStatus = status) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/project-approvals?status=${nextStatus}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load project approvals');
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load project approvals');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      item.project.projectName.toLowerCase().includes(term) ||
      item.project.projectNumber.toString().includes(term) ||
      item.project.contactEmail.toLowerCase().includes(term) ||
      item.project.user.email.toLowerCase().includes(term) ||
      item.project.user.name.toLowerCase().includes(term)
    );
  }, [items, query]);

  async function runAction(item: ProjectApproval, action: 'approve' | 'reject', note?: string) {
    setApprovingId(item.id);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/project-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: item.id, action, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update submission');
      const successMessage =
        action === 'approve'
          ? `${item.project.projectName} has been certified.`
          : `${item.project.projectName} has been returned to the owner.`;
      setMessage(successMessage);
      setRejectingId('');
      setRejectNote('');
      await loadApprovals(status);
    } catch (err: any) {
      setError(err.message || 'Unable to update submission');
    } finally {
      setApprovingId('');
    }
  }

  function approveSubmission(item: ProjectApproval) {
    return runAction(item, 'approve');
  }

  function submitReject(item: ProjectApproval) {
    return runAction(item, 'reject', rejectNote);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'My Projects', href: '/' }, { label: 'Admin Dashboard' }, { label: 'Project Approvals' }]} />

      <div className="flex flex-col gap-4 border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Admin Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold text-primary">Project Approvals</h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
            {(['pending', 'approved', 'rejected'] as ApprovalStatus[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`h-9 rounded px-3 text-xs font-bold uppercase tracking-wide transition ${status === option ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
              >
                {option}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/25"
            />
          </label>
        </div>
      </div>

      {(message || error) && (
        <div role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} className={`border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <div className="border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-72 items-center justify-center text-sm font-bold text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading project approvals
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">No {status} projects</p>
            <p className="mt-1 text-sm font-medium text-slate-400">Submitted projects will appear here for admin review.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => (
              <div key={item.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-amber-50 px-2 py-1 text-xs font-bold text-secondary">
                      #{item.project.projectNumber}
                    </span>
                    <span className={`rounded px-2 py-1 text-xs font-bold ${
                      item.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : item.status === 'REJECTED'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.status === 'APPROVED' ? 'Certified' : item.status === 'REJECTED' ? 'Rejected' : 'Pending approval'}
                    </span>
                  </div>
                  <Link href={`/projects/${item.project.id}`} className="mt-2 inline-flex max-w-full items-center gap-2 text-lg font-bold text-primary hover:text-secondary">
                    <span className="truncate">{item.project.projectName}</span>
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </Link>
                  <div className="mt-2 grid gap-2 text-sm font-medium text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
                    <span>Owner: {item.project.user.name || item.project.user.email}</span>
                    <span>Contact: {item.project.contactEmail}</span>
                    <span>Firm: {item.project.firmName || 'Not set'}</span>
                    <span>Submitted: {formatDate(item.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                  {item.status === 'PENDING' ? (
                    <>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => approveSubmission(item)}
                          disabled={Boolean(approvingId) || rejectingId === item.id}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-white hover:bg-[#001d3d] disabled:bg-slate-300"
                        >
                          {approvingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingId(rejectingId === item.id ? '' : item.id)}
                          disabled={Boolean(approvingId)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                      {rejectingId === item.id && (
                        <div className="flex flex-col gap-2 lg:items-end">
                          <textarea
                            value={rejectNote}
                            onChange={(event) => setRejectNote(event.target.value)}
                            placeholder="Optional note for the project owner"
                            className="h-20 w-full rounded-md border border-slate-200 p-2 text-sm lg:w-80"
                          />
                          <button
                            type="button"
                            onClick={() => submitReject(item)}
                            disabled={Boolean(approvingId)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {approvingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Confirm Reject
                          </button>
                        </div>
                      )}
                    </>
                  ) : item.status === 'REJECTED' ? (
                    <div className="text-right text-sm font-semibold text-red-700">
                      Rejected {formatDate(item.rejectedAt)}
                      {item.reviewNote && <div className="mt-1 text-xs font-medium text-slate-500">{item.reviewNote}</div>}
                    </div>
                  ) : (
                    <div className="text-right text-sm font-semibold text-emerald-700">
                      Approved {formatDate(item.approvedAt)}
                    </div>
                  )}
                  <Link href={`/projects/${item.project.id}`} className="text-sm font-bold text-secondary hover:underline">
                    Review project
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
