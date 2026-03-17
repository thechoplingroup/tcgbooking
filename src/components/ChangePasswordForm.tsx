"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";

interface ChangePasswordFormProps {
  email: string | null;
}

export function ChangePasswordForm({ email }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();

      // Verify current password via re-auth
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email ?? "",
        password: currentPassword,
      });
      if (signInError) {
        setError("Current password is incorrect.");
        setSaving(false);
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        toast("Password updated ✓", "success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-[#f5f0eb]">
        <p className="text-xs font-semibold text-[#c9a96e] uppercase tracking-widest">Change Password</p>
      </div>
      <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Your current password"
            autoComplete="current-password"
            className="w-full border border-[#e8e2dc] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min 8 characters"
            autoComplete="new-password"
            minLength={8}
            className="w-full border border-[#e8e2dc] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
            autoComplete="new-password"
            className="w-full border border-[#e8e2dc] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] min-h-[44px]"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 active:scale-[0.99] transition-all min-h-[44px]"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Updating…
            </span>
          ) : (
            "Update Password"
          )}
        </button>
      </form>
    </div>
  );
}
