'use client';

import { useState } from 'react';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ProjectProfileForm, { ProjectProfileFormData } from '@/components/ProjectProfileForm';
import AddProjectTeamStep from '@/components/AddProjectTeamStep';

export default function NewProjectPage() {
  const [step, setStep] = useState<'profile' | 'team'>('profile');
  const [draftData, setDraftData] = useState<ProjectProfileFormData | null>(null);

  const breadcrumbItems = [
    { label: 'My Projects', href: '/' },
    { label: 'Project Profile' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="bg-white border border-slate-200 rounded-sm px-6 py-4 flex items-center shadow-sm">
        <h1 className="text-xl font-bold text-primary tracking-tight">Project Profile</h1>
      </div>

      {step === 'profile' || !draftData ? (
        <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden p-6 sm:p-8">
          <ProjectProfileForm
            initialData={draftData || undefined}
            onCreateDraft={(data) => {
              setDraftData(data);
              setStep('team');
            }}
          />
        </div>
      ) : (
        <AddProjectTeamStep draftData={draftData} onBack={() => setStep('profile')} />
      )}
    </div>
  );
}
