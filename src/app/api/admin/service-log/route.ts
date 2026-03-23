import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

async function getStylistId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("stylists")
    .select("id")
    .eq("user_id", userId)
    .single();
  return data?.id ?? null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stylistId = await getStylistId(supabase, user.id);
  if (!stylistId) return NextResponse.json({ entries: [] });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const clientType = searchParams.get("clientType"); // "auth" | "walkin"

  if (!clientId || !clientType) {
    return NextResponse.json({ error: "clientId and clientType are required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const col = clientType === "walkin" ? "walk_in_client_id" : "client_id";

  const { data, error } = await serviceClient
    .from("client_service_log")
    .select("*")
    .eq("stylist_id", stylistId)
    .eq(col, clientId)
    .order("visit_date", { ascending: false });

  if (error) {
    console.error("[api/admin/service-log GET]", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stylistId = await getStylistId(supabase, user.id);
  if (!stylistId) return NextResponse.json({ error: "Create your profile first." }, { status: 400 });

  let body: {
    client_id?: string;
    walk_in_client_id?: string;
    service_id?: string;
    service_name?: string;
    price_cents?: number;
    visit_date?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const serviceName = body.service_name?.trim();
  if (!serviceName) return NextResponse.json({ error: "service_name is required" }, { status: 400 });

  if (!body.client_id && !body.walk_in_client_id) {
    return NextResponse.json({ error: "client_id or walk_in_client_id is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("client_service_log")
    .insert({
      stylist_id: stylistId,
      client_id: body.client_id || null,
      walk_in_client_id: body.walk_in_client_id || null,
      service_id: body.service_id || null,
      service_name: serviceName,
      price_cents: body.price_cents ?? 0,
      visit_date: body.visit_date || new Date().toISOString().slice(0, 10),
      notes: body.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/admin/service-log POST]", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data }, { status: 201 });
}
