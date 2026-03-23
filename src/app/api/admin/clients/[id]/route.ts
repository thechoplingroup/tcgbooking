import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

function getServiceClient() {
  return createServiceClient();
}

async function getAuth() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;
  const { data: stylist } = await supabase
    .from("stylists").select("id").eq("user_id", user.id).single();
  return stylist ? { userId: user.id, stylistId: stylist.id } : null;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = params.id;
  const serviceClient = getServiceClient();

  const { searchParams } = new URL(request.url);
  const clientType = searchParams.get("type"); // "walkin" or null (auth)

  if (clientType === "walkin") {
    // Walk-in client
    const { data: walkin } = await serviceClient
      .from("walk_in_clients")
      .select("*")
      .eq("id", clientId)
      .eq("stylist_id", auth.stylistId)
      .single();

    if (!walkin) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    // Service log entries as "appointments" equivalent
    const { data: logEntries } = await serviceClient
      .from("client_service_log")
      .select("*")
      .eq("stylist_id", auth.stylistId)
      .eq("walk_in_client_id", clientId)
      .order("visit_date", { ascending: false });

    const entries = logEntries ?? [];

    return NextResponse.json({
      client: {
        id: walkin.id,
        full_name: walkin.full_name,
        email: walkin.email ?? null,
        phone: walkin.phone ?? null,
        created_at: walkin.created_at,
        clientType: "walkin",
      },
      stats: {
        totalAppointments: entries.length,
        totalConfirmed: entries.length,
        firstBooking: entries.length > 0 ? entries[entries.length - 1]?.visit_date : null,
      },
      appointments: [],
      serviceLog: entries,
      notes: walkin.notes ?? null,
      notesUpdatedAt: walkin.updated_at ?? null,
    });
  }

  // Auth client (original behavior)
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, full_name, created_at")
    .eq("id", clientId)
    .single();

  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Run all independent queries in parallel
  const [emailResult, appointmentsResult, logEntriesResult, notesResult] = await Promise.all([
    // Email only from auth (strip full user object)
    serviceClient.auth.admin.getUserById(clientId).then(
      ({ data }) => data?.user?.email ?? null,
      () => null
    ).catch(() => null),
    // Appointment history
    serviceClient
      .from("appointments")
      .select(`
        id, start_at, end_at, status, client_notes, created_at,
        reschedule_note, reschedule_preferred_time,
        final_price_cents, discount_cents, discount_note,
        service:services!service_id(id, name, duration_minutes)
      `)
      .eq("stylist_id", auth.stylistId)
      .eq("client_id", clientId)
      .order("start_at", { ascending: false }),
    // Service log entries
    serviceClient
      .from("client_service_log")
      .select("*")
      .eq("stylist_id", auth.stylistId)
      .eq("client_id", clientId)
      .order("visit_date", { ascending: false }),
    // Private notes
    serviceClient
      .from("stylist_client_notes")
      .select("notes, updated_at")
      .eq("stylist_id", auth.stylistId)
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  // Stats
  const appts = appointmentsResult.data ?? [];
  const confirmed = appts.filter((a) => a.status === "confirmed" || a.status === "reschedule_requested");
  const firstBooking = appts.length > 0 ? appts[appts.length - 1]?.created_at : null;

  return NextResponse.json({
    client: {
      id: profile.id,
      full_name: profile.full_name,
      email: emailResult,
      created_at: profile.created_at,
      clientType: "auth",
    },
    stats: {
      totalAppointments: appts.length,
      totalConfirmed: confirmed.length,
      firstBooking,
    },
    appointments: appts,
    serviceLog: logEntriesResult.data ?? [],
    notes: notesResult.data?.notes ?? null,
    notesUpdatedAt: notesResult.data?.updated_at ?? null,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = params.id;
  const serviceClient = getServiceClient();

  const { searchParams } = new URL(request.url);
  const clientType = searchParams.get("type");

  if (clientType === "walkin") {
    // Delete walk-in client (cascade deletes service log entries)
    const { error } = await serviceClient
      .from("walk_in_clients")
      .delete()
      .eq("id", clientId)
      .eq("stylist_id", auth.stylistId);

    if (error) {
      console.error("[api/admin/clients/[id] DELETE walkin]", { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // For auth clients: delete their service log entries and notes (can't delete the auth user)
  await serviceClient
    .from("client_service_log")
    .delete()
    .eq("stylist_id", auth.stylistId)
    .eq("client_id", clientId);

  await serviceClient
    .from("stylist_client_notes")
    .delete()
    .eq("stylist_id", auth.stylistId)
    .eq("client_id", clientId);

  // Delete appointments for this client with this stylist
  await serviceClient
    .from("appointments")
    .delete()
    .eq("stylist_id", auth.stylistId)
    .eq("client_id", clientId);

  return NextResponse.json({ success: true });
}
