import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

async function sendEmailViaResend(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Keri Choplin Hair <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: stylist } = await supabase
    .from("stylists").select("id, name").eq("user_id", user.id).single();
  if (!stylist) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { message, suggestedDate } = await request.json() as {
    message: string;
    suggestedDate?: string;
  };

  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Get client info
  let clientEmail: string | null = null;
  let clientName: string | null = null;
  try {
    const { data: profile } = await serviceClient
      .from("profiles").select("full_name").eq("id", params.id).single();
    clientName = profile?.full_name ?? null;
    const { data: userData } = await serviceClient.auth.admin.getUserById(params.id);
    clientEmail = userData?.user?.email ?? null;
  } catch { /* fall through */ }

  if (!clientEmail) {
    return NextResponse.json({ error: "Could not find client email" }, { status: 400 });
  }

  const displayName = clientName ?? "there";
  const bookUrl = "https://tcgbooking.vercel.app/book";

  const suggestedLine = suggestedDate
    ? `<p style="font-size:13px;color:#8a7e78;font-family:sans-serif;text-align:center;margin:0 0 20px">
        Suggested around <strong style="color:#9b6f6f">${new Date(suggestedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</strong>
       </p>`
    : "";

  const html = `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#faf8f5">
      <div style="text-align:center;margin-bottom:24px">
        <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#f5ede8,#e8d8d0);display:inline-flex;align-items:center;justify-content:center;border:2px solid #e8e2dc;margin-bottom:12px">
          <span style="font-size:24px;color:#9b6f6f;font-weight:600;font-family:Georgia,serif">K</span>
        </div>
        <h2 style="margin:0;font-size:22px;color:#1a1714;font-family:Georgia,serif">Time for your next appointment with Keri ✨</h2>
        <p style="margin:8px 0 0;font-size:14px;color:#8a7e78;font-family:sans-serif">Hi ${displayName}!</p>
      </div>
      <div style="background:#ffffff;border:1px solid #e8e2dc;border-radius:16px;padding:20px;margin-bottom:20px">
        <p style="font-size:15px;color:#1a1714;font-family:Georgia,serif;line-height:1.6;margin:0;white-space:pre-line">${message}</p>
      </div>
      ${suggestedLine}
      <div style="text-align:center;margin-bottom:20px">
        <a href="${bookUrl}" style="display:inline-block;background:#9b6f6f;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-family:sans-serif;font-size:15px;font-weight:600;letter-spacing:0.3px">
          Book Now →
        </a>
      </div>
      <p style="text-align:center;font-size:12px;color:#8a7e78;font-family:sans-serif;margin:0">
        Questions? <a href="mailto:kerichoplin@gmail.com" style="color:#9b6f6f">Reply to Keri</a>
      </p>
      <p style="text-align:center;margin-top:20px;font-size:12px;color:#8a7e78;font-family:sans-serif">Keri Choplin Hair Studio · Lafayette, Louisiana</p>
    </div>`;

  await sendEmailViaResend(
    clientEmail,
    "Time for your next appointment with Keri ✨",
    html
  );

  return NextResponse.json({ sent: true });
}
