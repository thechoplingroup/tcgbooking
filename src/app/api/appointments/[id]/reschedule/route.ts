import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendRescheduleRequest } from "@/lib/email";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabase
    .from("appointments")
    .select("id, client_id, status, start_at, stylist_id, service_id")
    .eq("id", params.id)
    .single();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.client_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["pending", "confirmed"].includes(existing.status as string)) {
    return NextResponse.json({ error: "Cannot reschedule this appointment" }, { status: 400 });
  }

  const { preferred_time, note } = await request.json() as {
    preferred_time: string;
    note?: string;
  };

  if (!preferred_time?.trim()) {
    return NextResponse.json({ error: "preferred_time is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Update appointment status — use TEXT field
  // First try with reschedule columns, fall back if they don't exist
  let updateData: Record<string, unknown> = { status: "reschedule_requested" };
  try {
    updateData = {
      status: "reschedule_requested",
      reschedule_preferred_time: preferred_time,
      reschedule_note: note ?? null,
      reschedule_requested_at: new Date().toISOString(),
    };
  } catch { /* use basic update */ }

  const { error: updateError } = await serviceClient
    .from("appointments")
    .update(updateData)
    .eq("id", params.id);

  if (updateError) {
    // Fall back to just status update if columns don't exist
    await serviceClient
      .from("appointments")
      .update({ status: "reschedule_requested" })
      .eq("id", params.id);
  }

  // Get stylist email + service name for notification
  try {
    const [stylistRes, serviceRes, profileRes] = await Promise.all([
      serviceClient.from("stylists").select("user_id, name").eq("id", existing.stylist_id).single(),
      serviceClient.from("services").select("name").eq("id", existing.service_id ?? "").maybeSingle(),
      serviceClient.from("profiles").select("full_name").eq("id", user.id).single(),
    ]);

    let stylistEmail: string | null = null;
    if (stylistRes.data?.user_id) {
      const { data: stylistUser } = await serviceClient.auth.admin.getUserById(stylistRes.data.user_id);
      stylistEmail = stylistUser?.user?.email ?? process.env.STYLIST_NOTIFICATION_EMAIL ?? null;
    }
    if (!stylistEmail) stylistEmail = process.env.STYLIST_NOTIFICATION_EMAIL ?? null;

    let clientEmail: string | null = null;
    try {
      const { data: clientUser } = await serviceClient.auth.admin.getUserById(user.id);
      clientEmail = clientUser?.user?.email ?? user.email ?? null;
    } catch { clientEmail = user.email ?? null; }

    if (stylistEmail && clientEmail) {
      await sendRescheduleRequest({
        stylistEmail,
        clientName: profileRes.data?.full_name ?? null,
        clientEmail,
        serviceName: serviceRes.data?.name ?? "Service",
        appointmentDate: existing.start_at as string,
        preferredTime: preferred_time + (note ? ` — ${note}` : ""),
        adminUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://tcgbooking.vercel.app"}/admin/appointments`,
      });
    }
  } catch { /* emails are best-effort */ }

  return NextResponse.json({ status: "reschedule_requested" });
}
