"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  ShieldCheck,
  Wallet,
  BookOpen,
  Baby,
  Users,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Lock,
  Mail,
} from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    role: "Headmaster (Admin)",
    badge: "Admin",
    email: "headmaster@sankofa.edu.gh",
    password: "Password123!",
    icon: ShieldCheck,
    accent: "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100/70",
  },
  {
    role: "Accountant",
    badge: "Finance",
    email: "bursar@sankofa.edu.gh",
    password: "Password123!",
    icon: Wallet,
    accent: "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100/70",
  },
  {
    role: "Teacher (Primary/JHS)",
    badge: "Academics",
    email: "teacher@sankofa.edu.gh",
    password: "Password123!",
    icon: BookOpen,
    accent: "text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100/70",
  },
  {
    role: "Teacher (Creche Care)",
    badge: "Creche",
    email: "comfort.adjei@sankofa.edu.gh",
    password: "Password123!",
    icon: Baby,
    accent: "text-pink-700 bg-pink-50 border-pink-200 hover:bg-pink-100/70",
  },
  {
    role: "Parent (Phone or Email)",
    badge: "Multi-Child",
    email: "+233 24 900 4411",
    password: "Password123!",
    icon: Users,
    accent: "text-violet-700 bg-violet-50 border-violet-200 hover:bg-violet-100/70",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  function fillAccount(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Brand Showcase */}
      <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white lg:w-[44%] xl:w-[46%] p-6 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden">
        {/* Subtle geometric accent */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-emerald-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-amber-400 text-emerald-950 flex items-center justify-center shadow-lg">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight leading-tight">
                Sankofa Preparatory &amp; JHS
              </p>
              <p className="text-xs text-emerald-200 font-medium">
                Accra, Ghana &bull; GES-Aligned School Portal
              </p>
            </div>
          </div>

          <div className="mt-8 lg:mt-16 max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-amber-300 border border-white/15">
              Unified Role-Based Access Portal
            </span>
            <h1 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
              One modern platform for every role in your basic school.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-emerald-100/90 leading-relaxed">
              Manage Creche, KG, Primary, and JHS admissions, daily attendance,
              GES continuous assessments, and GH₵ Mobile Money fee receipts from
              any phone or desktop.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-8 pt-6 border-t border-white/15 grid grid-cols-3 gap-3 text-center sm:text-left">
          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
              Levels
            </p>
            <p className="text-sm font-semibold mt-0.5">Creche – JHS 3</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
              Billing
            </p>
            <p className="text-sm font-semibold mt-0.5">GH₵ &amp; MoMo</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
              Security
            </p>
            <p className="text-sm font-semibold mt-0.5">4-Role RBAC</p>
          </div>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Sign in to your account
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your school credentials to access your role dashboard.
            </p>

            {error && (
              <div className="mt-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Email Address or Registered Phone Number
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    type="text"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@sankofa.edu.gh or +233 24 900 4411"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-semibold py-2.5 px-4 text-sm shadow-sm transition disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Seeded Role Quick-Fill Cards for Testing RBAC */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5 px-1">
              Quick-Fill Seeded Accounts (Password: Password123!)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_ACCOUNTS.map((acct) => {
                const Icon = acct.icon;
                return (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => fillAccount(acct.email, acct.password)}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition cursor-pointer ${acct.accent}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{acct.role}</p>
                      <p className="text-[11px] opacity-80 truncate">
                        {acct.email}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
