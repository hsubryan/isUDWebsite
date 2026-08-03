'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import Button from '@/components/ui/Button';

const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What was the make of your first car?',
  'In what city or town did you live when you started high school?',
  'What is your mother’s birth year?',
  'What is your oldest sibling’s middle name?',
  'What was the name of your wedding first dance song?',
  'What was the first name of your first boyfriend/girlfriend?',
  'What was the last name of your first grade teacher?',
  'What was the first name of the boss at your first job?',
];

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [requiresSecurityQuestion, setRequiresSecurityQuestion] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setCheckingToken(false);
      return;
    }

    fetch(`/api/user/password-recovery?token=${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.requiresSecurityQuestion) setRequiresSecurityQuestion(true);
      })
      .catch(() => {})
      .finally(() => setCheckingToken(false));
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/user/password-recovery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          requiresSecurityQuestion
            ? { token, password, securityQuestion, securityAnswer }
            : { token, password }
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to set password');

      router.push('/login?passwordReset=1');
    } catch (err: any) {
      setError(err.message || 'Unable to set password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-r-md border-l-4 border-red-500 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {!token && (
        <div className="rounded-r-md border-l-4 border-red-500 bg-red-50 p-4 text-sm font-medium text-red-700">
          Missing password setup token.
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-semibold uppercase tracking-wider text-muted">New Password</label>
        <div className="relative">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            disabled={loading || !token}
            className="w-full rounded-sm border border-slate-300 px-4 py-3 pr-10 text-sm outline-none transition-all focus:border-secondary focus:ring-2 focus:ring-secondary"
            placeholder="new password"
          />
          <Lock className="absolute right-3 top-3.5 text-slate-400" size={18} />
        </div>
        <p className="text-xs text-slate-400">At least 8 characters. Letters, numbers, and symbols are all allowed.</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold uppercase tracking-wider text-muted">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
          disabled={loading || !token}
          className="w-full rounded-sm border border-slate-300 px-4 py-3 text-sm outline-none transition-all focus:border-secondary focus:ring-2 focus:ring-secondary"
          placeholder="confirm password"
        />
      </div>

      {requiresSecurityQuestion && (
        <div className="space-y-6 border-t border-slate-100 pt-6">
          <p className="text-sm leading-relaxed text-slate-600">
            Set a security question so you can recover your account yourself next time.
          </p>
          <div className="space-y-2">
            <label className="block text-sm font-semibold uppercase tracking-wider text-muted">Security Question</label>
            <select
              value={securityQuestion}
              onChange={(event) => setSecurityQuestion(event.target.value)}
              required
              disabled={loading || !token}
              className="w-full rounded-sm border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-secondary focus:ring-2 focus:ring-secondary"
            >
              {SECURITY_QUESTIONS.map((question) => (
                <option key={question}>{question}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold uppercase tracking-wider text-muted">Security Answer</label>
            <input
              type="text"
              value={securityAnswer}
              onChange={(event) => setSecurityAnswer(event.target.value)}
              required
              disabled={loading || !token}
              className="w-full rounded-sm border border-slate-300 px-4 py-3 text-sm outline-none transition-all focus:border-secondary focus:ring-2 focus:ring-secondary"
              placeholder="your answer"
            />
          </div>
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" className="w-full bg-[#002a54] hover:bg-[#001d3d]" disabled={loading || checkingToken || !token}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : 'Set Password'}
      </Button>
    </form>
  );
}
