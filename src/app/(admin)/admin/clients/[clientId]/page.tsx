"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";
import { STUDIO } from "@/config/studio";

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
  final_price_cents?: number | null;
  discount_cents?: number | null;
  discount_note?: string | null;
  service?: { id: string; name: string; duration_minutes: number } | null;
}

interface ServiceLogEntry {
  id: string;
  service_name: string;
  price_cents: number;
  visit_date: string;
  notes: string | null;
  service_id: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
  internal_price_cents?: number;
}

interface ClientDetail {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  created_at: string;
  clientType?: "auth" | "walkin";
}

interface Stats {
  totalAppointments: number;
  totalConfirmed: number;
  firstBooking: string | null;
}

export default function ClientDetailPage({ params }: { params: { clientId: string } }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" /></div>}>
      <ClientDetailInner params={params} />
    </Suspense>
  );
}

function ClientDetailInner({ params }: { params: { clientId: string } }) {
  const { clientId } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientType = searchParams.get("type") ?? "auth";
  const { toast } = useToast();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [serviceLog, setServiceLog] = useState<ServiceLogEntry[]>([]);
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

  // Log Service modal
  const [showLogService, setShowLogService] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [logForm, setLogForm] = useState({
    service_id: "",
    service_name: "",
    price: "",
    visit_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [logSubmitting, setLogSubmitting] = useState(false);

  // Pricing edit
  const [editingPricing, setEditingPricing] = useState<string | null>(null);
  const [pricingForm, setPricingForm] = useState({
    final_price: "",
    discount: "",
    discount_note: "",
  });
  const [pricingSaving, setPricingSaving] = useState(false);

  // Edit client info
  const [showEditClient, setShowEditClient] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", email: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Edit service log entry
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logEditForm, setLogEditForm] = useState({ service_name: "", price_cents: 0, visit_date: "", notes: "" });
  const [logEditSaving, setLogEditSaving] = useState(false);

  // Delete client
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingApptId, setDeletingApptId] = useState<string | null>(null);

  function fetchClient() {
    const typeParam = clientType === "walkin" ? "?type=walkin" : "";
    return fetch(`/api/admin/clients/${clientId}${typeParam}`)
      .then((r) => r.json())
      .then((data) => {
        setClient(data.client);
        setStats(data.stats);
        setAppointments(data.appointments ?? []);
        setServiceLog(data.serviceLog ?? []);
        const n = data.notes ?? "";
        setNotes(n);
        setNotesOriginal(n);
      });
  }

  useEffect(() => {
    fetchClient().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, clientType]);

  // Load services for Log Service modal
  useEffect(() => {
    if (!showLogService) return;
    fetch("/api/admin/services")
      .then((r) => r.json())
      .then((data) => setServices(data.services ?? []))
      .catch(() => {});
  }, [showLogService]);

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
    if (clientType === "walkin") return; // Walk-in notes are on the walk_in_clients record
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

  async function handleLogService(e: React.FormEvent) {
    e.preventDefault();
    if (!logForm.service_name.trim()) return;
    setLogSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        service_name: logForm.service_name,
        price_cents: logForm.price ? Math.round(parseFloat(logForm.price) * 100) : 0,
        visit_date: logForm.visit_date,
        notes: logForm.notes || undefined,
        service_id: logForm.service_id || undefined,
      };
      if (clientType === "walkin") {
        payload.walk_in_client_id = clientId;
      } else {
        payload.client_id = clientId;
      }

      const res = await fetch("/api/admin/service-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast("Service logged!", "success");
        setShowLogService(false);
        setLogForm({
          service_id: "",
          service_name: "",
          price: "",
          visit_date: new Date().toISOString().slice(0, 10),
          notes: "",
        });
        // Refresh
        fetchClient();
      } else {
        const data = await res.json();
        toast(data.error ?? "Failed to log service", "error");
      }
    } catch {
      toast("Failed to log service", "error");
    } finally {
      setLogSubmitting(false);
    }
  }

  function startPricingEdit(appt: AppointmentRow) {
    setEditingPricing(appt.id);
    setPricingForm({
      final_price: appt.final_price_cents ? (appt.final_price_cents / 100).toFixed(2) : "",
      discount: appt.discount_cents ? (appt.discount_cents / 100).toFixed(2) : "",
      discount_note: appt.discount_note ?? "",
    });
  }

  async function savePricing(apptId: string) {
    setPricingSaving(true);
    try {
      const res = await fetch(`/api/admin/appointments/${apptId}/pricing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          final_price_cents: pricingForm.final_price ? Math.round(parseFloat(pricingForm.final_price) * 100) : 0,
          discount_cents: pricingForm.discount ? Math.round(parseFloat(pricingForm.discount) * 100) : 0,
          discount_note: pricingForm.discount_note,
        }),
      });
      if (res.ok) {
        toast("Pricing updated!", "success");
        setEditingPricing(null);
        fetchClient();
      } else {
        const data = await res.json();
        toast(data.error ?? "Failed to update pricing", "error");
      }
    } catch {
      toast("Failed to update pricing", "error");
    } finally {
      setPricingSaving(false);
    }
  }

  async function deleteAppointment(apptId: string) {
    setDeletingApptId(apptId);
    try {
      const res = await fetch(`/api/admin/appointments/${apptId}`, { method: "DELETE" });
      if (res.ok) {
        setAppointments(prev => prev.filter(a => a.id !== apptId));
        toast("Appointment deleted", "info");
      } else {
        toast("Failed to delete appointment", "error");
      }
    } catch {
      toast("Failed to delete appointment", "error");
    } finally {
      setDeletingApptId(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const typeParam = clientType === "walkin" ? "?type=walkin" : "";
      const res = await fetch(`/api/admin/clients/${clientId}${typeParam}`, { method: "DELETE" });
      if (res.ok) {
        toast("Client deleted", "success");
        router.push("/admin/clients");
      } else {
        const data = await res.json();
        toast(data.error ?? "Failed to delete", "error");
        setShowDeleteConfirm(false);
      }
    } catch {
      toast("Failed to delete", "error");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
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
        <Link href="/admin/clients" className="text-sm text-[#9b6f6f] mt-2 inline-flex items-center hover:underline min-h-[44px]">
          ← Back to clients
        </Link>
      </div>
    );
  }

  const isWalkin = clientType === "walkin" || client.clientType === "walkin";

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
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl p-5 max-w-2xl mx-auto lg:inset-x-auto lg:w-[600px] lg:left-1/2 lg:-translate-x-1/2" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
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
                  className="flex-1 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-all active:scale-95 min-h-[44px]"
                >
                  {rebookSending ? "Sending…" : "Send Reminder"}
                </button>
                <button
                  onClick={() => setShowRebook(false)}
                  className="px-5 py-2.5 border border-[#e8e2dc] text-sm text-[#8a7e78] font-medium rounded-full hover:bg-[#f5f0eb] transition-all active:scale-95 min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Log Service modal backdrop */}
      {showLogService && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => !logSubmitting && setShowLogService(false)} />
      )}
      {/* Log Service modal */}
      {showLogService && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl p-5 max-w-2xl mx-auto lg:inset-x-auto lg:w-[600px] lg:left-1/2 lg:-translate-x-1/2" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <div className="w-10 h-1 bg-[#e8e2dc] rounded-full mx-auto mb-4" />
          <h3 className="font-display text-lg text-[#1a1714] mb-4">Log Service</h3>
          <form onSubmit={handleLogService}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Service</label>
                <select
                  value={logForm.service_id}
                  onChange={(e) => {
                    const svc = services.find((s) => s.id === e.target.value);
                    setLogForm((f) => ({
                      ...f,
                      service_id: e.target.value,
                      service_name: svc?.name ?? f.service_name,
                      price: svc?.internal_price_cents ? (svc.internal_price_cents / 100).toFixed(2) : f.price,
                    }));
                  }}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                  style={{ fontSize: 16 }}
                >
                  <option value="">Select a service…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Service Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={logForm.service_name}
                  onChange={(e) => setLogForm((f) => ({ ...f, service_name: e.target.value }))}
                  required
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                  style={{ fontSize: 16 }}
                  placeholder="e.g. Balayage + Cut"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={logForm.price}
                  onChange={(e) => setLogForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                  style={{ fontSize: 16 }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Date</label>
                <input
                  type="date"
                  value={logForm.visit_date}
                  onChange={(e) => setLogForm((f) => ({ ...f, visit_date: e.target.value }))}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                  style={{ fontSize: 16 }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Notes</label>
                <textarea
                  value={logForm.notes}
                  onChange={(e) => setLogForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] resize-none"
                  style={{ fontSize: 16 }}
                  placeholder="Formula, process notes…"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="submit"
                disabled={logSubmitting || !logForm.service_name.trim()}
                className="flex-1 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-all active:scale-95 min-h-[44px]"
              >
                {logSubmitting ? "Saving…" : "Log Service"}
              </button>
              <button
                type="button"
                onClick={() => setShowLogService(false)}
                className="px-5 py-2.5 border border-[#e8e2dc] text-sm text-[#8a7e78] font-medium rounded-full hover:bg-[#f5f0eb] transition-all active:scale-95 min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => !deleting && setShowDeleteConfirm(false)} />
      )}
      {showDeleteConfirm && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl p-5 max-w-2xl mx-auto lg:inset-x-auto lg:w-[600px] lg:left-1/2 lg:-translate-x-1/2" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <div className="w-10 h-1 bg-[#e8e2dc] rounded-full mx-auto mb-4" />
          <h3 className="font-display text-lg text-[#1a1714] mb-2">Delete Client</h3>
          <p className="text-sm text-[#8a7e78] mb-5">
            Are you sure you want to delete <span className="font-semibold text-[#1a1714]">{client.full_name ?? "this client"}</span>?
            {isWalkin
              ? " This will permanently remove the client and all their service history."
              : " This will remove all appointments, notes, and service history for this client."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-full hover:bg-red-700 disabled:opacity-50 transition-all active:scale-95 min-h-[44px]"
            >
              {deleting ? "Deleting…" : "Delete Client"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-5 py-2.5 border border-[#e8e2dc] text-sm text-[#8a7e78] font-medium rounded-full hover:bg-[#f5f0eb] transition-all active:scale-95 min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl">
        <div className="mb-5">
          <Link href="/admin/clients" className="text-xs text-[#8a7e78] hover:text-[#9b6f6f] inline-flex items-center gap-1 mb-3 transition-all min-h-[44px]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to clients
          </Link>

          <div className="flex flex-col gap-4">
            {/* Identity row */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center flex-shrink-0 border border-[#e8e2dc]">
                <span className="text-[#9b6f6f] font-semibold text-base">
                  {(() => {
                    const name = client.full_name ?? client.email ?? "?";
                    const parts = name.trim().split(/\s+/);
                    if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
                    return name.charAt(0).toUpperCase();
                  })()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl text-[#1a1714] leading-tight">
                    {client.full_name ?? "(no name)"}
                  </h1>
                  <button
                    onClick={() => {
                      setEditForm({
                        full_name: client.full_name ?? "",
                        phone: client.phone ?? "",
                        email: client.email ?? "",
                        notes: "",
                      });
                      setShowEditClient(true);
                    }}
                    className="p-1.5 rounded-lg text-[#8a7e78] hover:text-[#9b6f6f] hover:bg-[#f5f0eb] transition-all flex-shrink-0"
                    title="Edit client"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
                {isWalkin && (
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#c9a96e]/15 text-[#a08540] mt-1">
                    Walk-in client
                  </span>
                )}
                {client.email && (
                  <p className="text-sm text-[#8a7e78] mt-1">{client.email}</p>
                )}
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="text-sm text-[#9b6f6f] hover:underline block mt-0.5">
                    {client.phone}
                  </a>
                )}
              </div>
            </div>
            {/* Action buttons — own row, always fits */}
            <div className="flex gap-2">
              {!isWalkin && client.email && (
                <button
                  onClick={() => setShowRebook(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-all active:scale-95 min-h-[44px]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send reminder
                </button>
              )}
              <button
                onClick={() => setShowLogService(true)}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e2dc] bg-white text-sm font-medium text-[#1a1714] rounded-full hover:bg-[#f5f0eb] transition-all active:scale-95 min-h-[44px]"
              >
                <svg className="w-4 h-4 text-[#c9a96e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Log service
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-2xl border border-[#e8e2dc] px-4 py-3 text-center">
              <p className="text-2xl font-display text-[#9b6f6f]">{stats.totalAppointments + serviceLog.length}</p>
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

        {/* Private notes (auth clients only) */}
        {!isWalkin && (
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
                  className="text-xs px-4 py-2 bg-[#9b6f6f] text-white rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-all active:scale-95 min-h-[44px]"
                >
                  {notesSaving ? "Saving…" : "Save"}
                </button>
              )}
              {notesSaved && notes === notesOriginal && (
                <span className="text-xs text-emerald-600 font-medium">Saved</span>
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
        )}

        {/* Walk-in notes (shown as read-only info) */}
        {isWalkin && notes && (
          <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5 mb-5">
            <p className="text-sm font-semibold text-[#1a1714] mb-2">Notes</p>
            <p className="text-sm text-[#8a7e78] whitespace-pre-wrap">{notes}</p>
          </div>
        )}

        {/* Service Log */}
        {serviceLog.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-[#1a1714] mb-3">Service Log</p>
            <div className="bg-white rounded-2xl border border-[#e8e2dc] divide-y divide-[#f5f0eb] overflow-hidden">
              {serviceLog.map((entry) => (
                <div key={entry.id} className="px-5 py-4">
                  {editingLogId === entry.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={logEditForm.service_name}
                        onChange={(e) => setLogEditForm((f) => ({ ...f, service_name: e.target.value }))}
                        className="w-full border border-[#e8e2dc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]"
                        style={{ fontSize: 16 }}
                        placeholder="Service name"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={logEditForm.visit_date}
                          onChange={(e) => setLogEditForm((f) => ({ ...f, visit_date: e.target.value }))}
                          className="border border-[#e8e2dc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]"
                          style={{ fontSize: 16 }}
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8a7e78]">$</span>
                          <input
                            type="number"
                            value={(logEditForm.price_cents / 100).toFixed(2)}
                            onChange={(e) => setLogEditForm((f) => ({ ...f, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) }))}
                            className="w-full border border-[#e8e2dc] rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]"
                            style={{ fontSize: 16 }}
                            step="0.01"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={logEditForm.notes}
                        onChange={(e) => setLogEditForm((f) => ({ ...f, notes: e.target.value }))}
                        className="w-full border border-[#e8e2dc] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]"
                        style={{ fontSize: 16 }}
                        placeholder="Notes (optional)"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingLogId(null)}
                          className="flex-1 py-2 border border-[#e8e2dc] rounded-lg text-xs font-semibold text-[#8a7e78] hover:bg-[#f5f0eb]"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={logEditSaving}
                          onClick={async () => {
                            setLogEditSaving(true);
                            try {
                              const res = await fetch(`/api/admin/service-log/${entry.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  service_name: logEditForm.service_name,
                                  price_cents: logEditForm.price_cents,
                                  visit_date: logEditForm.visit_date,
                                  notes: logEditForm.notes || null,
                                }),
                              });
                              if (res.ok) {
                                const { entry: updated } = await res.json();
                                setServiceLog((prev) => prev.map((e) => e.id === entry.id ? { ...e, ...updated } : e));
                                setEditingLogId(null);
                              }
                            } finally {
                              setLogEditSaving(false);
                            }
                          }}
                          className="flex-1 py-2 bg-[#9b6f6f] text-white rounded-lg text-xs font-semibold hover:bg-[#8a5f5f] disabled:opacity-50"
                        >
                          {logEditSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1a1714]">{entry.service_name}</p>
                        <p className="text-xs text-[#8a7e78] mt-0.5">
                          {new Date(entry.visit_date + "T12:00:00").toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: new Date(entry.visit_date).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
                          })}
                        </p>
                        {entry.notes && (
                          <p className="text-xs text-[#8a7e78] mt-1 italic">{entry.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {entry.price_cents > 0 && (
                          <span className="text-sm font-semibold text-[#1a1714] mr-1">
                            ${(entry.price_cents / 100).toFixed(2)}
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setLogEditForm({
                              service_name: entry.service_name,
                              price_cents: entry.price_cents,
                              visit_date: entry.visit_date,
                              notes: entry.notes ?? "",
                            });
                            setEditingLogId(entry.id);
                          }}
                          className="p-1.5 rounded-lg text-[#8a7e78] hover:text-[#9b6f6f] hover:bg-[#f5f0eb] transition-all"
                          title="Edit entry"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm("Delete this service log entry?")) return;
                            const res = await fetch(`/api/admin/service-log/${entry.id}`, { method: "DELETE" });
                            if (res.ok) {
                              setServiceLog((prev) => prev.filter((e) => e.id !== entry.id));
                            }
                          }}
                          className="p-1.5 rounded-lg text-[#8a7e78] hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Delete entry"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Appointment history (auth clients) */}
        {!isWalkin && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-[#1a1714] mb-3">Appointment History</p>
            {appointments.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-[#e8e2dc]">
                <p className="text-sm text-[#8a7e78]">No appointments on record.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#e8e2dc] divide-y divide-[#f5f0eb] overflow-hidden">
                {appointments.map((a) => (
                  <div key={a.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
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
                            timeZone: STUDIO.timezone,
                          })}{" "}
                          ·{" "}
                          {new Date(a.start_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: STUDIO.timezone,
                          })}
                        </p>
                        {/* Pricing info */}
                        {(a.final_price_cents || a.discount_cents) && editingPricing !== a.id && (
                          <div className="flex items-center gap-2 mt-1">
                            {a.final_price_cents ? (
                              <span className="text-xs font-medium text-[#1a1714]">
                                ${(a.final_price_cents / 100).toFixed(2)}
                              </span>
                            ) : null}
                            {a.discount_cents ? (
                              <span className="text-xs text-[#c9a96e]">
                                -${(a.discount_cents / 100).toFixed(2)}
                                {a.discount_note && ` (${a.discount_note})`}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColors[a.status] ?? "bg-[#f5f0eb] text-[#8a7e78]"}`}>
                        {a.status.replace("_", " ")}
                      </span>
                    </div>
                    {editingPricing !== a.id && (
                      <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-[#f5f0eb]">
                        {(a.status === "confirmed" || a.status === "cancelled") && (
                          <button
                            onClick={() => startPricingEdit(a)}
                            className="text-xs font-medium text-[#9b6f6f] hover:text-[#8a5f5f] transition-colors min-h-[44px] flex items-center"
                          >
                            Edit pricing
                          </button>
                        )}
                        <button
                          onClick={() => deleteAppointment(a.id)}
                          disabled={deletingApptId === a.id}
                          className="text-xs font-medium text-[#b09090] hover:text-red-500 transition-colors min-h-[44px] flex items-center disabled:opacity-40 ml-auto"
                        >
                          {deletingApptId === a.id ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    )}

                    {/* Inline pricing edit */}
                    {editingPricing === a.id && (
                      <div className="mt-3 pt-3 border-t border-[#f5f0eb]">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="block text-[10px] font-medium text-[#5c4a42] mb-1">Final Price ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={pricingForm.final_price}
                              onChange={(e) => setPricingForm((f) => ({ ...f, final_price: e.target.value }))}
                              className="w-full border border-[#e8e2dc] rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                              style={{ fontSize: 16 }}
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-[#5c4a42] mb-1">Discount ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={pricingForm.discount}
                              onChange={(e) => setPricingForm((f) => ({ ...f, discount: e.target.value }))}
                              className="w-full border border-[#e8e2dc] rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                              style={{ fontSize: 16 }}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="mb-2">
                          <label className="block text-[10px] font-medium text-[#5c4a42] mb-1">Discount Note</label>
                          <input
                            type="text"
                            value={pricingForm.discount_note}
                            onChange={(e) => setPricingForm((f) => ({ ...f, discount_note: e.target.value }))}
                            className="w-full border border-[#e8e2dc] rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                            style={{ fontSize: 16 }}
                            placeholder="e.g. loyalty, 20% off"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => savePricing(a.id)}
                            disabled={pricingSaving}
                            className="text-xs px-4 py-2 bg-[#9b6f6f] text-white rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-all active:scale-95 min-h-[44px]"
                          >
                            {pricingSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingPricing(null)}
                            className="text-xs px-3 py-2 text-[#8a7e78] hover:text-[#1a1714] transition-colors min-h-[44px]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Family members (dependents) — auth clients only */}
        {!isWalkin && (
          <FamilyMembersSection profileId={clientId} />
        )}

        {/* Delete client */}
        <div className="pt-6 mt-8 mb-8 text-center">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-[#b09090] hover:text-red-500 transition-colors"
          >
            Delete client
          </button>
        </div>
      </div>

      {/* Edit Client Modal */}
      {showEditClient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowEditClient(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 pb-24 lg:pb-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-[#1a1714]">Edit Client</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]"
                  style={{ fontSize: 16 }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]"
                  style={{ fontSize: 16 }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#8a7e78] uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="mt-1 w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]"
                  style={{ fontSize: 16 }}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEditClient(false)}
                className="flex-1 py-3 border border-[#e8e2dc] rounded-xl text-sm font-semibold text-[#8a7e78] hover:bg-[#f5f0eb] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setEditSaving(true);
                  try {
                    if (isWalkin) {
                      const res = await fetch("/api/admin/walk-in-clients", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id: client.id,
                          full_name: editForm.full_name,
                          phone: editForm.phone || null,
                          email: editForm.email || null,
                        }),
                      });
                      if (res.ok) {
                        setClient((c) => c ? { ...c, full_name: editForm.full_name, phone: editForm.phone || null, email: editForm.email || null } : c);
                        setShowEditClient(false);
                      }
                    } else {
                      // Auth clients: update profile name via admin API
                      // Phone isn't on profiles table for auth clients, but name is
                      const res = await fetch(`/api/admin/clients/${client.id}/profile`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ full_name: editForm.full_name }),
                      });
                      if (res.ok) {
                        setClient((c) => c ? { ...c, full_name: editForm.full_name } : c);
                        setShowEditClient(false);
                      }
                    }
                  } catch {
                    // error
                  } finally {
                    setEditSaving(false);
                  }
                }}
                disabled={editSaving}
                className="flex-1 py-3 bg-[#9b6f6f] text-white rounded-xl text-sm font-semibold hover:bg-[#8a5f5f] disabled:opacity-50 transition-colors"
              >
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Family Members (dependents) section for auth client detail page
// ─────────────────────────────────────────────────────────────────────────────

interface Dependent {
  id: string;
  full_name: string;
  phone?: string | null;
  notes?: string | null;
}

function FamilyMembersSection({ profileId }: { profileId: string }) {
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/walk-in-clients?linked_to=${profileId}`)
      .then((r) => r.json())
      .then(({ clients }) => setDependents(clients ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId]);

  async function handleAddDependent(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim()) return;
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/admin/walk-in-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: addName.trim(), linked_to_profile_id: profileId }),
      });
      if (res.ok) {
        const { client } = await res.json();
        setDependents((prev) => [...prev, client]);
        setAddName("");
        setShowAdd(false);
      }
    } finally {
      setAddSubmitting(false);
    }
  }

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#1a1714]">Family Members</p>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-xs font-semibold text-[#9b6f6f] hover:text-[#8a5f5f] flex items-center gap-1 min-h-[44px]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddDependent} className="bg-[#faf9f7] rounded-xl border border-[#e8e2dc] p-4 mb-3 space-y-3">
          <input
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Family member's name…"
            required
            autoFocus
            className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-white"
            style={{ fontSize: 16 }}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addSubmitting || !addName.trim()}
              className="flex-1 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-all active:scale-95 min-h-[44px]"
            >
              {addSubmitting ? "Adding…" : "Add family member"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setAddName(""); }}
              className="px-5 py-2.5 border border-[#e8e2dc] text-sm text-[#8a7e78] font-medium rounded-full hover:bg-white transition-all min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dependents.length === 0 && !showAdd ? (
        <p className="text-xs text-[#a09890] py-1">No family members added yet.</p>
      ) : dependents.length > 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] divide-y divide-[#f5f0eb] overflow-hidden">
          {dependents.map((d) => (
            <Link
              key={d.id}
              href={`/admin/clients/${d.id}?type=walkin`}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#faf9f7] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center flex-shrink-0 border border-[#e8e2dc]">
                <span className="text-[#9b6f6f] font-semibold text-xs">
                  {(() => { const p = d.full_name.trim().split(/\s+/); return p.length >= 2 ? (p[0]![0]! + p[p.length-1]![0]!).toUpperCase() : p[0]![0]!.toUpperCase(); })()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1a1714] truncate">{d.full_name}</p>
                {d.phone && <p className="text-xs text-[#8a7e78]">{d.phone}</p>}
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#e8f0e8] text-[#5a8a5a] flex-shrink-0">
                Dependent
              </span>
              <svg className="w-4 h-4 text-[#c9a96e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
