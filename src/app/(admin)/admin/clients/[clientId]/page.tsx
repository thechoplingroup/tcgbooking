"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Service → rebooking interval mapping
function getRebookInterval(serviceName: string): string {
  const name = serviceName.toLowerCase();
  if (/keratin/.test(name)) return "3 months";
  if (/balayage.*(color|smudge)|color.*balayage/.test(name)) return "8 weeks";
  if (/balayage/.test(name)) return "12 weeks";
  if (/baby.?light|babylight/.test(name)) return "10 weeks";
  if (/partial|full.*highlight|highlight/.test(name)) return "10 weeks";
  if (/color.correction|correction/.test(name)) return "consultation";
  if (/color.*gloss|gloss/.test(name)) return "6 weeks";
  if (/root.touch|touch.up|maintenance/.test(name)) return "6 weeks";
  if (/full.color|color.*highlight/.test(name)) return "8 weeks";
  if (/color/.test(name)) return "8 weeks";
  if (/cut|trim|bang|women|men|children/.test(name)) return "6 weeks";
  return "6 weeks";
}

function getSuggestedDate(lastDate: string, serviceName: string): string | null {
  const interval = getRebookInterval(serviceName);
  if (interval === "consultation") return null;
  const weeks = interval.includes("month") ? parseInt(interval) * 4 : parseInt(interval);
  const d = new Date(lastDate);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

interface AppointmentRow {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  service?: { id: string; name: string; duration_minutes: number } | null;
}

interface ClientDetail {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

interface Stats {
  totalAppointments: number;
  totalConfirmed: number;
  firstBooking: string | null;
}

export default function ClientDetailPage({ params }: { params: { clientId: string } }) {
  const { clientId } = params;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [notes, setNotes] = useState("");
  const [notesOriginal, setNotesOriginal] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Rebook sheet
  const [showRebook, setShowRebook] = useState(false);
  const [rebookMessage, setRebookMessage] = useState("");
  const [rebookDate, setRebookDate] = useState("");
  const [rebookSending, setRebookSending] = useState(false);
  const [rebookSent, setRebookSent] = useState(false);
  const [rebookError, setRebookError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/clients/${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data.client);
        setStats(data.stats);
        setAppointments(data.appointments ?? []);
        const n = data.notes ?? "";
        setNotes(n);
        setNotesOriginal(n);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  // Pre-fill rebook message when sheet opens
  useEffect(() => {
    if (!showRebook || !client || appointments.length === 0) return;
    const lastAppt = appointments[0];
    const svcName = lastAppt?.service?.name ?? "";
    const interval = getRebookInterval(svcName);
    const firstName = client.full_name?.split(" ")[0] ?? "there";

    const sugDate = lastAppt?.start_at ? getSuggestedDate(lastAppt.start_at, svcName) : null;
    setRebookDate(sugDate ?? "");

    if (interval === "consultation") {
      setRebookMessage(
        `Hey ${firstName}! It was great seeing you. For your next color correction, I'd love to set up a quick consultation first so we can plan the best approach. Feel free to reach out anytime!\n\n— Keri`
      );
    } else {
      const dateStr = sugDate
        ? new Date(sugDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })
        : "soon";
      setRebookMessage(
        `Hey ${firstName}! It was so great seeing you. Your ${svcName || "hair"} is due for a refresh in about ${interval} — around ${dateStr} would be perfect timing. Tap below to grab your spot!\n\n— Keri`
      );
    }
  }, [showRebook, client, appointments]);

  async function saveNotes() {
    setNotesSaving(true);
    const res = await fetch(`/api/admin/clients/${clientId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) {
      setNotesOriginal(notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    }
    setNotesSaving(false);
  }

  async function sendRebook() {
    setRebookSending(true);
    setRebookError(null);
    const res = await fetch(`/api/admin/clients/${clientId}/rebook-reminder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: rebookMessage, suggestedDate: rebookDate || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setRebookSent(true);
      setTimeout(() => {
        setShowRebook(false);
        setRebookSent(false);
      }, 2000);
    } else {
      setRebookError(data.error ?? "Failed to send");
    }
    setRebookSending(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-[#8a7e78]">Client not found.</p>
        <Link href="/admin/clients" className="text-sm text-[#9b6f6f] mt-2 inline-block hover:underline">
          ← Back to clients
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    confirmed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    cancelled: "bg-red-100 text-red-600",
    reschedule_requested: "bg-blue-100 text-blue-700",
  };

  return (
    <>
      {/* Rebook sheet backdrop */}
      {showRebook && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => !rebookSending && setShowRebook(false)} />
      )}
      {/* Rebook sheet */}
      {showRebook && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-w-2xl mx-auto lg:inset-x-auto lg:w-[600px] lg:left-1/2 lg:-translate-x-1/2">
          <div className="w-10 h-1 bg-[#e8e2dc] rounded-full mx-auto mb-4" />
          <h3 className="font-display text-lg text-[#1a1714] mb-1">Send Rebooking Reminder</h3>
          <p className="text-xs text-[#8a7e78] mb-4">to {client.email}</p>

          {rebookSent ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-display text-base text-[#1a1714]">Reminder sent!</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Message</label>
                <textarea
                  value={rebookMessage}
                  onChange={(e) => setRebookMessage(e.target.value)}
                  rows={6}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] resize-none"
                  style={{ fontSize: 16 }}
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">
                  Suggested date <span className="font-normal text-[#8a7e78]">(optional)</span>
                </label>
                <input
                  type="date"
                  value={rebookDate}
                  onChange={(e) => setRebookDate(e.target.value)}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                  style={{ fontSize: 16 }}
                />
              </div>
              {rebookError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">
                  <p className="text-sm text-red-700">{rebookError}</p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={sendRebook}
                  disabled={rebookSending || !rebookMessage}
                  className="flex-1 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-all"
                >
                  {rebookSending ? "Sending…" : "Send Reminder"}
                </button>
                <button
                  onClick={() => setShowRebook(false)}
                  className="px-5 py-2.5 border border-[#e8e2dc] text-sm text-[#8a7e78] font-medium rounded-full hover:bg-[#f5f0eb] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="max-w-2xl">
        <div className="mb-5">
          <Link href="/admin/clients" className="text-xs text-[#8a7e78] hover:text-[#9b6f6f] inline-flex items-center gap-1 mb-3 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to clients
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center flex-shrink-0 border border-[#e8e2dc]">
                <span className="text-[#9b6f6f] font-semibold text-lg">
                  {(client.full_name ?? client.email ?? "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="font-display text-2xl text-[#1a1714]">
                  {client.full_name ?? "(no name)"}
                </h1>
                <p className="text-sm text-[#8a7e78]">{client.email ?? "—"}</p>
              </div>
            </div>
            <button
              onClick={() => setShowRebook(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Send Reminder</span>
              <span className="sm:hidden">Remind</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-2xl border border-[#e8e2dc] px-4 py-3 text-center">
              <p className="text-2xl font-display text-[#9b6f6f]">{stats.totalAppointments}</p>
              <p className="text-xs text-[#8a7e78] mt-0.5">Total visits</p>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8e2dc] px-4 py-3 text-center">
              <p className="text-2xl font-display text-[#9b6f6f]">{stats.totalConfirmed}</p>
              <p className="text-xs text-[#8a7e78] mt-0.5">Confirmed</p>
            </div>
            <div className="bg-white rounded-2xl border border-[#e8e2dc] px-4 py-3 text-center">
              <p className="text-sm font-semibold text-[#1a1714]">
                {stats.firstBooking
                  ? new Date(stats.firstBooking).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                  : "—"}
              </p>
              <p className="text-xs text-[#8a7e78] mt-0.5">First booking</p>
            </div>
          </div>
        )}

        {/* Private notes */}
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-[#1a1714]">Private Notes</p>
              <p className="text-xs text-[#8a7e78]">Only you can see these.</p>
            </div>
            {notes !== notesOriginal && (
              <button
                onClick={saveNotes}
                disabled={notesSaving}
                className="text-xs px-3 py-1.5 bg-[#9b6f6f] text-white rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-colors"
              >
                {notesSaving ? "Saving…" : "Save"}
              </button>
            )}
            {notesSaved && notes === notesOriginal && (
              <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>
            )}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Allergies, preferences, color history, notes from last visit…"
            className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] resize-none"
            style={{ fontSize: 16 }}
          />
        </div>

        {/* Appointment history */}
        <div>
          <p className="text-sm font-semibold text-[#1a1714] mb-3">Appointment History</p>
          {appointments.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-[#e8e2dc]">
              <p className="text-sm text-[#8a7e78]">No appointments on record.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#e8e2dc] divide-y divide-[#f5f0eb] overflow-hidden">
              {appointments.map((a) => (
                <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1a1714]">
                      {a.service?.name ?? "Service"}
                    </p>
                    <p className="text-xs text-[#8a7e78] mt-0.5">
                      {new Date(a.start_at).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: new Date(a.start_at).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
                      })}{" "}
                      ·{" "}
                      {new Date(a.start_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColors[a.status] ?? "bg-[#f5f0eb] text-[#8a7e78]"}`}>
                    {a.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
