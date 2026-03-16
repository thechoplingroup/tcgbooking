import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data: stylists, error } = await supabase
    .from("stylists")
    .select("id, name, bio, avatar_url")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch active services for each stylist — omit internal_price_cents
  const stylistIds = (stylists ?? []).map((s) => s.id);

  const { data: services, error: svcError } = await supabase
    .from("services")
    .select("id, stylist_id, name, duration_minutes, is_active")
    .in("stylist_id", stylistIds.length > 0 ? stylistIds : ["none"])
    .eq("is_active", true)
    .order("name");

  if (svcError) {
    return NextResponse.json({ error: svcError.message }, { status: 500 });
  }

  const servicesByStyleist = (services ?? []).reduce<Record<string, typeof services>>((acc, svc) => {
    if (!acc[svc.stylist_id]) acc[svc.stylist_id] = [];
    acc[svc.stylist_id]!.push(svc);
    return acc;
  }, {});

  const result = (stylists ?? []).map((s) => ({
    ...s,
    services: servicesByStyleist[s.id] ?? [],
  }));

  return NextResponse.json({ stylists: result });
}
