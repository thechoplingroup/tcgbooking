import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { STUDIO } from "@/config/studio";

function getTomorrow(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: STUDIO.timezone,
    timeZoneName: "short",
  });
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@kerichoplinhair.com";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${STUDIO.shortName} <${fromEmail}>`,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend error: ${res.status} ${await res.text()}`);
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role for cron (no user session)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const tomorrow = getTomorrow();
  const errors: string[] = [];

  // Query confirmed appointments for tomorrow
  const { data: appointments, error: queryError } = await supabase
    .from("appointments")
    .select(`
      id, start_at, client_id,
      service:services!service_id(name),
      client:profiles!client_id(full_name)
    `)
    .eq("status", "confirmed")
    .gte("start_at", `${tomorrow}T00:00:00`)
    .lt("start_at", `${tomorrow}T23:59:59`);

  if (queryError) {
    return NextResponse.json(
      { error: queryError.message, sent: 0, errors: [queryError.message] },
      { status: 500 }
    );
  }

  return await processAppointments(supabase, appointments ?? [], errors);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processAppointments(supabase: any, appointments: any[], errors: string[]) {
  let sent = 0;

  // Get emails in bulk via batched getUserById (not listUsers)
  const clientIds = Array.from(new Set(appointments.map((a: { client_id: string }) => a.client_id)));
  let emailMap = new Map<string, string>();

  try {
    const { resolveEmails } = await import("@/lib/supabase/resolve-emails");
    emailMap = await resolveEmails(clientIds);
  } catch {
    // Fallback: no emails available
  }

  for (const appt of appointments) {
    const clientEmail = emailMap.get(appt.client_id);
    if (!clientEmail) {
      errors.push(`No email for client ${appt.client_id}`);
      continue;
    }

    const serviceName = appt.service?.name ?? "your appointment";
    const dateTime = formatDateTime(appt.start_at);
    const clientName = appt.client?.full_name ?? "there";

    const html = `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#faf8f5">
        <div style="text-align:center;margin-bottom:24px">
          <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#f5ede8,#e8d8d0);display:inline-flex;align-items:center;justify-content:center;border:2px solid #e8e2dc;margin-bottom:12px">
            <span style="font-size:24px;color:#9b6f6f;font-weight:600;font-family:Georgia,serif">${STUDIO.monogramLetter}</span>
          </div>
          <h2 style="margin:0;font-size:22px;color:#1a1714;font-family:Georgia,serif">See you tomorrow!</h2>
          <p style="margin:8px 0 0;font-size:14px;color:#8a7e78;font-family:sans-serif">Hi ${clientName}, just a friendly reminder</p>
        </div>
        <div style="background:#ffffff;border:1px solid #e8e2dc;border-radius:16px;padding:20px;margin-bottom:20px">
          <table style="width:100%;font-size:14px;font-family:sans-serif;border-collapse:collapse">
            <tr><td style="color:#8a7e78;padding:8px 0;border-bottom:1px solid #f5f0eb">Service</td><td style="font-weight:600;text-align:right;color:#1a1714;padding:8px 0;border-bottom:1px solid #f5f0eb">${serviceName}</td></tr>
            <tr><td style="color:#8a7e78;padding:8px 0">Date & Time</td><td style="font-weight:600;text-align:right;color:#1a1714;padding:8px 0">${dateTime}</td></tr>
          </table>
        </div>
        <p style="text-align:center;font-size:13px;color:#8a7e78;font-family:sans-serif;margin:0 0 8px">
          Need to make changes? <a href="mailto:${STUDIO.contactEmail}" style="color:#9b6f6f">Reply to this email</a> or contact ${STUDIO.ownerName} directly.
        </p>
        <p style="text-align:center;margin-top:20px;font-size:12px;color:#8a7e78;font-family:sans-serif">${STUDIO.name} &middot; ${STUDIO.location}</p>
      </div>`;

    try {
      await sendEmail(
        clientEmail,
        `Reminder: Your appointment tomorrow with ${STUDIO.ownerName}`,
        html
      );
      sent++;

      // Try to mark reminder_sent = true (column may not exist)
      try {
        await supabase
          .from("appointments")
          .update({ reminder_sent: true })
          .eq("id", appt.id);
      } catch {
        // Column doesn't exist yet — that's fine
      }
    } catch (err) {
      errors.push(`Failed to send to ${clientEmail}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ sent, errors });
}
