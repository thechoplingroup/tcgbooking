import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendBookingConfirmation } from "@/lib/email";
import { z } from "zod";

const RATE_LIMIT_MAX = 3; // max bookings per day per client

// ─── Zod validation ──────────────────────────────────────────────────────────

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PostAppointmentSchema = z.object({
  stylist_id: z.string().regex(uuidRegex, "stylist_id must be a valid UUID"),
  service_id: z.string().regex(uuidRegex, "service_id must be a valid UUID"),
  start_at: z.string().datetime({ message: "start_at must be a valid ISO date" }),
  end_at: z.string().datetime({ message: "end_at must be a valid ISO date" }),
  client_notes: z.string().max(500, "client_notes max 500 characters").optional(),
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

  const { stylist_id, service_id, start_at, end_at, client_notes } = parsed.data;

  // Rate limit: max 3 bookings per day per client
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const { count: todayCount } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("client_id", user.id)
    .gte("created_at", todayStart.toISOString())
    .lte("created_at", todayEnd.toISOString());

  if ((todayCount ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "Too many booking requests today. Please try again tomorrow." },
      { status: 429 }
    );
  }

  // Verify service belongs to stylist and is active
  const { data: service } = await supabase
    .from("services")
    .select("id, name, is_active")
    .eq("id", service_id)
    .eq("stylist_id", stylist_id)
    .single();

  if (!service || !service.is_active) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 });
  }

  // Check for conflicts
  const { data: conflicts } = await supabase
    .from("appointments")
    .select("id")
    .eq("stylist_id", stylist_id)
    .in("status", ["pending", "confirmed"])
    .lt("start_at", end_at)
    .gt("end_at", start_at);

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: "This time slot is no longer available." },
      { status: 409 }
    );
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      client_id: user.id,
      stylist_id,
      service_id,
      start_at,
      end_at,
      status: "pending",
      client_notes: client_notes?.trim() || null,
    })
    .select("id, start_at, end_at, status, client_notes")
    .single();

  if (error) {
    console.error("[api/appointments POST]", { error: error.message, userId: user.id, stylist_id, service_id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send emails non-blocking
  if (appointment) {
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
        stylistEmail: process.env.STYLIST_NOTIFICATION_EMAIL ?? "kerichoplin@gmail.com",
        serviceName: (service as { id: string; name: string; is_active: boolean }).name,
        startAt: appointment.start_at,
        endAt: appointment.end_at,
        clientNotes: client_notes?.trim() || null,
        cancellationPolicy: (stylistData as { name: string; cancellation_policy?: string }).cancellation_policy ?? null,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ appointment }, { status: 201 });
}
