/**
 * Email helper using Resend API.
 * Set RESEND_API_KEY env var to enable. Silently skips if not configured.
 */
import { STUDIO } from "@/config/studio";

interface BookingConfirmationData {
  clientEmail: string;
  clientName: string | null;
  stylistName: string;
  stylistEmail: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  clientNotes?: string | null;
  cancellationPolicy?: string | null;
}

interface StatusUpdateData {
  clientEmail: string;
  clientName: string | null;
  stylistName: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  status: "confirmed" | "cancelled";
  bookingUrl: string;
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

function googleCalendarUrl(title: string, startAt: string, endAt: string, description: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(startAt)}/${fmt(endAt)}`,
    details: description,
    location: `${STUDIO.name}, ${STUDIO.location}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: `${STUDIO.shortName} <${STUDIO.fromEmail}>`, to, subject, html }),
  });
}

const baseStyle = `font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#faf8f5`;
const cardStyle = `background:#ffffff;border:1px solid #e8e2dc;border-radius:16px;padding:20px;margin-bottom:20px`;
const rowStyle = `width:100%;font-size:14px;font-family:sans-serif;border-collapse:collapse`;
const tdLabelStyle = `color:#8a7e78;padding:8px 0;border-bottom:1px solid #f5f0eb`;
const tdValueStyle = `font-weight:600;text-align:right;color:#1a1714;padding:8px 0;border-bottom:1px solid #f5f0eb`;
const tdLabelLastStyle = `color:#8a7e78;padding:8px 0`;
const tdValueLastStyle = `font-weight:600;text-align:right;color:#1a1714;padding:8px 0`;

function monogram() {
  return `<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#f5ede8,#e8d8d0);display:inline-flex;align-items:center;justify-content:center;border:2px solid #e8e2dc;margin-bottom:12px"><span style="font-size:24px;color:#9b6f6f;font-weight:600;font-family:Georgia,serif">K</span></div>`;
}

export async function sendBookingConfirmation(data: BookingConfirmationData): Promise<void> {
  const { clientEmail, clientName, stylistName, stylistEmail, serviceName, startAt, endAt, clientNotes, cancellationPolicy } = data;
  const dateTime = formatDateTime(startAt);
  const displayName = clientName ?? clientEmail;
  const calUrl = googleCalendarUrl(
    `${serviceName} with ${stylistName}`,
    startAt,
    endAt,
    `Your appointment with ${stylistName} at ${STUDIO.name}.`
  );

  const policyRow = cancellationPolicy
    ? `<tr><td style="${tdLabelStyle}">Policy</td><td style="${tdValueStyle}">${cancellationPolicy}</td></tr>`
    : "";
  const notesRow = clientNotes
    ? `<tr><td style="${tdLabelLastStyle}">Your note</td><td style="${tdValueLastStyle}">${clientNotes}</td></tr>`
    : "";

  const clientHtml = `
    <div style="${baseStyle}">
      <div style="text-align:center;margin-bottom:24px">
        ${monogram()}
        <h2 style="margin:0;font-size:22px;color:#1a1714;font-family:Georgia,serif">Request Sent ✨</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#8a7e78;font-family:sans-serif">Hi ${displayName}, ${STUDIO.ownerName} got your request!</p>
      </div>
      <div style="${cardStyle}">
        <table style="${rowStyle}">
          <tr><td style="${tdLabelStyle}">Stylist</td><td style="${tdValueStyle}">${stylistName}</td></tr>
          <tr><td style="${tdLabelStyle}">Service</td><td style="${tdValueStyle}">${serviceName}</td></tr>
          <tr><td style="${tdLabelStyle}">Date &amp; Time</td><td style="${tdValueStyle}">${dateTime}</td></tr>
          ${policyRow}
          ${notesRow}
        </table>
      </div>
      <div style="text-align:center;margin-bottom:16px">
        <a href="${calUrl}" style="display:inline-block;background:#f5ede8;color:#9b6f6f;text-decoration:none;padding:10px 22px;border-radius:50px;font-family:sans-serif;font-size:13px;font-weight:600;border:1px solid #e8d8d0">
          📅 Add to Google Calendar
        </a>
      </div>
      <p style="text-align:center;font-size:13px;color:#8a7e78;font-family:sans-serif;margin:0 0 8px">
        ${STUDIO.ownerName} will review and confirm shortly. Need to change plans? <a href="mailto:${STUDIO.contactEmail}" style="color:#9b6f6f">Contact ${STUDIO.ownerName}</a>
      </p>
      <p style="text-align:center;margin-top:20px;font-size:12px;color:#8a7e78;font-family:sans-serif">${STUDIO.name} · ${STUDIO.location}</p>
    </div>`;

  const stylistHtml = `
    <div style="${baseStyle}">
      <div style="text-align:center;margin-bottom:24px">
        ${monogram()}
        <h2 style="margin:0;font-size:22px;color:#1a1714;font-family:Georgia,serif">New Booking Request</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#8a7e78;font-family:sans-serif">You have a new request, ${STUDIO.ownerName}!</p>
      </div>
      <div style="${cardStyle}">
        <table style="${rowStyle}">
          <tr><td style="${tdLabelStyle}">Client</td><td style="${tdValueStyle}">${displayName}</td></tr>
          <tr><td style="${tdLabelStyle}">Email</td><td style="${tdValueStyle}">${clientEmail}</td></tr>
          <tr><td style="${tdLabelStyle}">Service</td><td style="${tdValueStyle}">${serviceName}</td></tr>
          <tr><td style="${tdLabelStyle}">Date &amp; Time</td><td style="${tdValueLastStyle}">${dateTime}</td></tr>
          ${clientNotes ? `<tr><td style="${tdLabelLastStyle}">Client note</td><td style="${tdValueLastStyle}">${clientNotes}</td></tr>` : ""}
        </table>
      </div>
      <div style="text-align:center">
        <a href="${STUDIO.appUrl}/admin" style="display:inline-block;background:#9b6f6f;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:50px;font-family:sans-serif;font-size:14px;font-weight:600">
          Log in to approve →
        </a>
      </div>
      <p style="text-align:center;margin-top:20px;font-size:12px;color:#8a7e78;font-family:sans-serif">${STUDIO.name} · ${STUDIO.location}</p>
    </div>`;

  await Promise.allSettled([
    sendEmail(clientEmail, `Your booking request with ${stylistName} — pending confirmation`, clientHtml),
    sendEmail(stylistEmail, `New booking request from ${displayName} — ${serviceName} at ${dateTime}`, stylistHtml),
  ]);
}

