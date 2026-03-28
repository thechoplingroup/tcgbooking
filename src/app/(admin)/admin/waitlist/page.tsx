"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/Toast";

interface WaitlistEntry {
  id: string;
  client_id: string | null;
  walk_in_client_id: string | null;
  stylist_id: string;
  service_id: string | null;
  preferred_date: string | null;
  preferred_time_range: string | null;
  notes: string | null;
  status: "waiting" | "notified" | "booked" | "expired";
  notified_at: string | null;
  created_at: string;
  client: { id: string; full_name: string | null } | null;
  walk_in: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
  service: { id: string; name: string; duration_minutes: number } | null;
  client_email: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  full_name: string | null;
  clientType: "auth" | "walkin";
  email?: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  waiting: { bg: "bg-amber-50", text: "text-amber-700" },
  notified: { bg: "bg-blue-50", text: "text-blue-700" },
  booked: { bg: "bg-emerald-50", text: "text-emerald-700" },
  expired: { bg: "bg-gray-100", text: "text-gray-500" },
};

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"waiting" | "all">("waiting");
  const [showAdd, setShowAdd] = useState(false);
  const [notifyEntry, setNotifyEntry] = useState<WaitlistEntry | null>(null);
  const { toast } = useToast();

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "waiting"
        ? "/api/admin/waitlist?status=waiting"
        : "/api/admin/waitlist";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setEntries(json.entries ?? []);
    } catch {
      toast("Failed to load waitlist", "error");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/admin/waitlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: status as WaitlistEntry["status"] } : e)));
      toast(status === "booked" ? "Marked as booked" : "Status updated", "success");
    } catch {
      toast("Failed to update", "error");
    }
  }

  async function removeEntry(id: string) {
    try {
      const res = await fetch(`/api/admin/waitlist/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast("Removed from waitlist", "success");
    } catch {
      toast("Failed to remove", "error");
    }
  }

  function getClientName(entry: WaitlistEntry): string {
    if (entry.walk_in?.full_name) return entry.walk_in.full_name;
    if (entry.client?.full_name) return entry.client.full_name;
    return "Unknown client";
  }

  function getClientEmail(entry: WaitlistEntry): string | null {
    if (entry.walk_in?.email) return entry.walk_in.email;
    return entry.client_email ?? null;
  }

  // Group by preferred_date
  const grouped = entries.reduce<Record<string, WaitlistEntry[]>>((acc, entry) => {
    const key = entry.preferred_date ?? "no-date";
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    if (a === "no-date") return 1;
    if (b === "no-date") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-[#1a1714]">Waitlist</h1>
          <p className="text-[#8a7e78] text-sm mt-1">
            Clients waiting for an open slot. Notify them when a cancellation happens.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] active:scale-95 transition-all min-h-[44px] flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Add to Waitlist</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-[#f5f0eb] rounded-xl p-1 w-fit">
        {(["waiting", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              filter === f
                ? "bg-white text-[#1a1714] shadow-sm"
                : "text-[#8a7e78] hover:text-[#1a1714]"
            }`}
          >
            {f === "waiting" ? "Waiting" : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#e8e2dc] p-5 animate-pulse">
              <div className="h-4 bg-[#f0ebe6] rounded w-40 mb-2" />
              <div className="h-3 bg-[#f0ebe6] rounded w-28" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-display text-lg text-[#1a1714] mb-1">No waitlist entries</h3>
          <p className="text-[#8a7e78] text-sm">
            When clients want a slot that&apos;s not available, add them here. They&apos;ll be notified when a cancellation opens up a spot.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              <h2 className="text-sm font-semibold text-[#8a7e78] uppercase tracking-wide mb-3">
                {dateKey === "no-date"
                  ? "Any Date"
                  : new Date(dateKey + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
              </h2>
              <div className="space-y-3">
                {grouped[dateKey].map((entry) => {
                  const email = getClientEmail(entry);
                  const style = STATUS_STYLES[entry.status] ?? STATUS_STYLES.waiting;
                  return (
                    <div
                      key={entry.id}
                      className="bg-white rounded-2xl border border-[#e8e2dc] p-5 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-[#1a1714] truncate">
                              {getClientName(entry)}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                              {entry.status}
                            </span>
                          </div>
                          {entry.service && (
                            <p className="text-sm text-[#8a7e78]">{entry.service.name}</p>
                          )}
                          {entry.preferred_time_range && (
                            <p className="text-xs text-[#8a7e78] mt-0.5">
                              Preferred: {entry.preferred_time_range}
                            </p>
                          )}
                          {entry.notes && (
                            <p className="text-xs text-[#8a7e78] mt-1 italic">&ldquo;{entry.notes}&rdquo;</p>
                          )}
                          {email && (
                            <p className="text-xs text-[#8a7e78] mt-1">{email}</p>
                          )}
                          {entry.notified_at && (
                            <p className="text-xs text-blue-600 mt-1">
                              Notified {new Date(entry.notified_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {entry.status === "waiting" && email && (
                            <button
                              onClick={() => setNotifyEntry(entry)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#9b6f6f] rounded-lg hover:bg-[#8a5f5f] transition-colors"
                            >
                              Notify
                            </button>
                          )}
                          {(entry.status === "waiting" || entry.status === "notified") && (
                            <button
                              onClick={() => updateStatus(entry.id, "booked")}
                              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                            >
                              Booked
                            </button>
                          )}
                          <button
                            onClick={() => removeEntry(entry.id)}
                            className="p-1.5 text-[#8a7e78] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notify modal */}
      {notifyEntry && (
        <NotifyModal
          entry={notifyEntry}
          onClose={() => setNotifyEntry(null)}
          onSuccess={() => {
            setNotifyEntry(null);
            loadEntries();
            toast("Notification sent!", "success");
          }}
        />
      )}

      {/* Add to waitlist modal */}
      {showAdd && (
        <AddWaitlistModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false);
            loadEntries();
            toast("Added to waitlist", "success");
          }}
        />
      )}
    </div>
  );
}

// ─── Notify Modal ──────────────────────────────────────────────────────────────

function NotifyModal({
  entry,
  onClose,
  onSuccess,
}: {
  entry: WaitlistEntry;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [availableDate, setAvailableDate] = useState(entry.preferred_date ?? "");
  const [availableTime, setAvailableTime] = useState(entry.preferred_time_range ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const clientName = entry.walk_in?.full_name ?? entry.client?.full_name ?? "Client";

  async function handleSend() {
    if (!availableDate || !availableTime) {
      toast("Date and time are required", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/admin/waitlist/${entry.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          available_date: availableDate,
          available_time: availableTime,
          message: message || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to send");
      }
      onSuccess();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send notification", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-[#e8e2dc] shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#e8e2dc]">
          <h3 className="font-display text-lg text-[#1a1714] font-semibold">Notify {clientName}</h3>
          <p className="text-sm text-[#8a7e78] mt-0.5">
            Let them know about an available slot.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1714] mb-1">Available Date</label>
            <input
              type="date"
              value={availableDate}
              onChange={(e) => setAvailableDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#e8e2dc] bg-[#faf8f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]/30 focus:border-[#9b6f6f]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1714] mb-1">Available Time</label>
            <input
              type="text"
              value={availableTime}
              onChange={(e) => setAvailableTime(e.target.value)}
              placeholder="e.g. 2:00 PM"
              className="w-full px-3 py-2.5 rounded-xl border border-[#e8e2dc] bg-[#faf8f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]/30 focus:border-[#9b6f6f]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1714] mb-1">
              Personal Message <span className="text-[#8a7e78] font-normal">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Add a personal note to the notification..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#e8e2dc] bg-[#faf8f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]/30 focus:border-[#9b6f6f] resize-none"
            />
          </div>
        </div>
        <div className="p-5 border-t border-[#e8e2dc] flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-[#8a7e78] bg-[#f5f0eb] rounded-xl hover:bg-[#ebe4dd] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#9b6f6f] rounded-xl hover:bg-[#8a5f5f] transition-colors disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send Notification"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Waitlist Modal ─────────────────────────────────────────────────────────

function AddWaitlistModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTimeRange, setPreferredTimeRange] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const { toast } = useToast();

  // Load services on mount
  useEffect(() => {
    fetch("/api/admin/services")
      .then((r) => r.json())
      .then((d) => setServices(d.services ?? []))
      .catch(() => {});
  }, []);

  // Search clients
  useEffect(() => {
    if (clientSearch.length < 2) {
      setClients([]);
      return;
    }
    setLoadingClients(true);
    const timer = setTimeout(() => {
      fetch(`/api/admin/clients?q=${encodeURIComponent(clientSearch)}`)
        .then((r) => r.json())
        .then((d) => setClients(d.clients ?? []))
        .catch(() => {})
        .finally(() => setLoadingClients(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  async function handleAdd() {
    if (!selectedClient) {
      toast("Select a client", "error");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        service_id: serviceId || null,
        preferred_date: preferredDate || null,
        preferred_time_range: preferredTimeRange || null,
        notes: notes || null,
      };
      if (selectedClient.clientType === "auth") {
        body.client_id = selectedClient.id;
      } else {
        body.walk_in_client_id = selectedClient.id;
      }

      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      onSuccess();
    } catch {
      toast("Failed to add to waitlist", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-[#e8e2dc] shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#e8e2dc]">
          <h3 className="font-display text-lg text-[#1a1714] font-semibold">Add to Waitlist</h3>
          <p className="text-sm text-[#8a7e78] mt-0.5">
            Add a client who wants a slot that isn&apos;t available yet.
          </p>
        </div>
        <div className="p-5 space-y-4">
          {/* Client search */}
          <div>
            <label className="block text-sm font-medium text-[#1a1714] mb-1">Client</label>
            {selectedClient ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#e8e2dc] bg-[#faf8f5]">
                <span className="text-sm text-[#1a1714] flex-1">{selectedClient.full_name ?? "Client"}</span>
                <button
                  onClick={() => { setSelectedClient(null); setClientSearch(""); }}
                  className="text-[#8a7e78] hover:text-red-500"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full px-3 py-2.5 rounded-xl border border-[#e8e2dc] bg-[#faf8f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]/30 focus:border-[#9b6f6f]"
                />
                {loadingClients && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#e8e2dc] border-t-[#9b6f6f] rounded-full animate-spin" />
                  </div>
                )}
                {clients.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-[#e8e2dc] rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {clients.map((c) => (
                      <button
                        key={`${c.clientType}-${c.id}`}
                        onClick={() => { setSelectedClient(c); setClientSearch(""); setClients([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[#f5f0eb] transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        <span className="text-[#1a1714]">{c.full_name ?? "—"}</span>
                        <span className="text-xs text-[#8a7e78] ml-2">
                          {c.clientType === "walkin" ? "Walk-in" : "Registered"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service */}
          <div>
            <label className="block text-sm font-medium text-[#1a1714] mb-1">Service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#e8e2dc] bg-[#faf8f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]/30 focus:border-[#9b6f6f]"
            >
              <option value="">Any service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Preferred date */}
          <div>
            <label className="block text-sm font-medium text-[#1a1714] mb-1">
              Preferred Date <span className="text-[#8a7e78] font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#e8e2dc] bg-[#faf8f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]/30 focus:border-[#9b6f6f]"
            />
          </div>

          {/* Preferred time range */}
          <div>
            <label className="block text-sm font-medium text-[#1a1714] mb-1">
              Preferred Time <span className="text-[#8a7e78] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={preferredTimeRange}
              onChange={(e) => setPreferredTimeRange(e.target.value)}
              placeholder="e.g. Morning, After 2pm"
              className="w-full px-3 py-2.5 rounded-xl border border-[#e8e2dc] bg-[#faf8f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]/30 focus:border-[#9b6f6f]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[#1a1714] mb-1">
              Notes <span className="text-[#8a7e78] font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about this request..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#e8e2dc] bg-[#faf8f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f]/30 focus:border-[#9b6f6f] resize-none"
            />
          </div>
        </div>
        <div className="p-5 border-t border-[#e8e2dc] flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-[#8a7e78] bg-[#f5f0eb] rounded-xl hover:bg-[#ebe4dd] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={saving || !selectedClient}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#9b6f6f] rounded-xl hover:bg-[#8a5f5f] transition-colors disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add to Waitlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
