import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendBookingConfirmation } from "@/lib/email";
import { STUDIO } from "@/config/studio";
import { z } from "zod";


// ─── Zod validation ──────────────────────────────────────────────────────────

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PostAppointmentSchema = z.object({
  stylist_id: z.string().regex(uuidRegex, "stylist_id must be a valid UUID"),
  service_id: z.string().regex(uuidRegex, "service_id must be a valid UUID").optional(),
  service_ids: z.array(z.string().regex(uuidRegex, "each service_id must be a valid UUID")).min(1).optional(),
  start_at: z.string().datetime({ message: "start_at must be a valid ISO date" }),
  end_at: z.string().datetime({ message: "end_at must be a valid ISO date" }),
  client_notes: z.string().max(500, "client_notes max 500 characters").optional(),
}).refine((d) => d.service_id || d.service_ids, {
  message: "service_id or service_ids is required",
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("appointments")
    .select(
      `
      id, start_at, end_at, status, created_at, client_notes,
      stylist:stylists!stylist_id(id, name),
      service:services!service_id(id, name, duration_minutes)
    `
    )
    .eq("client_id", user.id)
    .order("start_at");

  if (error) {
    console.error("[api/appointments GET]", { error: error.message, userId: user.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointments: data ?? [] });
}

export async function POST(request: Request) {
  // IP-based rate limit for bookings
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PostAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", details: parsed.error.issues.map((e) => ({ path: e.path.join("."), message: e.message })) },
      { status: 400 }
    );
  }

  const { stylist_id, service_id, service_ids, start_at, end_at, client_notes } = parsed.data;

  // Resolve the list of service IDs (support both single and multi)
  const resolvedServiceIds = service_ids ?? [service_id!];
  const primaryServiceId = resolvedServiceIds[0]!;

  // Verify all services belong to stylist and are active
  const { data: services } = await supabase
    .from("services")
    .select("id, name, is_active")
    .in("id", resolvedServiceIds)
    .eq("stylist_id", stylist_id);

  if (!services || services.length !== resolvedServiceIds.length) {
    return NextResponse.json({ error: "One or more services not found" }, { status: 400 });
  }
  if (services.some((s) => !s.is_active)) {
    return NextResponse.json({ error: "One or more services are inactive" }, { status: 400 });
  }

  // Atomically check conflicts + insert using DB function (prevents race conditions)
  const { data: rpcResult, error: rpcError } = await supabase.rpc("book_appointment", {
    p_client_id: user.id,
    p_walk_in_client_id: null,
    p_stylist_id: stylist_id,
    p_service_id: primaryServiceId,
    p_start_at: start_at,
    p_end_at: end_at,
    p_status: "pending",
    p_client_notes: client_notes?.trim() || null,
  });

  if (rpcError) {
    if (rpcError.message?.includes("CONFLICT")) {
      return NextResponse.json({ error: "This time slot is no longer available." }, { status: 409 });
    }
    console.error("[api/appointments POST]", { error: rpcError.message, userId: user.id, stylist_id, service_ids: resolvedServiceIds });
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const appointmentId = rpcResult as string;

  // Fetch the created appointment
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, start_at, end_at, status, client_notes")
    .eq("id", appointmentId)
    .single();

  if (error) {
    console.error("[api/appointments POST] fetch after insert", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert into appointment_services junction table
  if (appointment) {
    const rows = resolvedServiceIds.map((sid) => ({
      appointment_id: appointment.id,
      service_id: sid,
    }));
    const { error: asError } = await supabase.from("appointment_services").insert(rows);
    if (asError) {
      console.error("[api/appointments POST] appointment_services insert failed", { error: asError.message });
    }
  }

  // Send emails non-blocking
  if (appointment) {
    const serviceNames = services.map((s) => s.name).join(", ");

    const [stylistResult, clientResult] = await Promise.allSettled([
      supabase.from("stylists").select("name, cancellation_policy").eq("id", stylist_id).single(),
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    ]);

    const stylistData = stylistResult.status === "fulfilled" ? stylistResult.value.data : null;
    const clientData = clientResult.status === "fulfilled" ? clientResult.value.data : null;

    if (stylistData && user.email) {
      sendBookingConfirmation({
        clientEmail: user.email,
        clientName: clientData?.full_name ?? null,
        stylistName: stylistData.name,
        stylistEmail: process.env.STYLIST_NOTIFICATION_EMAIL ?? STUDIO.contactEmail,
        serviceName: serviceNames,
        startAt: appointment.start_at,
        endAt: appointment.end_at,
        clientNotes: client_notes?.trim() || null,
        cancellationPolicy: (stylistData as { name: string; cancellation_policy?: string }).cancellation_policy ?? null,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ appointment }, { status: 201 });
}
