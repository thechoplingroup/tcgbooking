"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Stylist } from "@/lib/supabase/types";
import { useToast } from "@/components/Toast";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

const MAX_BIO = 300;

export default function ProfilePage() {
  const [stylist, setStylist] = useState<Stylist | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Get admin email for password change
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setAdminEmail(user.email);
      });
    });

    fetch("/api/admin/profile")
      .then((r) => r.json())
      .then(({ stylist }) => {
        if (stylist) {
          setStylist(stylist);
          setName(stylist.name ?? "");
          setBio(stylist.bio ?? "");
          setAvatarUrl(stylist.avatar_url ?? "");
          setCancellationPolicy((stylist as { cancellation_policy?: string }).cancellation_policy ?? "");
          // Build booking URL
          const base = typeof window !== "undefined" ? window.location.origin : "https://tcgbooking.vercel.app";
          setBookingUrl(`${base}/book/${stylist.id}`);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio: bio.slice(0, MAX_BIO),
          avatar_url: avatarUrl,
          cancellation_policy: cancellationPolicy.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Failed to save", "error");
      } else {
        setStylist(data.stylist);
        const base = typeof window !== "undefined" ? window.location.origin : "https://tcgbooking.vercel.app";
        setBookingUrl(`${base}/book/${data.stylist.id}`);
        toast("Profile saved ✓", "success");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  async function copyBookingUrl() {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("Booking URL copied!", "success");
  }

  if (loading) {
    return (
      <div className="max-w-xl animate-pulse">
        <div className="h-8 bg-[#f0ebe6] rounded w-40 mb-6" />
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-6 h-20" />
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-6 space-y-5">
          <div className="h-10 bg-[#f0ebe6] rounded-xl" />
          <div className="h-24 bg-[#f0ebe6] rounded-xl" />
          <div className="h-10 bg-[#f0ebe6] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#1a1714]">My Profile</h1>
        <p className="text-[#8a7e78] text-sm mt-1">This is what clients see on your booking page.</p>
      </div>

      {/* Preview */}
      {stylist && (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-5 flex items-center gap-4">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={name} width={56} height={56} className="w-14 h-14 rounded-full object-cover border-2 border-[#e8e2dc] flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center flex-shrink-0 border-2 border-[#e8e2dc]">
              <span className="text-2xl font-display text-[#9b6f6f]">{name.charAt(0) || "K"}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg text-[#1a1714]">{name || "Your Name"}</p>
            {bio && <p className="text-xs text-[#8a7e78] mt-0.5 line-clamp-2">{bio}</p>}
          </div>
          <span className="text-xs text-[#c9a96e] bg-[#fdf6ec] px-2 py-1 rounded-full font-medium flex-shrink-0">Preview</span>
        </div>
      )}

      {/* Booking URL */}
      {bookingUrl && (
        <div className="bg-[#f5ede8] rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <p className="text-xs text-[#8a7e78] flex-1 truncate font-mono">{bookingUrl}</p>
          <button
            onClick={copyBookingUrl}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#9b6f6f] hover:text-[#8a5f5f] transition-all active:scale-95 flex-shrink-0 min-h-[44px]"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy URL
              </>
            )}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#e8e2dc] p-5 sm:p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-[#5c4a42] mb-1.5">
            Display Name <span className="text-[#9b6f6f]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Keri Choplin"
            className="w-full border border-[#e8e2dc] rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] min-h-[44px]"
          />
        </div>

        {/* Bio with counter and preview */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <label className="text-sm font-medium text-[#5c4a42]">Bio</label>
            <span className={`text-xs ${bio.length >= MAX_BIO ? "text-red-500 font-medium" : "text-[#8a7e78]"}`}>
              {bio.length}/{MAX_BIO}
            </span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
            rows={4}
            placeholder="Tell clients about your style, specialties, and experience…"
            className="w-full border border-[#e8e2dc] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] resize-none leading-relaxed"
            style={{ fontSize: 16 }}
          />
          {bio && (
            <div className="mt-2 p-3 bg-[#faf8f5] rounded-xl border border-[#e8e2dc]">
              <p className="text-[10px] text-[#c9a96e] uppercase tracking-widest font-medium mb-1">Client preview</p>
              <p className="text-xs text-[#8a7e78] leading-relaxed">{bio}</p>
            </div>
          )}
        </div>

        {/* Photo URL */}
        <div>
          <label className="block text-sm font-medium text-[#5c4a42] mb-1.5">Photo URL</label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/your-photo.jpg"
            className="w-full border border-[#e8e2dc] rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] min-h-[44px]"
          />
          <p className="text-xs text-[#8a7e78] mt-1.5">Paste a link to a professional photo. Shown as a circle.</p>
        </div>

        {/* Cancellation policy */}
        <div>
          <label className="block text-sm font-medium text-[#5c4a42] mb-1.5">Cancellation Policy <span className="text-[#8a7e78] font-normal">(optional)</span></label>
          <input
            type="text"
            value={cancellationPolicy}
            onChange={(e) => setCancellationPolicy(e.target.value)}
            placeholder="e.g. 24-hour cancellation notice required"
            className="w-full border border-[#e8e2dc] rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] min-h-[44px]"
          />
          <p className="text-xs text-[#8a7e78] mt-1.5">Shown to clients on the booking confirmation screen.</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 active:scale-[0.99] transition-all min-h-[44px]"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          ) : stylist ? "Update Profile" : "Create Profile"}
        </button>
      </form>

      {/* Change password */}
      <div className="mt-6">
        <ChangePasswordForm email={adminEmail} />
      </div>
    </div>
  );
}
