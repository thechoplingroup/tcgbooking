"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export default function PendingBanner() {
  const [count, setCount] = useState(0);
  const { stylistId } = useAdminAuth();

  // Once we have stylistId: fetch count + subscribe to realtime changes
  useEffect(() => {
    if (!stylistId) return;
    const supabase = createClient();

    async function fetchCount() {
      const { count: c } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("stylist_id", stylistId)
        .eq("status", "pending")
        .gte("start_at", new Date().toISOString());
      setCount(c ?? 0);
    }

    fetchCount();

    // Subscribe to appointment inserts/updates — refetch count on change
    const channel = supabase
      .channel("pending-banner")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `stylist_id=eq.${stylistId}`,
        },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [stylistId]);

  if (count === 0) return null;

  return (
    <Link
      href="/admin/requests"
      className="sticky top-[calc(53px+env(safe-area-inset-top,0px))] lg:top-0 z-30 flex items-center justify-center gap-2 bg-amber-100 border-b border-amber-200 px-4 py-2.5 text-amber-800 text-sm font-semibold hover:bg-amber-200 transition-colors"
    >
      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      You have {count} pending request{count === 1 ? "" : "s"} — tap to review
    </Link>
  );
}
