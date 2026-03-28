import { createServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "@/lib/supabase/admin-auth";
import { NextResponse } from "next/server";

const WAITLIST_SELECT = `
  *,
  client:profiles!client_id(id, full_name),
  walk_in:walk_in_clients!walk_in_client_id(id, full_name, email, phone),
  service:services!service_id(id, name, duration_minutes)
`;

export async function GET(request: Request) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stylistId } = ctx;

  const serviceClient = createServiceClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = serviceClient
    .from("waitlist_entries")
    .select(WAITLIST_SELECT)
    .eq("stylist_id", stylistId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api/admin/waitlist GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve emails for auth clients (profiles don't store emails)
  const entries = data ?? [];
  const authClientIds = entries
    .filter((e: Record<string, unknown>) => e.client_id && !e.walk_in_client_id)
    .map((e: Record<string, unknown>) => e.client_id as string);

  const emailMap: Record<string, string> = {};
  if (authClientIds.length > 0) {
    const { data: usersData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
    if (usersData?.users) {
      for (const u of usersData.users) {
        if (authClientIds.includes(u.id) && u.email) {
          emailMap[u.id] = u.email;
        }
      }
    }
  }

  const enriched = entries.map((entry: Record<string, unknown>) => ({
    ...entry,
    client_email: entry.client_id ? emailMap[entry.client_id as string] ?? null : null,
  }));

  return NextResponse.json({ entries: enriched });
}

export async function POST(request: Request) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stylistId } = ctx;

  const body = await request.json();
  const { client_id, walk_in_client_id, service_id, preferred_date, preferred_time_range, notes } = body;

  if (!client_id && !walk_in_client_id) {
    return NextResponse.json({ error: "client_id or walk_in_client_id required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("waitlist_entries")
    .insert({
      stylist_id: stylistId,
      client_id: client_id || null,
      walk_in_client_id: walk_in_client_id || null,
      service_id: service_id || null,
      preferred_date: preferred_date || null,
      preferred_time_range: preferred_time_range || null,
      notes: notes || null,
    })
    .select(WAITLIST_SELECT)
    .single();

  if (error) {
    console.error("[api/admin/waitlist POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data }, { status: 201 });
}
