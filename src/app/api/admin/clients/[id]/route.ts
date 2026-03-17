import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: stylist } = await supabase
    .from("stylists").select("id").eq("user_id", user.id).single();
  if (!stylist) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clientId = params.id;

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Profile
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, full_name, created_at")
    .eq("id", clientId)
    .single();

  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Email from auth
  let email: string | null = null;
  try {
    const { data: userData } = await serviceClient.auth.admin.getUserById(clientId);
    email = userData?.user?.email ?? null;
  } catch { /* optional */ }

  // Appointment history
  const { data: appointments } = await serviceClient
    .from("appointments")
    .select(`
      id, start_at, end_at, status, client_notes, created_at,
      reschedule_note, reschedule_preferred_time,
      service:services!service_id(id, name, duration_minutes)
    `)
    .eq("stylist_id", stylist.id)
    .eq("client_id", clientId)
    .order("start_at", { ascending: false });

  // Private notes
  const { data: notesRow } = await serviceClient
    .from("stylist_client_notes")
    .select("notes, updated_at")
    .eq("stylist_id", stylist.id)
    .eq("client_id", clientId)
    .maybeSingle();

  // Stats
  const appts = appointments ?? [];
  const confirmed = appts.filter((a) => a.status === "confirmed" || a.status === "reschedule_requested");
  const firstBooking = appts.length > 0 ? appts[appts.length - 1]?.created_at : null;

  return NextResponse.json({
    client: {
      id: profile.id,
      full_name: profile.full_name,
      email,
      created_at: profile.created_at,
    },
    stats: {
      totalAppointments: appts.length,
      totalConfirmed: confirmed.length,
      firstBooking,
    },
    appointments: appts,
    notes: notesRow?.notes ?? null,
    notesUpdatedAt: notesRow?.updated_at ?? null,
  });
}