// ─── Rebooking Reminder ───────────────────────────────────────────────────────

interface RebookingReminderData {
  clientEmail: string;
  clientName: string | null;
  stylistId: string;
  serviceName: string;
  serviceId: string;
  message: string; // Keri's custom message
  suggestedDate: string | null; // YYYY-MM-DD
  bookingBaseUrl: string;
}

export async function sendRebookingReminder(data: RebookingReminderData): Promise<void> {
  const { clientEmail, clientName, stylistId, serviceName, serviceId, message, suggestedDate, bookingBaseUrl } = data;
  const displayName = clientName ?? "there";
  const bookUrl = `${bookingBaseUrl}/book/${stylistId}?serviceId=${serviceId}`;

  const suggestedLine = suggestedDate
    ? `<p style="font-size:13px;color:#8a7e78;font-family:sans-serif;text-align:center;margin:0 0 20px">
        Suggested around <strong style="color:#9b6f6f">${new Date(suggestedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</strong>
       </p>`
    : "";

  const html = `
    <div style="${baseStyle}">
      <div style="text-align:center;margin-bottom:24px">
        ${monogram()}
        <h2 style="margin:0;font-size:22px;color:#1a1714;font-family:Georgia,serif">Time for your next visit ✨</h2>
        <p style="margin:8px 0 0;font-size:14px;color:#8a7e78;font-family:sans-serif">Hi ${displayName}!</p>
      </div>
      <div style="${cardStyle}">
        <p style="font-size:15px;color:#1a1714;font-family:Georgia,serif;line-height:1.6;margin:0;white-space:pre-line">${message}</p>
      </div>
      ${suggestedLine}
      <div style="text-align:center;margin-bottom:20px">
        <a href="${bookUrl}" style="display:inline-block;background:#9b6f6f;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-family:sans-serif;font-size:15px;font-weight:600;letter-spacing:0.3px">
          Book Now →
        </a>
      </div>
      <p style="text-align:center;font-size:12px;color:#8a7e78;font-family:sans-serif;margin:0">
        Questions? <a href="mailto:${STUDIO.contactEmail}" style="color:#9b6f6f">Reply to ${STUDIO.ownerName}</a>
      </p>
      <p style="text-align:center;margin-top:20px;font-size:12px;color:#8a7e78;font-family:sans-serif">${STUDIO.name} · ${STUDIO.location}</p>
    </div>`;

  await sendEmail(clientEmail, `${STUDIO.ownerName} thinks it's time for your next ${serviceName} 💇‍♀️`, html);
}

// ─── Reschedule Request ───────────────────────────────────────────────────────

