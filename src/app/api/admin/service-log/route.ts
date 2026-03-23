import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStylistId } from "@/lib/auth-helpers";
import { z } from "zod";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validation schema for service log entry
const ServiceLogSchema = z.object({
  client_id: z.string().regex(uuidRegex, "Invalid client_id UUID").optional().nullable(),
  walk_in_client_id: z.string().regex(uuidRegex, "Invalid walk_in_client_id UUID").optional().nullable(),
  service_id: z.string().regex(uuidRegex, "Invalid service_id UUID").optional().nullable(),
  service_name: z.string().min(1, "Service name is required").max(200, "Service name too long"),
  price_cents: z.number().int().min(0).max(9999999).optional().default(0),
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  notes: z.string().max(5000, "Notes too long").optional().nullable(),
}).refine((d) => d.client_id || d.walk_in_client_id, {
  message: "client_id or walk_in_client_id is required",
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ServiceLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues.map((e) => ({ path: e.path.join("."), message: e.message })) },
      { status: 400 }
    );
  }

  const { client_id, walk_in_client_id, service_id, service_name, price_cents, visit_date, notes } = parsed.data;

  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("client_service_log")
    .insert({
      stylist_id: stylistId,
      client_id: client_id || null,
      walk_in_client_id: walk_in_client_id || null,
      service_id: service_id || null,
      service_name: service_name.trim(),
      price_cents: price_cents ?? 0,
      visit_date: visit_date || new Date().toISOString().slice(0, 10),
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/admin/service-log POST]", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data }, { status: 201 });
}
