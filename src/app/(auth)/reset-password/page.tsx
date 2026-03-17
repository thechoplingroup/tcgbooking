"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/update-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl border shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2">Check your email</h2>
          <p className="text-sm text-gray-500">
            If <strong>{email}</strong> has an account, you&apos;ll receive a password reset link shortly.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm text-blue-600 hover:text-blue-800"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border shadow-sm p-8">
          <h1 className="text-xl font-bold mb-1 text-center">Reset password</h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            Enter your email and we&apos;ll send you a reset link
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-[0.98] text-sm min-h-[48px]"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>

          <p className="text-sm text-center text-gray-500 mt-5">
            <Link href="/login" className="text-blue-600 hover:text-blue-800">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
