"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/book";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#5c4a42] mb-1.5">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-[#e8e2dc] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-[#5c4a42]">Password</label>
          <Link href="/reset-password" className="text-xs text-[#9b6f6f] hover:text-[#8a5f5f]">
            Forgot password?
          </Link>
        </div>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-[#e8e2dc] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 bg-[#9b6f6f] text-white font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-colors text-sm"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Signing in…
          </span>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-[#9b6f6f] flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-lg font-bold">K</span>
          </div>
          <h1 className="font-display text-2xl text-[#1a1714]">Welcome back</h1>
          <p className="text-sm text-[#8a7e78] mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e8e2dc] shadow-sm p-7">
          <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" /></div>}>
            <LoginForm />
          </Suspense>

          <p className="text-sm text-center text-[#8a7e78] mt-5">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#9b6f6f] hover:text-[#8a5f5f] font-medium">
              Sign up
            </Link>
          </p>
        </div>

        <p className="text-center mt-6">
          <Link href="/" className="text-xs text-[#8a7e78] hover:text-[#9b6f6f]">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
