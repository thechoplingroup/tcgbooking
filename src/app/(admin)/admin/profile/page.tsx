"use client";

import { useEffect, useState } from "react";
import type { Stylist } from "@/lib/supabase/types";

export default function ProfilePage() {
  const [stylist, setStylist] = useState<Stylist | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/profile")
      .then((r) => r.json())
      .then(({ stylist }) => {
        if (stylist) {
          setStylist(stylist);
          setName(stylist.name ?? "");
          setBio(stylist.bio ?? "");
          setAvatarUrl(stylist.avatar_url ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, avatar_url: avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to save" });
      } else {
        setStylist(data.stylist);
        setMessage({ type: "success", text: "Profile saved successfully." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#1a1714]">My Profile</h1>
        <p className="text-[#8a7e78] text-sm mt-1">
          This is what clients see on your booking page.
        </p>
      </div>

      {/* Preview card */}
      {stylist && (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-6 flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="w-14 h-14 rounded-full object-cover border-2 border-[#e8e2dc] flex-shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center flex-shrink-0 border-2 border-[#e8e2dc]">
              <span className="text-2xl font-display text-[#9b6f6f]">
                {name.charAt(0) || "K"}
              </span>
            </div>
          )}
          <div>
            <p className="font-display text-lg text-[#1a1714]">{name || "Your Name"}</p>
            {bio && <p className="text-xs text-[#8a7e78] mt-0.5 line-clamp-2">{bio}</p>}
          </div>
          <span className="ml-auto text-xs text-[#c9a96e] bg-[#fdf6ec] px-2 py-1 rounded-full font-medium flex-shrink-0">
            Preview
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#e8e2dc] p-5 sm:p-6 space-y-5">
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
            className="w-full border border-[#e8e2dc] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#5c4a42] mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Tell clients about your style, specialties, and experience…"
            className="w-full border border-[#e8e2dc] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] resize-none leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#5c4a42] mb-1.5">Photo URL</label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/your-photo.jpg"
            className="w-full border border-[#e8e2dc] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
          />
          <p className="text-xs text-[#8a7e78] mt-1.5">
            Link to a professional photo. Shown as a circle on your booking page.
          </p>
        </div>

        {message && (
          <div className={`px-4 py-3 rounded-xl text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving…
            </span>
          ) : (
            stylist ? "Update Profile" : "Create Profile"
          )}
        </button>
      </form>
    </div>
  );
}
