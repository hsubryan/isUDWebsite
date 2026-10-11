'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, X, ArrowRight, Loader2 } from 'lucide-react';

interface Invitation {
  id: string;
  projectId: string;
  project: {
    projectName: string;
  };
}

export default function InvitationBanner() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const res = await fetch('/api/user/invitations');
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (projectId: string) => {
    setProcessingId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}/team`, {
        method: 'PATCH',
      });
      if (res.ok) {
        // Success - remove from local state and refresh
        setInvitations(prev => prev.filter(inv => inv.projectId !== projectId));
        window.dispatchEvent(new CustomEvent('team-invitation-accepted', { detail: { projectId } }));
        router.refresh();
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading || invitations.length === 0) return null;

  return (
    <div className="bg-[#002a54] text-white py-3 px-4 sm:px-6 lg:px-8 xl:px-12 border-b border-white/10 shadow-lg animate-in slide-in-from-top duration-500 sticky top-0 z-[60]">
      <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <Bell size={20} className="text-[#F7941D]" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium">
            You have been invited to join <span className="font-bold text-[#F7941D]">{invitations[0].project.projectName}</span>
            {invitations.length > 1 && ` and ${invitations.length - 1} other project(s)`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAccept(invitations[0].projectId)}
            disabled={!!processingId}
            className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-1.5 text-xs font-bold text-white transition-all hover:bg-[#92400e] disabled:opacity-50"
          >
            {processingId === invitations[0].projectId ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Check size={14} aria-hidden="true" />
            )}
            Accept Invitation
          </button>
          
          <button
            onClick={() => router.push(`/projects/${invitations[0].projectId}/team`)}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all"
          >
            View Team
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          
          <button 
            onClick={() => setInvitations([])} // Temporary hide
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Dismiss invitation banner"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
