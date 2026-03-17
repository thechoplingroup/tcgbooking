import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: stylist } = await supabase
    .from("stylists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!stylist) {
    return NextResponse.json({ appointments: [] });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // optional filter

  let query = supabase
    .from("appointments")
    .select(
      `
      *,
      client:profiles!client_id(id, full_name),
      service:services!service_id(id, name, duration_minutes, internal_price_cents)
    `
    )
    .eq("stylist_id", stylist.id)
    .order("start_at");

  if (status === "all") {
    query = query.gte("start_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  } else if (status === "cancelled") {
    query = query.eq("status", "cancelled");
  } else {
    query = query
      .in("status", ["pending", "confirmed"])
      .gte("start_at", new Date().toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api/admin/appointments GET]", { error: error.message, userId: user.id, status });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointments: data });
}
