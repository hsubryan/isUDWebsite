'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Camera } from 'lucide-react';
import Button from './ui/Button';
import Link from 'next/link';

export default function ProfileUpdateForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationPassword, setVerificationPassword] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    emailAddress: '',
    telephone: '',
    jobTitle: '',
    company: '',
    role: '',
    reason: '',
    password: '',
    confirmPassword: '',
    securityQuestion: '',
    securityAnswer: '',
  });

  // Fetch current user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/user/me');
        if (response.ok) {
          const data = await response.json();
          setFormData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            emailAddress: data.email || '',
            telephone: data.telephone || '',
            jobTitle: data.jobTitle || '',
            company: data.company || '',
            role: data.professionRole || 'Project Architect/Design Team',
            reason: data.reason || 'Just browsing / Interested in Universal Design',
            password: '',
            confirmPassword: '',
            securityQuestion: data.securityQuestion || 'What was the name of your first pet?',
            securityAnswer: '',
          });
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
      } finally {
        setFetching(false);
      }
    };
    fetchUser();
  }, []);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: verificationPassword }),
      });

      if (!response.ok) {
        throw new Error("Invalid password. Please try again.");
      }

      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, currentPassword: verificationPassword }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || "Failed to update profile");
      }

      // Success - stay on page or redirect
      alert("Profile updated successfully!");
      router.refresh();
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

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  // Step 1: Password Verification
  if (step === 1) {
    return (
      <div className="w-full">
        {/* Header Bar */}
        <div className="bg-white border border-slate-200 rounded-sm px-6 py-4 flex items-center shadow-sm mb-8 mx-8">
          <h1 className="text-xl font-bold text-primary tracking-tight">User Profile</h1>
        </div>

        <div className="max-w-4xl mx-auto px-8 mt-12 mb-20 text-center">
            <p className="text-sm text-slate-600 mb-12">
                By saving your profile, you agree to the <Link href="/terms" className="text-[#005ebb] hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-[#005ebb] hover:underline">Privacy Policy</Link> © {new Date().getFullYear()} University at Buffalo. All rights reserved.
            </p>

            <div className="max-w-xl mx-auto text-left">
                <h2 className="text-xl font-bold text-slate-900 mb-1">Enter your password</h2>
                <p className="text-sm text-slate-500 mb-6">As an added security measure, re-enter your password.</p>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium rounded-r-md">
                        {error}
                    </div>
                )}

                <form onSubmit={handleVerifyPassword} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 block uppercase tracking-wider">
                            Password
                        </label>
                        <input
                            type="password"
                            value={verificationPassword}
                            onChange={(e) => setVerificationPassword(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-md px-4 py-4 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all"
                            required
                        />
                    </div>

                    <div className="flex justify-between items-center pt-4">
                        <Link href="/" className="text-sm text-[#005ebb] hover:underline">
                            Back to Home Page
                        </Link>
                        <Button 
                            type="submit" 
                            variant="primary" 
                            size="lg" 
                            className="bg-[#002a54] hover:bg-[#001d3d] px-12 py-3 h-auto min-w-[140px]"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Submit'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
      </div>
    );
  }

  // Step 2: Profile Update Form
  return (
    <div className="w-full pb-20">
      {/* Header Bar */}
      <div className="bg-[#f8f9fa] border-y border-slate-200 py-3 px-8 mb-8">
        <h1 className="text-xl font-bold text-slate-800">User Profile</h1>
      </div>

      <div className="max-w-4xl mx-auto px-8">
        {error && (
            <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium rounded-r-md">
                {error}
            </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-8">
            {/* Row 1: First and Last Name */}
            <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600 block">
                        First Name<span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600 block">
                        Last Name<span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all"
                        required
                    />
                </div>
            </div>

            {/* Row 2: Email */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600 block">
                    E-mail Address<span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative">
                    <input
                        type="email"
                        name="emailAddress"
                        value={formData.emailAddress}
                        onChange={handleInputChange}
                        className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all pr-10"
                        required
                    />
                    <Camera className="absolute right-3 top-3 text-slate-400" size={18} />
                </div>
            </div>

            {/* Row 3: Telephone */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600 block">
                    Telephone<span className="text-red-500 ml-1">*</span>
                </label>
                <div className="relative flex">
                    <div className="flex items-center gap-1 border border-r-0 border-slate-300 rounded-l-md px-3 bg-white">
                        <span className="text-lg">🇺🇸</span>
                        <span className="text-slate-400 rotate-0">▾</span>
                    </div>
                    <input
                        type="tel"
                        name="telephone"
                        value={formData.telephone}
                        onChange={handleInputChange}
                        className="w-full border border-slate-300 rounded-r-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all"
                        required
                    />
                </div>
            </div>

            {/* Row 4: Job Title */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600 block">Job Title</label>
                <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all"
                />
            </div>

            {/* Row 5: Company */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600 block">Company</label>
                <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all"
                />
            </div>

            {/* Selection Fields */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600 block leading-relaxed">
                    Which of the following best describes your role on a Universal Design project?<span className="text-red-500 ml-1">*</span>
                </label>
                <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all bg-white"
                    required
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
                <label className="text-sm font-semibold text-slate-600 block leading-relaxed">
                    What is your primary reason for creating an account today?<span className="text-red-500 ml-1">*</span>
                </label>
                <select
                    name="reason"
                    value={formData.reason}
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all bg-white"
                    required
                >
                    <option>Just browsing / Interested in Universal Design</option>
                    <option>Currently working on a Universal Design project</option>
                    <option>Anticipating starting a Universal Design project in the next few months</option>
                    <option>Anticipating starting a Universal Design project in the next few years</option>
                    <option>Interested in benchmarking an existing building or past project</option>
                </select>
            </div>

            {/* Security Fields */}
            <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600 block">
                        Password<span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        placeholder="Password"
                        onChange={handleInputChange}
                        className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all bg-white"
                    />
                    <p className="text-xs text-slate-400">At least 8 characters. Letters, numbers, and symbols are all allowed.</p>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600 block">
                        Confirm Password<span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        placeholder="Confirm Password"
                        onChange={handleInputChange}
                        className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all bg-white"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600 block">
                    Security Question<span className="text-red-500 ml-1">*</span>
                </label>
                <select
                    name="securityQuestion"
                    value={formData.securityQuestion}
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all bg-white"
                    required
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
            
            <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600 block">
                    Security Answer<span className="text-red-500 ml-1">*</span>
                </label>
                <input
                    type="text"
                    name="securityAnswer"
                    value={formData.securityAnswer}
                    placeholder="Security Answer"
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none transition-all"
                />
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-8">
                <Button 
                    type="submit" 
                    variant="primary" 
                    size="lg" 
                    className="bg-[#002a54] hover:bg-[#001d3d] h-auto py-3 px-12"
                    disabled={loading}
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Save'}
                </Button>
            </div>
        </form>
      </div>
    </div>
  );
}