interface RescheduleRequestData {
  stylistEmail: string;
  clientName: string | null;
  clientEmail: string;
  serviceName: string;
  appointmentDate: string; // ISO
  preferredTime: string; // free text from client
  adminUrl: string;
}

export async function sendRescheduleRequest(data: RescheduleRequestData): Promise<void> {
  const { stylistEmail, clientName, clientEmail, serviceName, appointmentDate, preferredTime, adminUrl } = data;
  const displayName = clientName ?? clientEmail;
  const dateStr = formatDateTime(appointmentDate);

  const html = `
    <div style="${baseStyle}">
      <div style="text-align:center;margin-bottom:24px">
        ${monogram()}
        <h2 style="margin:0;font-size:22px;color:#1a1714;font-family:Georgia,serif">Reschedule Request</h2>
        <p style="margin:8px 0 0;font-size:14px;color:#8a7e78;font-family:sans-serif">${displayName} wants to reschedule</p>
      </div>
      <div style="${cardStyle}">
        <table style="${rowStyle}">
          <tr><td style="${tdLabelStyle}">Client</td><td style="${tdValueStyle}">${displayName}</td></tr>
          <tr><td style="${tdLabelStyle}">Email</td><td style="${tdValueStyle}">${clientEmail}</td></tr>
          <tr><td style="${tdLabelStyle}">Service</td><td style="${tdValueStyle}">${serviceName}</td></tr>
          <tr><td style="${tdLabelStyle}">Current date</td><td style="${tdValueStyle}">${dateStr}</td></tr>
          <tr><td style="${tdLabelLastStyle}">Requested time</td><td style="${tdValueLastStyle}">${preferredTime}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin-bottom:16px">
        <a href="${adminUrl}" style="display:inline-block;background:#9b6f6f;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:50px;font-family:sans-serif;font-size:14px;font-weight:600">
          View in Dashboard →
        </a>
      </div>
      <p style="text-align:center;font-size:13px;color:#8a7e78;font-family:sans-serif">Reply to this email or reach out to ${displayName} directly to find a new time.</p>
      <p style="text-align:center;margin-top:20px;font-size:12px;color:#8a7e78;font-family:sans-serif">${STUDIO.name} · ${STUDIO.location}</p>
    </div>`;

  await sendEmail(stylistEmail, `${displayName} wants to reschedule their ${serviceName}`, html);
}

// ─── Waitlist Notification ────────────────────────────────────────────────────

interface WaitlistNotificationData {
  clientEmail: string;
  clientName: string | null;
  serviceName: string;
  availableDate: string;
  availableTime: string;
  message?: string;
  bookingUrl: string;
}

