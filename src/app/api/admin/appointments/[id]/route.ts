import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { AppointmentStatus } from "@/lib/supabase/types";
import { sendStatusUpdateEmail } from "@/lib/email";

const VALID_STATUSES: AppointmentStatus[] = ["pending", "confirmed", "cancelled"];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: stylist } = await supabase
    .from("stylists")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!stylist) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status } = body as { status: AppointmentStatus };

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", params.id)
    .eq("stylist_id", stylist.id)
    .select(`
      *,
      client:profiles!client_id(id, full_name),
      service:services!service_id(id, name, duration_minutes)
    `)
    .single();

  if (error) {
    console.error("[api/admin/appointments/[id] PATCH]", { error: error.message, userId: user.id, appointmentId: params.id, status });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire status email non-blocking
  if (data && (status === "confirmed" || status === "cancelled")) {
    const clientProfile = data.client as { id: string; full_name: string | null } | null;
    const service = data.service as { id: string; name: string; duration_minutes: number } | null;

    // Get client email from auth (service role)
    const supabaseAdmin = await createClient();
    const { data: authUser } = await supabaseAdmin.auth.admin?.getUserById?.(data.client_id as string) ?? { data: null };

    const clientEmail = authUser?.user?.email ?? null;

    if (clientEmail && service) {
      sendStatusUpdateEmail({
        clientEmail,
        clientName: clientProfile?.full_name ?? null,
        stylistName: stylist.name,
        serviceName: service.name,
        startAt: data.start_at as string,
        status,
        bookingUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://tcgbooking.vercel.app"}/book`,
      }).catch(() => {/* ignore */});
    }
  }

  return NextResponse.json({ appointment: data });
}
