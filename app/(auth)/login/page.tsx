"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Eye, EyeOff, Lock, UserCircle } from "lucide-react";
import api, { errorMessage, getToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Alert, Button } from "@/components/ui";
import type { AdminUser } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Staff-only endpoint: students and parents are rejected by the backend
      const res = await api.post<{ token: string; user: AdminUser }>("/admin/auth/login", { identifier: identifier.trim(), password });
      login(res.data.token, res.data.user);
      router.replace("/dashboard");
    } catch (err) {
      setError(errorMessage(err, "Sign in failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden px-4">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative bg-white border border-slate-200 shadow-xl rounded-2xl p-8 sm:p-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sutra Edu Admin</h1>
          <p className="text-slate-500 text-sm mt-1">Curriculum, books and access management</p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Email or phone</span>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="you@sutraedu.com"
                required
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </label>

          {error && <Alert>{error}</Alert>}

          <Button type="submit" loading={loading} className="w-full py-3 rounded-xl">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
