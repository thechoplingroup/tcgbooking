"use client";

import { useEffect, useState } from "react";
import type { Service } from "@/lib/supabase/types";

function centsToDisplay(cents: number) {
  return (cents / 100).toFixed(0);
}

function dollarsToCents(dollars: string) {
  return Math.round(parseFloat(dollars) * 100);
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Hair Services": ["haircut", "blowout", "trim", "bang", "style"],
  "Color Services": ["color", "highlights", "balayage", "ombre", "gloss", "toner"],
  "Treatments": ["treatment", "keratin", "olaplex", "scalp"],
  "Styling & Events": ["updo", "bridal", "waves", "occasion"],
};

function getCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return "Other";
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("0");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPrice, setEditPrice] = useState("");

  useEffect(() => { loadServices(); }, []);

  async function loadServices() {
    setLoading(true);
    const res = await fetch("/api/admin/services");
    const data = await res.json();
    setServices(data.services ?? []);
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          duration_minutes: parseInt(duration),
          internal_price_cents: dollarsToCents(price),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to add" });
      } else {
        setServices((prev) => [...prev, data.service]);
        setName(""); setDuration("60"); setPrice("0");
        setShowAddForm(false);
        setMessage({ type: "success", text: `"${data.service.name}" added.` });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(service: Service) {
    setEditId(service.id);
    setEditName(service.name);
    setEditDuration(String(service.duration_minutes));
    setEditPrice(centsToDisplay(service.internal_price_cents));
  }

  async function handleEdit(id: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          duration_minutes: parseInt(editDuration),
          internal_price_cents: dollarsToCents(editPrice),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to update" });
      } else {
        setServices((prev) => prev.map((s) => (s.id === id ? data.service : s)));
        setEditId(null);
        setMessage({ type: "success", text: "Service updated." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(service: Service) {
    const res = await fetch(`/api/admin/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !service.is_active }),
    });
    const data = await res.json();
    if (res.ok) {
      setServices((prev) => prev.map((s) => (s.id === service.id ? data.service : s)));
    }
  }

  async function handleDelete(id: string, serviceName: string) {
    if (!confirm(`Delete "${serviceName}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/services/${id}`, { method: "DELETE" });
    if (res.ok) setServices((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Group services by category
  const byCategory: Record<string, Service[]> = {};
  for (const svc of services) {
    const cat = getCategory(svc.name);
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat]!.push(svc);
  }
  const categoryOrder = ["Hair Services", "Color Services", "Treatments", "Styling & Events", "Other"];

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-[#1a1714]">Services</h1>
          <p className="text-[#8a7e78] text-sm mt-1">
            {services.length} services · Pricing is internal only
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Service
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-sm ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-white border border-[#e8e2dc] rounded-2xl p-5 mb-6">
          <h2 className="font-display text-lg text-[#1a1714] mb-4">New Service</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Service Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Balayage"
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Duration (min)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required min={1}
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5c4a42] mb-1.5">Price ($)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required min={0} step="1"
                className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-[#faf9f7]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] disabled:opacity-50 transition-colors"
            >
              {submitting ? "Adding…" : "Add Service"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-5 py-2 border border-[#e8e2dc] text-sm text-[#8a7e78] font-medium rounded-full hover:bg-[#f5ede8] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Services by category */}
      <div className="space-y-6">
        {categoryOrder.map((category) => {
          const catServices = byCategory[category];
          if (!catServices || catServices.length === 0) return null;
          return (
            <div key={category}>
              <h2 className="text-xs font-semibold text-[#c9a96e] uppercase tracking-widest mb-3 flex items-center gap-2">
                {category}
                <span className="text-[#8a7e78] font-normal normal-case tracking-normal">
                  ({catServices.length})
                </span>
              </h2>
              <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden divide-y divide-[#f5f0eb]">
                {catServices.map((s) =>
                  editId === s.id ? (
                    <div key={s.id} className="px-4 py-4 bg-[#fdf8f6]">
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="col-span-3 sm:col-span-1">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Service name"
                            className="w-full border border-[#e8e2dc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-white"
                          />
                        </div>
                        <input
                          type="number"
                          value={editDuration}
                          onChange={(e) => setEditDuration(e.target.value)}
                          placeholder="Min"
                          min={1}
                          className="border border-[#e8e2dc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-white"
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8a7e78]">$</span>
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            placeholder="Price"
                            step="1" min={0}
                            className="w-full border border-[#e8e2dc] rounded-xl pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(s.id)}
                          disabled={submitting}
                          className="px-4 py-1.5 bg-[#9b6f6f] text-white text-xs font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="px-4 py-1.5 border border-[#e8e2dc] text-xs text-[#8a7e78] rounded-full hover:bg-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={s.id}
                      className={`px-4 py-3.5 flex items-center gap-3 ${!s.is_active ? "opacity-50" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm text-[#1a1714]">{s.name}</span>
                        {!s.is_active && (
                          <span className="ml-2 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                            Inactive
                          </span>
                        )}
                        <p className="text-xs text-[#8a7e78] mt-0.5">
                          {formatDuration(s.duration_minutes)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[#4a7c59] flex-shrink-0">
                        ${centsToDisplay(s.internal_price_cents)}
                      </span>
                      <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                        <button
                          onClick={() => startEdit(s)}
                          className="text-xs text-[#9b6f6f] hover:text-[#8a5f5f] font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(s)}
                          className="text-xs text-[#8a7e78] hover:text-[#5c4a42]"
                        >
                          {s.is_active ? "Hide" : "Show"}
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="text-xs text-[#8a7e78] hover:text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
