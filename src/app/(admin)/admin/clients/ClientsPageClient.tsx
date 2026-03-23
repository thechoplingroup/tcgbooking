"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import type { ClientRow } from "@/types/clients";

interface ClientsPageClientProps {
  initialClients: ClientRow[];
  initialTotal: number;
  initialHasMore: boolean;
}

const PAGE_LIMIT = 20;

export default function ClientsPageClient({
  initialClients,
  initialTotal,
  initialHasMore,
}: ClientsPageClientProps) {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientRow[]>(initialClients);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Add Client modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ full_name: "", phone: "", email: "", notes: "" });
  const [addSubmitting, setAddSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchClients = useCallback((searchVal: string, pageNum: number, append: boolean) => {
    const qs = new URLSearchParams({ page: String(pageNum), limit: String(PAGE_LIMIT) });
    if (searchVal) qs.set("q", searchVal);
    return fetch(`/api/admin/clients?${qs}`)
      .then((r) => r.json())
      .then(({ clients: c, hasMore: more, total: t }) => {
        if (append) {
          setClients((prev) => [...prev, ...(c ?? [])]);
        } else {
          setClients(c ?? []);
        }
        setHasMore(more ?? false);
        setTotal(t ?? 0);
      });
  }, []);

  // Fetch when search changes (but not on initial mount if no search)
  useEffect(() => {
    // Only fetch if search changed (skip initial empty search since we have initialClients)
    if (debouncedSearch === "" && page === 1 && clients === initialClients) {
      return;
    }
    setLoading(true);
    setPage(1);
    fetchClients(debouncedSearch, 1, false).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, fetchClients]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setLoadingMore(true);
    fetchClients(debouncedSearch, nextPage, true)
      .then(() => setPage(nextPage))
      .finally(() => setLoadingMore(false));
  }, [page, debouncedSearch, fetchClients]);

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.full_name.trim()) return;
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/admin/walk-in-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        toast("Client added!", "success");
        setShowAdd(false);
        setAddForm({ full_name: "", phone: "", email: "", notes: "" });
        // Refresh list
        setLoading(true);
        setPage(1);
        fetchClients(debouncedSearch, 1, false).finally(() => setLoading(false));
      } else {
        const data = await res.json();
        toast(data.error ?? "Failed to add client", "error");
      }
    } catch {
      toast("Failed to add client", "error");
    } finally {
      setAddSubmitting(false);
    }
  }

  return (
    <>
      {/* Add Client modal backdrop */}
      {showAdd && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => !addSubmitting && setShowAdd(false)} />
      )}
      {/* Add Client modal */}
      {showAdd && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl p-5 max-w-2xl mx-auto lg:inset-x-auto lg:w-[600px] lg:left-1/2 lg:-translate-x-1/2" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <div className="w-10 h-1 bg-[#e8e2dc] rounded-full mx-auto mb-4" />
          <h3 className="font-display text-lg text-[#1a1714] mb-4">Add Walk-in Client</h3>
          <form onSubmit={handleAddClient}>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Full Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm((f) => ({ ...f, full_name: e.target.value }))}
                  required
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                  style={{ fontSize: 16 }}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                  style={{ fontSize: 16 }}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Email</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
                  style={{ fontSize: 16 }}
                  placeholder="jane@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Notes</label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7] resize-none"
                  style={{ fontSize: 16 }}
                  placeholder="Any notes about this client…"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="submit"
                disabled={addSubmitting || !addForm.full_name.trim()}
                className="flex-1 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-all active:scale-95 min-h-[44px]"
              >
                {addSubmitting ? "Adding…" : "Add Client"}
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-5 py-2.5 border border-[#e8e2dc] text-sm text-[#8a7e78] font-medium rounded-full hover:bg-[#f5f0eb] transition-all active:scale-95 min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="max-w-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-[#1a1714]">Clients</h1>
            <p className="text-[#8a7e78] text-sm mt-1">
              Everyone who has booked with you.
              {total > 0 && !loading && (
                <span className="ml-1 text-[#c9a96e] font-medium">{total} total</span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-all active:scale-95 flex-shrink-0 min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Add Client</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a09890]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-10 pr-4 py-2.5 border border-[#e8e2dc] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-white"
            style={{ fontSize: 16 }}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-[#e8e2dc]">
            <div className="w-12 h-12 rounded-full bg-[#f5ede8] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="font-display text-lg text-[#1a1714] mb-1">No clients yet</p>
            <p className="text-sm text-[#8a7e78]">
              {search ? "No clients match your search." : "Clients will appear here after their first booking."}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-[#e8e2dc] divide-y divide-[#f5f0eb] overflow-hidden">
              {clients.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/clients/${c.id}${c.clientType === "walkin" ? "?type=walkin" : ""}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[#faf9f7] transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center flex-shrink-0 border border-[#e8e2dc]">
                    <span className="text-[#9b6f6f] font-semibold text-base">
                      {(c.full_name ?? c.email ?? "?").charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#1a1714] truncate">
                        {c.full_name ?? "(no name)"}
                      </p>
                      {c.clientType === "walkin" && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#c9a96e]/15 text-[#a08540] flex-shrink-0">
                          Walk-in
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8a7e78] truncate">{c.email ?? "—"}</p>
                  </div>

                  {/* Stats */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-[#1a1714]">{c.totalAppointments}</p>
                    <p className="text-xs text-[#8a7e78]">
                      {c.totalAppointments === 1 ? "visit" : "visits"}
                    </p>
                  </div>

                  {/* Last date */}
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <p className="text-xs text-[#8a7e78]">Last visit</p>
                    <p className="text-xs font-medium text-[#1a1714]">
                      {c.lastAppointment
                        ? new Date(c.lastAppointment).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: new Date(c.lastAppointment).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
                          })
                        : "—"}
                    </p>
                  </div>

                  <svg className="w-4 h-4 text-[#c9a96e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 border border-[#e8e2dc] bg-white text-sm font-medium text-[#1a1714] rounded-full hover:bg-[#f5f0eb] disabled:opacity-50 transition-all active:scale-95 min-h-[44px]"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
                      Loading…
                    </span>
                  ) : (
                    `Load more (${total - clients.length} remaining)`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
