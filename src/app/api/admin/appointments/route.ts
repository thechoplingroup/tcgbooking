import { createServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "@/lib/supabase/admin-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const APPT_SELECT = `
  *,
  client:profiles!client_id(id, full_name),
  walk_in:walk_in_clients!walk_in_client_id(id, full_name),
  service:services!service_id(id, name, duration_minutes, internal_price_cents),
  appointment_services(service_id, service:services(id, name, duration_minutes, internal_price_cents))
`;

export async function GET(request: Request) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stylistId } = ctx;

  const serviceClient = createServiceClient();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // optional filter

  let query = serviceClient
    .from("appointments")
    .select(APPT_SELECT)
    .eq("stylist_id", stylistId)
    .order("start_at");

  if (status === "all") {
    // No date restriction for "all" — show everything
  } else if (status === "cancelled") {
    query = query.eq("status", "cancelled");
  } else if (status === "no_show") {
    query = query.eq("status", "no_show");
  } else if (status === "requests") {
    // Pending + reschedule requests only
    query = query
      .in("status", ["pending", "reschedule_requested"])
      .gte("start_at", new Date().toISOString());
  } else {
    // "upcoming" (default)
    query = query
      .in("status", ["pending", "confirmed", "reschedule_requested"])
      .gte("start_at", new Date().toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api/admin/appointments GET]", { error: error.message, status });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointments: data });
}

// ─── Admin appointment creation (receptionist mode) ─────────────────────────

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AdminCreateSchema = z.object({
  client_id: z.string().regex(uuidRegex).optional().nullable(),
  walk_in_client_id: z.string().regex(uuidRegex).optional().nullable(),
  client_name: z.string().max(200).optional(),
  service_ids: z.array(z.string().regex(uuidRegex)).min(1, "At least one service is required"),
  start_at: z.string().datetime({ message: "start_at must be a valid ISO date" }),
  end_at: z.string().datetime({ message: "end_at must be a valid ISO date" }),
  status: z.enum(["pending", "confirmed", "cancelled", "no_show"]).default("confirmed"),
  client_notes: z.string().max(500).optional(),
  final_price_cents: z.number().int().min(0).optional(),
  discount_cents: z.number().int().min(0).optional(),
  discount_note: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stylistId } = ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AdminCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues.map((e) => ({ path: e.path.join("."), message: e.message })) },
      { status: 400 }
    );
  }

  const {
    client_id, walk_in_client_id, service_ids, start_at, end_at,
    status, client_notes, final_price_cents, discount_cents, discount_note,
  } = parsed.data;

  const serviceClient = createServiceClient();

  // Verify services belong to stylist and are active
  const { data: services } = await serviceClient
    .from("services")
    .select("id, name, is_active, internal_price_cents")
    .in("id", service_ids)
    .eq("stylist_id", stylistId);

  if (!services || services.length !== service_ids.length) {
    return NextResponse.json({ error: "One or more services not found" }, { status: 400 });
  }
  if (services.some((s) => !s.is_active)) {
    return NextResponse.json({ error: "One or more services are inactive" }, { status: 400 });
  }

  const isPast = new Date(start_at) < new Date();

  // Check against blocked times (skip for past appointments)
  if (!isPast) {
    const { data: blockedConflicts } = await serviceClient
      .from("blocked_times")
      .select("id, reason")
      .eq("stylist_id", stylistId)
      .lt("start_at", end_at)
      .gt("end_at", start_at);

    if (blockedConflicts && blockedConflicts.length > 0) {
      return NextResponse.json(
        { warning: "This time overlaps a blocked period.", blocked: blockedConflicts },
        { status: 200 }
      );
    }
  }

  const primaryServiceId = service_ids[0]!;

  // Use atomic DB function for future appointments (prevents double-booking race conditions)
  // For past appointments, insert directly (no conflict risk)
  if (!isPast) {
    const { data: rpcResult, error: rpcError } = await serviceClient.rpc("book_appointment", {
      p_client_id: client_id || null,
      p_walk_in_client_id: walk_in_client_id || null,
      p_stylist_id: stylistId,
      p_service_id: primaryServiceId,
      p_start_at: start_at,
      p_end_at: end_at,
      p_status: status,
      p_client_notes: client_notes?.trim() || null,
      p_final_price_cents: final_price_cents ?? null,
      p_discount_cents: discount_cents ?? null,
      p_discount_note: discount_note?.trim() || null,
    });

    if (rpcError) {
      if (rpcError.message?.includes("CONFLICT")) {
        return NextResponse.json(
          { error: "This time slot conflicts with an existing appointment." },
          { status: 409 }
        );
      }
      console.error("[api/admin/appointments POST]", { error: rpcError.message });
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const appointmentId = rpcResult as string;
    const { data: appointment, error } = await serviceClient
      .from("appointments")
      .select("id, start_at, end_at, status, client_notes")
      .eq("id", appointmentId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Insert into appointment_services junction table
    if (appointment) {
      const rows = service_ids.map((sid) => ({
        appointment_id: appointment.id,
        service_id: sid,
      }));
      await serviceClient.from("appointment_services").insert(rows);
    }

    return NextResponse.json({ appointment }, { status: 201 });
  }

  // Past appointments — direct insert (no conflict risk)
  const { data: appointment, error } = await serviceClient
    .from("appointments")
    .insert({
      client_id: client_id || null,
      walk_in_client_id: walk_in_client_id || null,
      stylist_id: stylistId,
      service_id: primaryServiceId,
      start_at,
      end_at,
      status,
      client_notes: client_notes?.trim() || null,
      final_price_cents: final_price_cents ?? null,
      discount_cents: discount_cents ?? null,
      discount_note: discount_note?.trim() || null,
    })
    .select(APPT_SELECT)
    .single();

  if (error) {
    console.error("[api/admin/appointments POST]", { error: error.message, stylistId });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert appointment_services
  if (appointment) {
    const rows = service_ids.map((sid) => ({
      appointment_id: appointment.id,
      service_id: sid,
    }));
    const { error: asError } = await serviceClient.from("appointment_services").insert(rows);
    if (asError) {
      console.error("[api/admin/appointments POST] appointment_services", { error: asError.message });
    }
  }

  return NextResponse.json({ appointment }, { status: 201 });
}
