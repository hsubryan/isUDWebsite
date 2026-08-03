'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Phone, Loader2 } from 'lucide-react';
import Button from './ui/Button';

function getSafeCallbackUrl(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    emailAddress: '',
    telephone: '',
    jobTitle: '',
    company: '',
    role: 'Project Architect/Design Team',
    reason: 'Just browsing / Interested in Universal Design',
    password: '',
    confirmPassword: '',
    securityQuestion: 'What was the name of your first pet?',
    securityAnswer: '',
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Something went wrong during registration");
      }

      // Success - Redirect to login with a message
      const params = new URLSearchParams({ registered: 'true' });
      if (callbackUrl !== '/') params.set('callbackUrl', callbackUrl);
      router.push(`/login?${params.toString()}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="w-full space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-primary tracking-tight">Create a New Free Account</h2>
        <p className="text-sm font-medium text-muted">
          to browse all 500 solutions, and select and save the ones you want in your project
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium rounded-r-md">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-8">
        
        {/* Row 1: First and Last Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block">
              First Name<span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              name="firstName"
              placeholder="First Name"
              className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all focus:border-secondary"
              required
              onChange={handleInputChange}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block">
              Last Name<span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all focus:border-secondary"
              required
              onChange={handleInputChange}
            />
          </div>
        </div>

        {/* Row 2: Email and Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block">
              E-mail Address<span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative" suppressHydrationWarning>
              <input
                type="email"
                name="emailAddress"
                placeholder="E-mail Address"
                className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all focus:border-secondary pr-10"
                required
                onChange={handleInputChange}
              />
              <Mail className="absolute right-3 top-3.5 text-slate-400" size={18} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block">
              Telephone<span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative" suppressHydrationWarning>
              <input
                type="tel"
                name="telephone"
                placeholder="(201) 555-5555"
                className="w-full border border-slate-300 rounded-sm px-10 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all focus:border-secondary"
                required
                onChange={handleInputChange}
              />
              <Phone className="absolute left-3 top-3.5 text-slate-400" size={18} />
            </div>
          </div>
        </div>

        {/* Row 3: Job Title and Company */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block">Job Title</label>
            <div className="relative">
              <input
                type="text"
                name="jobTitle"
                placeholder="Job Title"
                className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all focus:border-secondary"
                onChange={handleInputChange}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block">Company</label>
            <div className="relative">
              <input
                type="text"
                name="company"
                placeholder="Name of your Organization"
                className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all focus:border-secondary"
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Selection Fields */}
        <div className="space-y-6 pt-4 border-t border-slate-100">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block leading-relaxed max-w-lg">
              Which of the following best describes your role on a Universal Design project?<span className="text-red-500 ml-1">*</span>
            </label>
            <select
              name="role"
              className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all bg-white"
              required
              onChange={handleInputChange}
            >
              <option>Project Architect/Design Team</option>
              <option>Consultant</option>
              <option>Real Estate Development</option>
              <option>Ownership/Management</option>
              <option>Human Resources</option>
              <option>Community Advocate</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block leading-relaxed max-w-lg">
              What is your primary reason for creating an account today?<span className="text-red-500 ml-1">*</span>
            </label>
            <select
              name="reason"
              className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all bg-white"
              required
              onChange={handleInputChange}
            >
              <option>Just browsing / Interested in Universal Design</option>
              <option>Currently working on a Universal Design project</option>
              <option>Anticipating starting a Universal Design project in the next few months</option>
              <option>Anticipating starting a Universal Design project in the next few years</option>
              <option>Interested in benchmarking an existing building or past project</option>
            </select>
          </div>
        </div>

        {/* Security Fields */}
        <div className="space-y-6 pt-4 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2" suppressHydrationWarning>
              <label className="text-sm font-semibold text-muted uppercase tracking-wider block">
                Password<span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="password"
                name="password"
                placeholder="Password"
                minLength={8}
                className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all focus:border-secondary"
                required
                onChange={handleInputChange}
              />
              <p className="text-xs text-slate-400">At least 8 characters. Letters, numbers, and symbols are all allowed.</p>
            </div>
            <div className="space-y-2" suppressHydrationWarning>
              <label className="text-sm font-semibold text-muted uppercase tracking-wider block">
                Confirm Password<span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all focus:border-secondary"
                required
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted uppercase tracking-wider block">
                Security Question<span className="text-red-500 ml-1">*</span>
              </label>
              <select
                name="securityQuestion"
                className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all bg-white"
                required
                onChange={handleInputChange}
              >
                <option>What was the name of your first pet?</option>
                <option>What was the make of your first car?</option>
                <option>In what city or town did you live when you started high school?</option>
                <option>What is your mother’s birth year?</option>
                <option>What is your oldest sibling’s middle name?</option>
                <option>What was the name of your wedding first dance song?</option>
                <option>What was the first name of your first boyfriend/girlfriend?</option>
                <option>What was the last name of your first grade teacher?</option>
                <option>What was the first name of the boss at your first job?</option>
              </select>
            </div>
            <div className="space-y-2" suppressHydrationWarning>
              <label className="text-sm font-semibold text-muted uppercase tracking-wider block">
                Security Answer<span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                name="securityAnswer"
                placeholder="Security Answer"
                className="w-full border border-slate-300 rounded-sm px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all focus:border-secondary"
                required
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-8">
          <Button 
            type="submit" 
            variant="primary" 
            size="lg" 
            className="w-full sm:w-auto px-16 bg-[#002a54] hover:bg-[#001d3d] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