export async function sendWaitlistNotification(data: WaitlistNotificationData): Promise<void> {
  const { clientEmail, clientName, serviceName, availableDate, availableTime, message, bookingUrl } = data;
  const displayName = clientName ?? "there";

  const dateFormatted = new Date(availableDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const messageBlock = message
    ? `<div style="${cardStyle};margin-bottom:16px">
        <p style="font-size:14px;color:#1a1714;font-family:Georgia,serif;line-height:1.6;margin:0;white-space:pre-line">${message}</p>
       </div>`
    : "";

  const html = `
    <div style="${baseStyle}">
      <div style="text-align:center;margin-bottom:24px">
        ${monogram()}
        <h2 style="margin:0;font-size:22px;color:#1a1714;font-family:Georgia,serif">A spot just opened up!</h2>
        <p style="margin:8px 0 0;font-size:14px;color:#8a7e78;font-family:sans-serif">Hi ${displayName}, great news!</p>
      </div>
      ${messageBlock}
      <div style="${cardStyle}">
        <table style="${rowStyle}">
          <tr><td style="${tdLabelStyle}">Service</td><td style="${tdValueStyle}">${serviceName}</td></tr>
          <tr><td style="${tdLabelStyle}">Available date</td><td style="${tdValueStyle}">${dateFormatted}</td></tr>
          <tr><td style="${tdLabelLastStyle}">Time</td><td style="${tdValueLastStyle}">${availableTime}</td></tr>
        </table>
      </div>
      <p style="text-align:center;font-size:13px;color:#8a7e78;font-family:sans-serif;margin:0 0 20px">
        This slot won&rsquo;t last long &mdash; book now to grab it!
      </p>
      <div style="text-align:center;margin-bottom:20px">
        <a href="${bookingUrl}" style="display:inline-block;background:#9b6f6f;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:50px;font-family:sans-serif;font-size:15px;font-weight:600;letter-spacing:0.3px">
          Book This Slot
        </a>
      </div>
      <p style="text-align:center;font-size:12px;color:#8a7e78;font-family:sans-serif;margin:0">
        Questions? <a href="mailto:${STUDIO.contactEmail}" style="color:#9b6f6f">Reply to ${STUDIO.ownerName}</a>
      </p>
      <p style="text-align:center;margin-top:20px;font-size:12px;color:#8a7e78;font-family:sans-serif">${STUDIO.name} &middot; ${STUDIO.location}</p>
    </div>`;

  await sendEmail(clientEmail, `A spot opened up for ${serviceName}! — ${STUDIO.shortName}`, html);
}

export async function sendStatusUpdateEmail(data: StatusUpdateData): Promise<void> {
  const { clientEmail, clientName, stylistName, serviceName, startAt, endAt, status, bookingUrl } = data;
  const dateTime = formatDateTime(startAt);
  const displayName = clientName ?? clientEmail;

  if (status === "confirmed") {
    const calUrl = googleCalendarUrl(
      `${serviceName} with ${stylistName}`,
      startAt,
      endAt,
      `Confirmed appointment with ${stylistName} at ${STUDIO.name}.`
    );

    const html = `
      <div style="${baseStyle}">
        <div style="text-align:center;margin-bottom:24px">
          ${monogram()}
          <h2 style="margin:0;font-size:24px;color:#1a1714;font-family:Georgia,serif">You&rsquo;re confirmed! 🎉</h2>
          <p style="margin:8px 0 0;font-size:14px;color:#8a7e78;font-family:sans-serif">${STUDIO.ownerName} confirmed your appointment, ${displayName}!</p>
        </div>
        <div style="${cardStyle}">
          <table style="${rowStyle}">
            <tr><td style="${tdLabelStyle}">Service</td><td style="${tdValueStyle}">${serviceName}</td></tr>
            <tr><td style="${tdLabelStyle}">Date &amp; Time</td><td style="${tdValueLastStyle}">${dateTime}</td></tr>
          </table>
        </div>
        <div style="text-align:center;margin-bottom:16px">
          <a href="${calUrl}" style="display:inline-block;background:#f5ede8;color:#9b6f6f;text-decoration:none;padding:10px 22px;border-radius:50px;font-family:sans-serif;font-size:13px;font-weight:600;border:1px solid #e8d8d0">
            📅 Add to Google Calendar
          </a>
        </div>
        <p style="text-align:center;font-size:13px;color:#8a7e78;font-family:sans-serif">
          See you there! Need to cancel? <a href="mailto:${STUDIO.contactEmail}" style="color:#9b6f6f">Contact ${STUDIO.ownerName}</a>
        </p>
        <p style="text-align:center;margin-top:20px;font-size:12px;color:#8a7e78;font-family:sans-serif">${STUDIO.name} · ${STUDIO.location}</p>
      </div>`;

    await sendEmail(clientEmail, `${STUDIO.ownerName} confirmed your appointment! — ${serviceName}`, html);
  } else if (status === "cancelled") {
    const html = `
      <div style="${baseStyle}">
        <div style="text-align:center;margin-bottom:24px">
          ${monogram()}
          <h2 style="margin:0;font-size:22px;color:#1a1714;font-family:Georgia,serif">Appointment Declined</h2>
          <p style="margin:8px 0 0;font-size:14px;color:#8a7e78;font-family:sans-serif">Hi ${displayName}, unfortunately ${STUDIO.ownerName} can&rsquo;t take this appointment.</p>
        </div>
        <div style="${cardStyle}">
          <table style="${rowStyle}">
            <tr><td style="${tdLabelStyle}">Service</td><td style="${tdValueStyle}">${serviceName}</td></tr>
            <tr><td style="${tdLabelLastStyle}">Date &amp; Time</td><td style="${tdValueLastStyle}">${dateTime}</td></tr>
          </table>
        </div>
        <div style="text-align:center;margin-bottom:16px">
          <a href="${bookingUrl}" style="display:inline-block;background:#9b6f6f;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:50px;font-family:sans-serif;font-size:14px;font-weight:600">
            Find another time →
          </a>
        </div>
        <p style="text-align:center;font-size:13px;color:#8a7e78;font-family:sans-serif">
          Questions? <a href="mailto:${STUDIO.contactEmail}" style="color:#9b6f6f">Email ${STUDIO.ownerName} directly</a>
        </p>
        <p style="text-align:center;margin-top:20px;font-size:12px;color:#8a7e78;font-family:sans-serif">${STUDIO.name} · ${STUDIO.location}</p>
      </div>`;

    await sendEmail(clientEmail, `About your booking — ${serviceName}`, html);
  }
}
