"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AppointmentWithDetails {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  stylist: { id: string; name: string } | null;
  service: { id: string; name: string; duration_minutes: number } | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    loadAppointments();
  }, []);

  async function loadAppointments() {
    setLoading(true);
    try {
      const res = await fetch("/api/appointments");
      const data = await res.json();
      if (data.error) setError(data.error);
      else setAppointments(data.appointments ?? []);
    } catch {
      setError("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    setCancelling(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "PATCH" });
      if (res.ok) {
        setAppointments((prev) => prev.filter((a) => a.id !== id));
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to cancel");
      }
    } catch {
      alert("Network error");
    } finally {
      setCancelling(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading appointments…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Appointments</h1>
          <p className="text-sm text-gray-500">Your upcoming bookings</p>
        </div>
        <Link
          href="/book"
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Book new
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No upcoming appointments</p>
          <p className="text-sm mt-1">
            <Link href="/book" className="text-blue-500 hover:underline">
              Browse stylists
            </Link>{" "}
            to book one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div
              key={a.id}
              className="border rounded-xl p-4 bg-white flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{a.service?.name ?? "Service"}</p>
                <p className="text-sm text-gray-500">
                  with{" "}
                  <span className="font-medium text-gray-700">
                    {a.stylist?.name ?? "Stylist"}
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-1">{formatDateTime(a.start_at)}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    a.status === "confirmed"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {a.status}
                </span>
                <button
                  onClick={() => handleCancel(a.id)}
                  disabled={cancelling === a.id}
                  className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  {cancelling === a.id ? "Cancelling…" : "Cancel"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
