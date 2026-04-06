import { createServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "@/lib/supabase/admin-auth";
import { NextResponse } from "next/server";
import type { AppointmentStatus } from "@/lib/supabase/types";
import { sendStatusUpdateEmail } from "@/lib/email";
import { log } from "@/lib/logger";

const VALID_STATUSES: AppointmentStatus[] = ["pending", "confirmed", "cancelled", "no_show"];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stylistId } = ctx;

  const body = await request.json();

  // Build update fields — support status changes AND appointment edits
  const updateFields: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updateFields.status = body.status;
  }
  if (body.start_at !== undefined) updateFields.start_at = body.start_at;
  if (body.end_at !== undefined) updateFields.end_at = body.end_at;
  if (body.service_id !== undefined) updateFields.service_id = body.service_id;
  if (body.client_notes !== undefined) updateFields.client_notes = body.client_notes || null;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("appointments")
    .update(updateFields)
    .eq("id", params.id)
    .eq("stylist_id", stylistId)
    .select(`
      *,
      client:profiles!client_id(id, full_name),
      service:services!service_id(id, name, duration_minutes),
      stylist:stylists!stylist_id(name)
    `)
    .single();

  if (error) {
    log.error("api/admin/appointments/[id] PATCH", { error: error.message, appointmentId: params.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire status email non-blocking (only on status changes)
  if (data && body.status && (body.status === "confirmed" || body.status === "cancelled")) {
    const clientProfile = data.client as { id: string; full_name: string | null } | null;
    const service = data.service as { id: string; name: string; duration_minutes: number } | null;
    const stylistData = data.stylist as { name: string } | null;
    const { data: authUser } = await serviceClient.auth.admin.getUserById(data.client_id as string);
    const clientEmail = authUser?.user?.email ?? null;
    if (clientEmail && service) {
      sendStatusUpdateEmail({
        clientEmail,
        clientName: clientProfile?.full_name ?? null,
        stylistName: stylistData?.name ?? "Your Stylist",
        serviceName: service.name,
        startAt: data.start_at as string,
        endAt: data.end_at as string,
        status: body.status,
        bookingUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://tcgbooking.vercel.app"}/book`,
      }).catch(() => {});
    }
  }

  // If cancelled, check waitlist for matching entries
  let waitlistCount = 0;
  if (data && body.status === "cancelled") {
    const appointmentDate = (data.start_at as string).split("T")[0]; // YYYY-MM-DD
    const { count } = await serviceClient
      .from("waitlist_entries")
      .select("id", { count: "exact", head: true })
      .eq("stylist_id", stylistId)
      .eq("status", "waiting")
      .or(`preferred_date.eq.${appointmentDate},preferred_date.is.null`);
    waitlistCount = count ?? 0;
  }

  return NextResponse.json({ appointment: data, waitlist_count: waitlistCount });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stylistId } = ctx;

  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from("appointments")
    .delete()
    .eq("id", params.id)
    .eq("stylist_id", stylistId);

  if (error) {
    log.error("api/admin/appointments/[id] DELETE", { error: error.message, appointmentId: params.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
