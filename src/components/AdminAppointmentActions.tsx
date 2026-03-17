"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  appointmentId: string;
  inline?: boolean;
}

export default function AdminAppointmentActions({ appointmentId, inline }: Props) {
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null);
  const router = useRouter();

  async function updateStatus(status: "confirmed" | "cancelled") {
    setLoading(status === "confirmed" ? "confirm" : "cancel");
    try {
      await fetch(`/api/admin/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  if (inline) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => updateStatus("confirmed")}
          disabled={loading !== null}
          className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded-full hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading === "confirm" ? (
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          Confirm
        </button>
        <button
          onClick={() => updateStatus("cancelled")}
          disabled={loading !== null}
          className="flex items-center gap-1 px-3 py-1 border border-red-200 text-red-600 text-xs font-medium rounded-full hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {loading === "cancel" ? (
            <span className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          Decline
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => updateStatus("confirmed")}
        disabled={loading !== null}
        className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-full hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {loading === "confirm" ? "…" : "Confirm"}
      </button>
      <button
        onClick={() => updateStatus("cancelled")}
        disabled={loading !== null}
        className="px-4 py-1.5 border border-red-200 text-red-600 text-xs font-semibold rounded-full hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {loading === "cancel" ? "…" : "Cancel"}
      </button>
    </div>
  );
}
