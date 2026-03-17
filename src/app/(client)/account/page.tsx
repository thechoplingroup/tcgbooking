"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

type Step = "idle" | "confirm-delete" | "deleting" | "signing-out";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setEmail(user.email ?? null);
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          setName(data?.full_name ?? null);
          setLoading(false);
        });
    });
  }, [router]);

  async function handleSignOut() {
    setSignOutLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleDeleteAccount() {
    setStep("deleting");
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Deletion failed");
      }
      setStep("signing-out");
      router.push("/book?deleted=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("idle");
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#f0ebe6] rounded w-32" />
          <div className="bg-white rounded-2xl border border-[#e8e2dc] p-6 space-y-3">
            <div className="h-4 bg-[#f0ebe6] rounded w-24" />
            <div className="h-6 bg-[#f0ebe6] rounded w-48" />
            <div className="h-4 bg-[#f0ebe6] rounded w-24 mt-4" />
            <div className="h-6 bg-[#f0ebe6] rounded w-64" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#1a1714]">My Account</h1>
        <p className="text-[#8a7e78] text-sm mt-1">Manage your account settings</p>
      </div>

      {/* Profile info */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-[#f5f0eb]">
          <p className="text-xs font-semibold text-[#c9a96e] uppercase tracking-widest">Account Info</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          {name && (
            <div>
              <p className="text-xs text-[#8a7e78] mb-0.5">Name</p>
              <p className="text-base font-medium text-[#1a1714]">{name}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-[#8a7e78] mb-0.5">Email</p>
            <p className="text-base font-medium text-[#1a1714] break-all">{email}</p>
          </div>
        </div>
      </div>

      {/* Navigation links */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-4 divide-y divide-[#f5f0eb]">
        <Link
          href="/appointments"
          className="flex items-center justify-between px-5 py-4 hover:bg-[#faf9f7] active:bg-[#f5f0eb] transition-colors min-h-[56px]"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f5ede8] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-[#1a1714]">My Appointments</span>
          </div>
          <svg className="w-4 h-4 text-[#c9a96e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Change password */}
      <ChangePasswordForm email={email} />

      {/* Sign out */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-4">
        <button
          onClick={handleSignOut}
          disabled={signOutLoading}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#faf9f7] active:bg-[#f5f0eb] transition-colors min-h-[56px] disabled:opacity-50"
        >
          <div className="w-8 h-8 rounded-lg bg-[#f5ede8] flex items-center justify-center">
            <svg className="w-4 h-4 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <span className="text-sm font-medium text-[#1a1714]">
            {signOutLoading ? "Signing out…" : "Sign Out"}
          </span>
        </button>
      </div>

      {/* Delete account */}
      <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f5f0eb]">
          <p className="text-xs font-semibold text-[#8a7e78] uppercase tracking-widest">Danger Zone</p>
        </div>

        {step === "idle" && (
          <div className="px-5 py-4">
            <p className="text-sm text-[#8a7e78] mb-4 leading-relaxed">
              You can permanently delete your account and all associated data at any time.
            </p>
            <button
              onClick={() => setStep("confirm-delete")}
              className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline active:text-red-800 transition-colors min-h-[44px] flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete my account
            </button>
          </div>
        )}

        {step === "confirm-delete" && (
          <div className="px-5 py-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1a1714] mb-1">Are you sure?</p>
                <p className="text-sm text-[#8a7e78] leading-relaxed">
                  This will <strong className="text-[#1a1714]">cancel all your upcoming appointments</strong> and permanently delete your account. This cannot be undone.
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                onClick={handleDeleteAccount}
                className="flex-1 py-3 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 active:bg-red-800 active:scale-[0.98] transition-all min-h-[48px]"
              >
                Yes, delete my account
              </button>
              <button
                onClick={() => { setStep("idle"); setError(null); }}
                className="flex-1 py-3 border-2 border-[#e8e2dc] text-[#5c4a42] text-sm font-semibold rounded-xl hover:bg-[#faf9f7] active:bg-[#f5f0eb] transition-all min-h-[48px]"
              >
                Keep my account
              </button>
            </div>
          </div>
        )}

        {(step === "deleting" || step === "signing-out") && (
          <div className="px-5 py-8 text-center">
            <div className="w-8 h-8 border-2 border-red-300 border-t-red-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#8a7e78]">
              {step === "deleting" ? "Deleting your account…" : "Done. Redirecting…"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
