"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ClientRow {
  id: string;
  full_name: string | null;
  email: string | null;
  totalAppointments: number;
  lastAppointment: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const qs = debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : "";
    fetch(`/api/admin/clients${qs}`)
      .then((r) => r.json())
      .then(({ clients: c }) => setClients(c ?? []))
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[#1a1714]">Clients</h1>
        <p className="text-[#8a7e78] text-sm mt-1">Everyone who has booked with you.</p>
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
        <div className="bg-white rounded-2xl border border-[#e8e2dc] divide-y divide-[#f5f0eb] overflow-hidden">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/admin/clients/${c.id}`}
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
                <p className="text-sm font-semibold text-[#1a1714] truncate">
                  {c.full_name ?? "(no name)"}
                </p>
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
                  {new Date(c.lastAppointment).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: new Date(c.lastAppointment).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
                  })}
                </p>
              </div>

              <svg className="w-4 h-4 text-[#c9a96e] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
