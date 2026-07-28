'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Edit, Send, ClipboardCheck, Loader2 } from 'lucide-react';
import Button from './ui/Button';
import { PreliminaryProgress } from './PreliminaryProgress';

interface ChapterScore {
  number: string;
  title: string;
  totalCredits: number;
  earned: number;
}

interface ProjectData {
  id: string;
  projectNumber?: number;
  projectName: string;
  contactName: string;
  contactEmail: string;
  telephone: string;
  firmName?: string;
  ownerName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country: string;
  buildingArea?: string;
  siteArea?: string;
  certification: string;
  services: string[];
  status: string;
  score: number;
  facilityUses: { id: string; name: string }[];
  chapterScores: ChapterScore[];
  totalEarned: number;
  totalAvailable: number;
  bonus: number;
  userRole: string;
  userStatus: string;
  currentSubmission: {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    editAccessStatus: 'NONE' | 'REQUESTED' | 'GRANTED';
    reviewNote: string | null;
  } | null;
  certificationStatus?: {
    failedSections: string[];
    missingMandatorySections: string[];
    activeSectionsCount: number;
    scorePercentage: number;
    isThresholdMet: boolean;
    isQualifying: boolean;
    isMandatoryMet: boolean;
  };
}

function CircleScore({ earned, total, size = 80 }: { earned: number; total: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? (earned / total) : 0;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth="4" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={progress > 0 ? '#002a54' : '#e2e8f0'}
          strokeWidth="4" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-sm font-bold text-slate-800">{earned}/{total}</span>
    </div>
  );
}

function CardTextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm outline-none transition-all focus:border-secondary focus:ring-2 focus:ring-secondary/25"
      />
    </label>
  );
}

