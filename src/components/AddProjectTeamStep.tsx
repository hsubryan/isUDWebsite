'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, UserPlus, X } from 'lucide-react';
import Button from './ui/Button';
import AddTeamMemberModal from './AddTeamMemberModal';
import type { ProjectProfileFormData } from './ProjectProfileForm';

const roleLabels: Record<string, string> = {
  ARCHITECT: 'Project Architect/Design Team',
  CONSULTANT: 'Consultant',
  DEVELOPMENT: 'Real Estate Development',
  OWNERSHIP: 'Ownership/Management',
  HR: 'Human Resources',
  ADVOCATE: 'Community Advocate',
};

const permissionLabels: Record<string, string> = {
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
};

type QueuedMember = { email: string; permission: string; role: string };

export default function AddProjectTeamStep({
  draftData,
  onBack,
}: {
  draftData: ProjectProfileFormData;
  onBack: () => void;
}) {
  const router = useRouter();
  const [queuedMembers, setQueuedMembers] = useState<QueuedMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQueueInvite = async (data: { email: string; permission: string; role: string }) => {
    if (queuedMembers.some((member) => member.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('That email has already been added.');
    }
    setQueuedMembers((prev) => [...prev, data]);
  };

  const handleRemove = (email: string) => {
    setQueuedMembers((prev) => prev.filter((member) => member.email !== email));
  };

  const finish = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const project = await response.json();

      for (const member of queuedMembers) {
        const inviteResponse = await fetch(`/api/projects/${project.id}/team`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(member),
        });
        if (!inviteResponse.ok) {
          console.error('Failed to invite team member:', member.email);
        }
      }

      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (err: any) {
      console.error('Project creation error:', err);
      setError(err.message || 'Failed to create project');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/10 rounded-sm px-6 py-4">
        <p className="text-sm leading-relaxed text-slate-700">
          <span className="font-bold text-primary">Almost done!</span>{' '}
          Introduce your team now, or skip this step and add them anytime from the Project Overview page.
          Your project isn&apos;t created until you finish this step.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
        {error && (
          <div role="alert" className="bg-red-50 text-red-600 px-6 py-4 rounded border border-red-100 text-sm font-bold uppercase tracking-wide">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Team Members</h2>
          <Button
            type="button"
            onClick={() => setIsModalOpen(true)}
            disabled={isSubmitting}
            className="h-10 rounded-md bg-primary px-4 text-white hover:bg-[#001d3d] font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <UserPlus size={18} />
            Add Team Member
          </Button>
        </div>

        {queuedMembers.length === 0 ? (
          <p className="text-sm text-slate-500">No team members added yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-sm">
            {queuedMembers.map((member) => (
              <li key={member.email} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-bold text-slate-800">{member.email}</p>
                  <p className="text-slate-500">
                    {permissionLabels[member.permission] || member.permission} &middot; {roleLabels[member.role] || member.role}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(member.email)}
                  disabled={isSubmitting}
                  className="text-slate-400 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Remove ${member.email}`}
                >
                  <X size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-between items-center pt-4">
          <Button
            type="button"
            variant="secondary"
            className="bg-[#002a54] hover:bg-[#001d3d] text-white px-8 flex items-center gap-2 disabled:opacity-50"
            onClick={onBack}
            disabled={isSubmitting}
          >
            <ArrowLeft size={18} />
            Back
          </Button>
          <Button
            type="button"
            onClick={finish}
            disabled={isSubmitting}
            className="bg-[#002a54] hover:bg-[#001d3d] px-10 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                {queuedMembers.length > 0 ? 'Finish & Create Project' : 'Skip for Now'}
                <ArrowRight size={18} />
              </>
            )}
          </Button>
        </div>
      </div>

      <AddTeamMemberModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onInvite={handleQueueInvite} />
    </div>
  );
}
