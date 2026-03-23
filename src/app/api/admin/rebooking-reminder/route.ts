import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendRebookingReminder } from "@/lib/email";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: stylist } = await supabase
    .from("stylists").select("id, name").eq("user_id", user.id).single();
  if (!stylist) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as {
    appointment_id: string;
    client_id: string;
    service_id: string;
    service_name: string;
    message: string;
    suggested_date: string | null;
  };

  const { appointment_id, client_id, service_id, service_name, message, suggested_date } = body;
  if (!client_id || !service_id || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Get client email
  let clientEmail: string | null = null;
  let clientName: string | null = null;
  try {
    const { data: profileData } = await serviceClient
      .from("profiles").select("full_name").eq("id", client_id).single();
    clientName = profileData?.full_name ?? null;
    const { data: userData } = await serviceClient.auth.admin.getUserById(client_id);
    clientEmail = userData?.user?.email ?? null;
  } catch { /* fall through */ }

  if (!clientEmail) {
    return NextResponse.json({ error: "Could not find client email" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tcgbooking.vercel.app";

  // Send the email
  await sendRebookingReminder({
    clientEmail,
    clientName,
    stylistId: stylist.id,
    serviceName: service_name,
    serviceId: service_id,
    message,
    suggestedDate: suggested_date,
    bookingBaseUrl: appUrl,
  });

  // Record reminder sent — graceful if table doesn't exist yet
  try {
    await serviceClient.from("rebooking_reminders").insert({
      stylist_id: stylist.id,
      client_id,
      appointment_id: appointment_id ?? null,
      service_id,
      suggested_date: suggested_date ?? null,
      message,
      sent_at: new Date().toISOString(),
    });
  } catch { /* table may not exist yet */ }

  return NextResponse.json({ sent: true });
}