function CardEditActions({ onSave, onCancel, saving }: { onSave: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-3 pt-1">
      <button type="button" onClick={onCancel} disabled={saving} className="text-xs font-bold text-slate-500 hover:underline disabled:opacity-50">
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-sm bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-[#002855] disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

type EditableCard = 'projectInfo' | 'contactInfo' | 'certification';

export default function ProjectOverview({ id: propId }: { id?: string }) {
  const params = useParams();
  const id = propId || params?.id as string;
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<EditableCard | null>(null);
  const [cardFormData, setCardFormData] = useState<Record<string, string>>({});
  const [savingCard, setSavingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isRequestingEdit, setIsRequestingEdit] = useState(false);
  const [requestEditError, setRequestEditError] = useState<string | null>(null);

  const isReadOnly = project?.userRole === 'VIEWER' || project?.userStatus === 'PENDING';

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) {
        setErrorMessage('No project ID found in URL.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/projects/${id}`);
        
        if (response.ok) {
          const data = await response.json();
          setProject(data);
        } else {
          const errorData = await response.json().catch(() => ({}));
          setErrorMessage(errorData.error || `Server responded with ${response.status}`);
          if (response.status === 404) setProject(null);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        setErrorMessage('Network error or server is down.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-32 space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md max-w-md mx-auto">
          <p className="text-red-700 font-bold">Error: {errorMessage || 'Project Not Found'}</p>
          <p className="text-xs text-red-600 mt-1 opacity-70">ID: {id}</p>
        </div>
        <p className="text-slate-500">We couldn't locate the project you're looking for.</p>
        <Link href="/" className="text-secondary underline font-bold inline-block">Back to My Projects</Link>
      </div>
    );
  }

  const isSubmitted = project.status === 'IN_REVIEW';
  const isCertified = project.status === 'COMPLETED';
  const canSubmitProject = Boolean(
    !isSubmitted &&
    !isCertified &&
    project.certificationStatus?.isQualifying &&
    project.certificationStatus?.isThresholdMet &&
    project.certificationStatus?.isMandatoryMet
  );

  const editAccessStatus = project.currentSubmission?.editAccessStatus ?? 'NONE';
  const isReviewLocked = isSubmitted && editAccessStatus !== 'GRANTED';
  const rejectionNote =
    project.status === 'ONGOING' && project.currentSubmission?.status === 'REJECTED'
      ? project.currentSubmission.reviewNote
      : null;
  const showEditActions = !isReadOnly && !isReviewLocked;
  const submitTitle = isSubmitted
    ? 'Project has been submitted for approval.'
    : isCertified
      ? 'Project is already certified.'
      : canSubmitProject
    ? 'Ready to submit'
    : 'Complete the preliminary checklist before submitting.';
  const submitButtonLabel = isSubmitted ? 'Submitted' : isCertified ? 'Certified' : 'Submit Project';

  const handleSubmitProject = async () => {
    if (!canSubmitProject || isSubmittingProject) return;

    setIsSubmittingProject(true);
    setSubmitMessage(null);

    try {
      const response = await fetch(`/api/projects/${id}/submit`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to submit project.');
      }

      setProject((current) => current ? { ...current, status: data.status || 'IN_REVIEW' } : current);
    } catch (error: any) {
      setSubmitMessage(error.message || 'Unable to submit project.');
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleRequestEditAccess = async () => {
    if (isRequestingEdit || editAccessStatus !== 'NONE') return;
    setIsRequestingEdit(true);
    setRequestEditError(null);

    try {
      const response = await fetch(`/api/projects/${id}/submit/request-edit`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to request edit access.');
      }

      setProject((current) =>
        current
          ? {
              ...current,
              currentSubmission: current.currentSubmission
                ? { ...current.currentSubmission, editAccessStatus: 'REQUESTED' }
                : current.currentSubmission,
            }
          : current
      );
    } catch (error: any) {
      setRequestEditError(error.message || 'Unable to request edit access.');
    } finally {
      setIsRequestingEdit(false);
    }
  };

  const startEditingCard = (card: EditableCard) => {
    if (!project) return;
    setCardError(null);
    if (card === 'projectInfo') {
      setCardFormData({
        address1: project.address1 || '',
        city: project.city || '',
        state: project.state || '',
        country: project.country || 'United States',
        zip: project.zip || '',
        siteArea: project.siteArea || '',
        buildingArea: project.buildingArea || '',
      });
    } else if (card === 'contactInfo') {
      setCardFormData({
        contactName: project.contactName || '',
        contactEmail: project.contactEmail || '',
        telephone: project.telephone || '',
        ownerName: project.ownerName || '',
        firmName: project.firmName || '',
      });
    } else {
      setCardFormData({ certification: project.certification });
    }
    setEditingCard(card);
  };

  const cancelEditingCard = () => {
    setEditingCard(null);
    setCardFormData({});
    setCardError(null);
  };

  const updateCardField = (field: string, value: string) => {
    setCardFormData((current) => ({ ...current, [field]: value }));
  };

  const saveCard = async () => {
    if (!project || !editingCard || savingCard) return;
    setSavingCard(true);
    setCardError(null);

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: project.projectName,
          contactName: cardFormData.contactName ?? project.contactName,
          contactEmail: cardFormData.contactEmail ?? project.contactEmail,
          telephone: cardFormData.telephone ?? project.telephone,
          firmName: cardFormData.firmName ?? project.firmName,
          ownerName: cardFormData.ownerName ?? project.ownerName,
          address1: cardFormData.address1 ?? project.address1,
          address2: project.address2,
          city: cardFormData.city ?? project.city,
          state: cardFormData.state ?? project.state,
          zip: cardFormData.zip ?? project.zip,
          country: cardFormData.country ?? project.country,
          buildingArea: cardFormData.buildingArea ?? project.buildingArea,
          siteArea: cardFormData.siteArea ?? project.siteArea,
          certification: cardFormData.certification ?? project.certification,
          services: project.services,
          facilityUses: project.facilityUses.map((facilityUse) => facilityUse.name),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to save changes.');
      }

      setProject((current) => current ? { ...current, ...data } : current);
      cancelEditingCard();
    } catch (error: any) {
      setCardError(error.message || 'Unable to save changes.');
    } finally {
      setSavingCard(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/" className="text-secondary font-bold hover:underline">My Projects</Link>
        <span className="text-slate-400">&gt;</span>
        <span className="font-bold text-slate-800">Project Overview</span>
      </div>

      {/* Project Title + Actions */}
      <div className="bg-white border border-slate-200 rounded-sm px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-primary tracking-tight">{project.projectName}</h1>
          {isReadOnly && (
            <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-200">
              Read-Only Mode
            </span>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href={`/projects/${id}/checklist`}>
            <Button variant="primary" className="gap-2 text-sm">
              <ClipboardCheck size={16} /> {isReadOnly || isCertified ? 'View Checklist' : 'Edit Solutions'}
            </Button>
          </Link>
          {showEditActions && (
            <Link href={`/projects/${id}/edit`}>
              <Button variant="primary" className="gap-2 text-sm">
                <Edit size={16} /> Edit Project Details
              </Button>
            </Link>
          )}
          {!isReadOnly && (
            <Button
              variant="secondary"
              className="gap-2 text-sm disabled:bg-slate-400"
              disabled={!canSubmitProject || isSubmittingProject}
              title={submitTitle}
              aria-disabled={!canSubmitProject}
              onClick={handleSubmitProject}
            >
              {isSubmittingProject ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {isSubmittingProject ? 'Submitting...' : submitButtonLabel}
            </Button>
          )}
        </div>
      </div>

      {submitMessage && (
        <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {submitMessage}
        </div>
      )}

      {isReviewLocked && editAccessStatus === 'NONE' && (
        <div className="flex flex-col gap-2 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>This project is under review and locked for edits.</span>
          <button
            type="button"
            onClick={handleRequestEditAccess}
            disabled={isRequestingEdit}
            className="inline-flex items-center gap-2 rounded-sm bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isRequestingEdit ? <Loader2 size={14} className="animate-spin" /> : null}
            {isRequestingEdit ? 'Requesting...' : 'Request Edit Access'}
          </button>
        </div>
      )}

      {isReviewLocked && editAccessStatus === 'REQUESTED' && (
        <div className="rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Edit access requested — waiting on admin approval.
        </div>
      )}

      {isSubmitted && editAccessStatus === 'GRANTED' && (
        <div className="rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Edit access granted — changes you make are visible to the reviewing admin.
        </div>
      )}

      {requestEditError && (
        <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {requestEditError}
        </div>
      )}

      {rejectionNote && (
        <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Your last submission was returned: {rejectionNote}
        </div>
      )}

      {/* Main 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-3 space-y-6">

          {/* Score */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-4">Score</h2>
            <div className="flex justify-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg width={128} height={128} className="-rotate-90">
                  <circle cx="64" cy="64" r="56" stroke="#e2e8f0" strokeWidth="6" fill="none" />
                  <circle
                    cx="64" cy="64" r="56"
                    stroke="#002a54" strokeWidth="6" fill="none"
                    strokeDasharray={2 * Math.PI * 56}
                    strokeDashoffset={2 * Math.PI * 56 * (1 - (project.totalAvailable > 0 ? project.totalEarned / project.totalAvailable : 0))}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute text-3xl font-bold text-primary">{project.totalEarned}</span>
              </div>
            </div>
          </div>

          {/* Project Information */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-4">Project Information</h2>
            {editingCard === 'projectInfo' ? (
              <div className="space-y-3">
                <CardTextField label="Address" value={cardFormData.address1 || ''} onChange={(v) => updateCardField('address1', v)} />
                <CardTextField label="City" value={cardFormData.city || ''} onChange={(v) => updateCardField('city', v)} />
                <CardTextField label="State" value={cardFormData.state || ''} onChange={(v) => updateCardField('state', v)} />
                <CardTextField label="Country" value={cardFormData.country || ''} onChange={(v) => updateCardField('country', v)} />
                <CardTextField label="ZIP Code" value={cardFormData.zip || ''} onChange={(v) => updateCardField('zip', v)} />
                <CardTextField label="Site Area (acres)" value={cardFormData.siteArea || ''} onChange={(v) => updateCardField('siteArea', v)} />
                <CardTextField label="Building Area (sq.ft.)" value={cardFormData.buildingArea || ''} onChange={(v) => updateCardField('buildingArea', v)} />
                {cardError && <p className="text-xs font-medium text-red-600">{cardError}</p>}
                <CardEditActions onSave={saveCard} onCancel={cancelEditingCard} saving={savingCard} />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p><span className="font-bold text-slate-700">Title:</span> {project.projectName}</p>
                <p><span className="font-bold text-slate-700">Address:</span> {project.address1 || '-'}</p>
                <p><span className="font-bold text-slate-700">City:</span> {project.city || '-'}</p>
                <p><span className="font-bold text-slate-700">State:</span> {project.state || '-'}</p>
                <p><span className="font-bold text-slate-700">Country:</span> {project.country}</p>
                <p><span className="font-bold text-slate-700">ZIP Code:</span> {project.zip || '-'}</p>
                <p><span className="font-bold text-slate-700">Site Area:</span> {project.siteArea || '0'} acres</p>
                <p><span className="font-bold text-slate-700">Building Area:</span> {project.buildingArea || '0'} sq.ft.</p>
              </div>
            )}
            {showEditActions && editingCard !== 'projectInfo' && (
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => startEditingCard('projectInfo')} className="text-xs text-secondary flex items-center gap-1 hover:underline">
                  <Edit size={12} /> Edit
                </button>
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-4">Contact Information</h2>
            {editingCard === 'contactInfo' ? (
              <div className="space-y-3">
                <CardTextField label="Name" value={cardFormData.contactName || ''} onChange={(v) => updateCardField('contactName', v)} />
                <CardTextField label="Email" type="email" value={cardFormData.contactEmail || ''} onChange={(v) => updateCardField('contactEmail', v)} />
                <CardTextField label="Telephone" value={cardFormData.telephone || ''} onChange={(v) => updateCardField('telephone', v)} />
                <CardTextField label="Project Owner" value={cardFormData.ownerName || ''} onChange={(v) => updateCardField('ownerName', v)} />
                <CardTextField label="Architect" value={cardFormData.firmName || ''} onChange={(v) => updateCardField('firmName', v)} />
                {cardError && <p className="text-xs font-medium text-red-600">{cardError}</p>}
                <CardEditActions onSave={saveCard} onCancel={cancelEditingCard} saving={savingCard} />
              </div>
            ) : (
            <div className="space-y-2 text-sm">
              <p><span className="font-bold text-slate-700">Name:</span> {project.contactName}</p>
              <p><span className="font-bold text-slate-700">Email:</span> {project.contactEmail}</p>
              <p><span className="font-bold text-slate-700">Telephone:</span> {project.telephone}</p>
              <p><span className="font-bold text-slate-700">Project Owner:</span> {project.ownerName || '-'}</p>
              <p><span className="font-bold text-slate-700">Architect:</span> {project.firmName || '-'}</p>
            </div>
            )}
            {showEditActions && editingCard !== 'contactInfo' && (
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => startEditingCard('contactInfo')} className="text-xs text-secondary flex items-center gap-1 hover:underline">
                  <Edit size={12} /> Edit
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN */}
        <div className="lg:col-span-6 space-y-6">

          {/* Earned Credits Summary */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-primary">Earned Credits</h2>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center mb-8">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Earned</p>
                <p className="text-4xl font-bold text-primary">{project.totalEarned}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Available</p>
                <p className="text-4xl font-bold text-primary">{project.totalAvailable}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bonus</p>
                <p className="text-4xl font-bold text-primary">{project.bonus}</p>
              </div>
            </div>

            {/* Earned Credits by Chapter */}
            <h3 className="text-md font-bold text-primary mb-6">Earned Credits by Chapter</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
              {project.chapterScores.map((ch) => (
                <div key={ch.number} className="flex flex-col items-center gap-2">
                  <CircleScore earned={ch.earned} total={ch.totalCredits} />
                  <p className="text-xs text-center text-slate-600 font-medium leading-tight">{ch.title}</p>
                </div>
              ))}
            </div>

            {showEditActions && !isCertified && (
              <div className="mt-6 flex justify-end">
                <Link href={`/projects/${id}/checklist`} className="text-xs text-secondary flex items-center gap-1 hover:underline">
                  <Edit size={12} /> Edit
                </Link>
              </div>
            )}
          </div>

          {/* Preliminary Certification Progress */}
          {project.certificationStatus && (
            <PreliminaryProgress 
              projectId={id as string}
              status={project.certificationStatus}
              totalEarned={project.totalEarned}
              bonus={project.bonus}
            />
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-3 space-y-6">

          {/* Potential Services Needed */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-4">Potential Services Needed</h2>
            <ul className="space-y-1 text-sm text-slate-700">
              {project.services.length > 0 ? (
                project.services.map((s) => (
                  <li key={s}>- {s}</li>
                ))
              ) : (
                <li className="text-slate-400 italic">No services selected</li>
              )}
            </ul>
          </div>

          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            {editingCard === 'certification' ? (
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-primary mb-2">Certification</h2>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input
                      type="radio"
                      name="certification"
                      value="Guided Certification"
                      checked={cardFormData.certification === 'Guided Certification'}
                      onChange={(e) => updateCardField('certification', e.target.value)}
                      className="w-4 h-4 text-secondary focus:ring-secondary border-slate-300"
                    />
                    Guided Certification
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                    <input
                      type="radio"
                      name="certification"
                      value="Certification Only"
                      checked={cardFormData.certification === 'Certification Only'}
                      onChange={(e) => updateCardField('certification', e.target.value)}
                      className="w-4 h-4 text-secondary focus:ring-secondary border-slate-300"
                    />
                    Certification Only
                  </label>
                </div>
                {cardError && <p className="text-xs font-medium text-red-600">{cardError}</p>}
                <CardEditActions onSave={saveCard} onCancel={cancelEditingCard} saving={savingCard} />
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-primary mb-4">Certification</h2>
                <p className="text-sm"><span className="font-bold text-slate-700">Type:</span> {project.certification}</p>
              </div>
            )}
            {showEditActions && editingCard !== 'certification' && (
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => startEditingCard('certification')} className="text-xs text-secondary flex items-center gap-1 hover:underline">
                  <Edit size={12} /> Edit
                </button>
              </div>
            )}
          </div>

          {/* Contact our UD Team */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-3">Contact our UD Team</h2>
            <div className="space-y-1 text-sm text-slate-700">
              <p>Danise Levine, AIA</p>
              <p>drlevine@buffalo.edu, 1.716.829.5903</p>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-white border border-slate-200 rounded-sm p-6 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-3">Team Members</h2>
            <p className="text-sm text-slate-700">{project.contactName}</p>
            <div className="mt-4 flex justify-end gap-4">
              <Link href={`/projects/${id}/team`} className="text-xs text-secondary flex items-center gap-1 hover:underline">
                {isReadOnly ? <ClipboardCheck size={12} /> : <Edit size={12} />} {isReadOnly ? 'View Team' : 'Edit Team'}
              </Link>
              {!isReadOnly && (
                <Link href={`/projects/${id}/team`} className="text-xs text-secondary flex items-center gap-1 hover:underline">
                  + Add Member
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
