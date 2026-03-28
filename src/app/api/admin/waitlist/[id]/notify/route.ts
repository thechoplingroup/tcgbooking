import { createServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "@/lib/supabase/admin-auth";
import { NextResponse } from "next/server";
import { sendWaitlistNotification } from "@/lib/email";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stylistId } = ctx;

  const body = await request.json();
  const { available_date, available_time, message } = body;

  if (!available_date || !available_time) {
    return NextResponse.json(
      { error: "available_date and available_time are required" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  // Fetch the waitlist entry with relations
  const { data: entry, error: fetchError } = await serviceClient
    .from("waitlist_entries")
    .select(`
      *,
      client:profiles!client_id(id, full_name),
      walk_in:walk_in_clients!walk_in_client_id(id, full_name, email),
      service:services!service_id(id, name),
      stylist:stylists!stylist_id(id, name)
    `)
    .eq("id", params.id)
    .eq("stylist_id", stylistId)
    .single();

  if (fetchError || !entry) {
    return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });
  }

  // Determine client email and name
  let clientEmail: string | null = null;
  let clientName: string | null = null;

  const walkIn = entry.walk_in as { id: string; full_name: string; email: string | null } | null;
  const client = entry.client as { id: string; full_name: string | null } | null;
  const service = entry.service as { id: string; name: string } | null;
  const stylist = entry.stylist as { id: string; name: string } | null;

  if (walkIn) {
    clientEmail = walkIn.email;
    clientName = walkIn.full_name;
  } else if (client) {
    clientName = client.full_name;
    // Fetch email from auth
    const { data: authUser } = await serviceClient.auth.admin.getUserById(entry.client_id as string);
    clientEmail = authUser?.user?.email ?? null;
  }

  if (!clientEmail) {
    return NextResponse.json(
      { error: "Client has no email address on file" },
      { status: 400 }
    );
  }

  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://tcgbooking.vercel.app"}/book/${stylistId}`;

  // Send the notification email
  await sendWaitlistNotification({
    clientEmail,
    clientName,
    serviceName: service?.name ?? "Your service",
    availableDate: available_date,
    availableTime: available_time,
    message: message || undefined,
    bookingUrl,
  });

  // Update status to notified
  await serviceClient
    .from("waitlist_entries")
    .update({ status: "notified", notified_at: new Date().toISOString() })
    .eq("id", params.id);

  return NextResponse.json({
    success: true,
    notified: clientEmail,
    stylistName: stylist?.name,
  });
}
