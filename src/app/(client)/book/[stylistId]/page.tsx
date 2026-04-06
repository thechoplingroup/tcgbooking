"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { STUDIO } from "@/config/studio";
import ErrorBoundary from "@/components/ErrorBoundary";

// Page title — can't use generateMetadata in client component, set via document
// Meta description handled in layout

interface PublicService {
  id: string;
  name: string;
  duration_minutes: number;
  internal_price_cents?: number;
  notes?: string | null;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

interface PublicStylist {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  cancellation_policy?: string | null;
  services: PublicService[];
}

interface Slot {
  start_at: string;
  end_at: string;
}

type Step = "service" | "date" | "slots" | "confirm" | "done";

function formatTime(iso: string): string {
  // Real UTC instants → rendered in the studio's local zone.
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: STUDIO.timezone,
  });
}

function formatDate(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!)).toLocaleDateString([], {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

function formatDateShort(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!)).toLocaleDateString([], {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getUpcomingDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
    days.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`);
  }
  return days;
}

function googleCalendarUrl(title: string, startAt: string, endAt: string): string {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(startAt)}/${fmt(endAt)}`,
    details: `Your appointment with ${STUDIO.shortName} — ${STUDIO.location}`,
    location: `${STUDIO.name}, ${STUDIO.location}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ServiceSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-[#e8e2dc] rounded-2xl px-5 py-4 animate-pulse">
          <div className="h-4 bg-[#f0ebe6] rounded w-40 mb-2" />
          <div className="h-3 bg-[#f0ebe6] rounded w-20" />
        </div>
      ))}
    </div>
  );
}

function SlotSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-white border border-[#e8e2dc] rounded-xl py-3 animate-pulse">
          <div className="h-4 bg-[#f0ebe6] rounded w-12 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export default function StylistBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const stylistId = params.stylistId as string;
  // serviceId param kept for rebooking emails but no longer auto-skips step 1
  const preselectedServiceId = searchParams.get("serviceId");

  const [stylist, setStylist] = useState<PublicStylist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("service");
  const [selectedServices, setSelectedServices] = useState<PublicService[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [clientNotes, setClientNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [nextAvailable, setNextAvailable] = useState<{ date: string; label: string } | null>(null);

  const upcomingDays = getUpcomingDays(28);

  useEffect(() => {
    fetch(`/api/stylists/${stylistId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setStylist(data.stylist);
          // serviceId param pre-selects but stays on step 1 for multi-select
          if (preselectedServiceId && data.stylist?.services) {
            const svc = data.stylist.services.find((s: PublicService) => s.id === preselectedServiceId);
            if (svc) { setSelectedServices([svc]); }
          }
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stylistId]);

  // Computed totals for selected services
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.internal_price_cents ?? 0), 0);
  const serviceIdsParam = selectedServices.map((s) => s.id).join(",");

  // Find next available date when services are selected
  useEffect(() => {
    if (selectedServices.length === 0 || step !== "date") return;
    setNextAvailable(null);
    let cancelled = false;

    async function findNext() {
      for (const day of upcomingDays.slice(0, 14)) {
        if (cancelled) return;
        try {
          const res = await fetch(
            `/api/stylists/${stylistId}/availability?date=${day}&serviceIds=${serviceIdsParam}`
          );
          const data = await res.json();
          if (data.slots && data.slots.length > 0) {
            if (!cancelled) {
              const [y, m, d] = day.split("-").map(Number);
              const dateObj = new Date(Date.UTC(y!, m! - 1, d!));
              const label = dateObj.toLocaleDateString([], {
                weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
              });
              setNextAvailable({ date: day, label });
            }
            return;
          }
        } catch { /* skip */ }
      }
    }
    findNext();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceIdsParam, step]);

  async function handleSelectDate(date: string) {
    if (selectedServices.length === 0) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/stylists/${stylistId}/availability?date=${date}&serviceIds=${serviceIdsParam}`);
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch { setSlots([]); }
    finally { setSlotsLoading(false); setStep("slots"); }
  }

  async function handleConfirm() {
    if (selectedServices.length === 0 || !selectedSlot) return;
    setBooking(true);
    setBookingError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stylist_id: stylistId,
          service_ids: selectedServices.map((s) => s.id),
          start_at: selectedSlot.start_at,
          end_at: selectedSlot.end_at,
          client_notes: clientNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setBookingError(data.error ?? "Booking failed. Please try again.");
      else setStep("done");
    } catch { setBookingError("Network error. Please try again."); }
    finally { setBooking(false); }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto">
        {/* Header skeleton */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#f0ebe6] animate-pulse mx-auto mb-4" />
          <div className="h-8 bg-[#f0ebe6] animate-pulse rounded w-48 mx-auto mb-2" />
          <div className="h-4 bg-[#f0ebe6] animate-pulse rounded w-64 mx-auto" />
        </div>
        <ServiceSkeleton />
      </div>
    );
  }

  if (error || !stylist) {
    return (
      <div className="text-center py-16">
        <p className="text-[#8a7e78]">Unable to load this page. Please try again.</p>
      </div>
    );
  }

  const steps: Step[] = ["service", "date", "slots", "confirm"];
  const stepLabels: Record<Step, string> = { service: "Service", date: "Date", slots: "Time", confirm: "Confirm", done: "Done" };
  const currentStepIndex = steps.indexOf(step);

  const calUrl = selectedServices.length > 0 && selectedSlot
    ? googleCalendarUrl(`${selectedServices.map((s) => s.name).join(", ")} with ${stylist.name}`, selectedSlot.start_at, selectedSlot.end_at)
    : null;

  return (
    <ErrorBoundary>
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center mx-auto mb-4 border-2 border-[#e8e2dc] shadow-sm overflow-hidden">
          {stylist.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stylist.avatar_url} alt={stylist.name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-3xl text-[#9b6f6f]">K</span>
          )}
        </div>
        <h1 className="font-display text-3xl text-[#1a1714]">{stylist.name}</h1>
        {stylist.bio && (
          <p className="text-[#8a7e78] text-sm mt-1 font-light max-w-sm mx-auto">{stylist.bio}</p>
        )}
      </div>

      {/* Progress */}
      {step !== "done" && (
        <div className="flex items-center gap-0 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  i < currentStepIndex ? "bg-[#9b6f6f] text-white"
                  : i === currentStepIndex ? "bg-[#9b6f6f] text-white ring-4 ring-[#f5ede8]"
                  : "bg-[#e8e2dc] text-[#8a7e78]"
                }`}>
                  {i < currentStepIndex ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </div>
                <span className={`text-[10px] mt-1 tracking-wide ${i === currentStepIndex ? "text-[#9b6f6f] font-medium" : "text-[#8a7e78]"}`}>
                  {stepLabels[s]}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-px flex-1 mb-4 mx-1 transition-colors ${i < currentStepIndex ? "bg-[#9b6f6f]" : "bg-[#e8e2dc]"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== DONE ===== */}
      {step === "done" && selectedServices.length > 0 && selectedDate && selectedSlot && (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f5ede8] border border-[#e8d8d0] flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl text-[#1a1714] mb-2">Request Sent!</h2>
          <p className="text-[#8a7e78] mb-6 text-sm leading-relaxed max-w-xs mx-auto">
            {STUDIO.ownerName} will review and confirm shortly. You&apos;ll get an email when it&apos;s approved.
          </p>

          <div className="bg-[#faf8f5] rounded-xl p-5 text-left space-y-3 mb-6 border border-[#e8e2dc]">
            {[
              { label: selectedServices.length === 1 ? "Service" : "Services", value: selectedServices.map((s) => s.name).join(", ") },
              { label: "Duration", value: formatDuration(totalDuration) },
              { label: "Date", value: formatDate(selectedDate) },
              { label: "Time", value: formatTime(selectedSlot.start_at) },
              ...(clientNotes ? [{ label: "Your note", value: clientNotes }] : []),
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-[#8a7e78]">{row.label}</span>
                <span className="font-medium text-[#1a1714] text-right ml-4 max-w-[60%]">{row.value}</span>
              </div>
            ))}
          </div>

          {stylist.cancellation_policy && (
            <div className="bg-[#fffbeb] border border-[#fcd34d] rounded-xl p-3 mb-6 text-left">
              <p className="text-xs font-semibold text-amber-700 mb-1">Cancellation Policy</p>
              <p className="text-xs text-amber-700">{stylist.cancellation_policy}</p>
            </div>
          )}

          {calUrl && (
            <a
              href={calUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#f5ede8] text-[#9b6f6f] font-medium rounded-full hover:bg-[#ede0d8] transition-all active:scale-[0.98] text-sm mb-3 border border-[#e8d8d0] min-h-[48px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Add to Google Calendar
            </a>
          )}

          <p className="text-xs text-[#8a7e78] mb-5">
            Questions?{" "}
            <a href={`mailto:${STUDIO.contactEmail}`} className="text-[#9b6f6f] hover:underline">
              Contact {STUDIO.ownerName}
            </a>
          </p>

          <button
            onClick={() => { setStep("service"); setSelectedServices([]); setSelectedDate(null); setSelectedSlot(null); setSlots([]); setClientNotes(""); }}
            className="px-6 py-2.5 border border-[#e8e2dc] text-[#5c4a42] text-sm font-medium rounded-full hover:bg-[#f5ede8] transition-all active:scale-[0.98] min-h-[44px]"
          >
            Book another
          </button>
        </div>
      )}

      {/* ===== SERVICE ===== */}
      {step === "service" && (
        <div>
          <h2 className="font-display text-xl text-[#1a1714] mb-1">Choose your services</h2>
          <p className="text-sm text-[#8a7e78] mb-5">Select one or more services for your appointment.</p>
          {stylist.services.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-[#e8e2dc]">
              <p className="text-sm text-[#8a7e78]">No services available at this time.</p>
              <a href={`mailto:${STUDIO.contactEmail}`} className="text-[#9b6f6f] text-sm mt-3 block hover:underline">
                Contact {STUDIO.ownerName} directly →
              </a>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {stylist.services.map((svc) => {
                  const isSelected = selectedServices.some((s) => s.id === svc.id);
                  return (
                    <button
                      key={svc.id}
                      onClick={() => {
                        setSelectedServices((prev) =>
                          isSelected ? prev.filter((s) => s.id !== svc.id) : [...prev, svc]
                        );
                      }}
                      className={`w-full text-left border rounded-2xl px-5 py-4 transition-all group min-h-[60px] ${
                        isSelected
                          ? "bg-[#fdf8f6] border-[#9b6f6f] shadow-sm"
                          : "bg-white border-[#e8e2dc] hover:border-[#9b6f6f] hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? "bg-[#9b6f6f] border-[#9b6f6f]" : "border-[#d4cdc7] group-hover:border-[#9b6f6f]"
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium text-sm transition-colors ${isSelected ? "text-[#9b6f6f]" : "text-[#1a1714] group-hover:text-[#9b6f6f]"}`}>
                            {svc.name}
                          </span>
                          <span className="block text-xs text-[#8a7e78] mt-0.5">
                            {formatDuration(svc.duration_minutes)}
                            {svc.internal_price_cents ? ` · ${formatPrice(svc.internal_price_cents)}` : ""}
                            {svc.notes && ` · ${svc.notes}`}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Running total + continue */}
              {selectedServices.length > 0 && (
                <div className="sticky bottom-4 mt-5">
                  <div className="bg-white border border-[#e8e2dc] rounded-2xl shadow-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-[#5c4a42]">
                        <span className="font-semibold">{selectedServices.length} {selectedServices.length === 1 ? "service" : "services"}</span>
                        <span className="mx-1.5 text-[#d4cdc7]">·</span>
                        <span>{formatDuration(totalDuration)}</span>
                        {totalPrice > 0 && (
                          <>
                            <span className="mx-1.5 text-[#d4cdc7]">·</span>
                            <span className="font-semibold text-[#4a7c59]">{formatPrice(totalPrice)}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep("date")}
                      className="w-full py-3 bg-[#9b6f6f] text-white font-semibold rounded-full hover:bg-[#8a5f5f] active:scale-[0.99] transition-all text-sm tracking-wide min-h-[48px]"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <p className="text-xs text-[#8a7e78] text-center mt-5">
            Questions?{" "}
            <a href={`mailto:${STUDIO.contactEmail}`} className="text-[#9b6f6f] hover:underline">Contact {STUDIO.ownerName}</a>
          </p>
        </div>
      )}

      {/* ===== DATE ===== */}
      {step === "date" && selectedServices.length > 0 && (
        <div>
          <button onClick={() => { setStep("service"); setSelectedDate(null); }}
            className="flex items-center gap-1.5 text-sm text-[#8a7e78] hover:text-[#9b6f6f] mb-5 transition-all active:opacity-70 min-h-[44px]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to services
          </button>

          <div className="bg-[#f5ede8] rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#5c3a3a]">{selectedServices.map((s) => s.name).join(", ")}</p>
              <p className="text-xs text-[#9b6f6f]">{selectedServices.length} {selectedServices.length === 1 ? "service" : "services"} · {formatDuration(totalDuration)}</p>
            </div>
            <button onClick={() => { setStep("service"); setSelectedDate(null); }} className="text-xs text-[#9b6f6f] hover:text-[#8a5f5f] font-medium">
              Change
            </button>
          </div>

          {/* Next available hint */}
          {nextAvailable && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mb-5">
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-emerald-700">
                <span className="font-semibold">Next available:</span> {nextAvailable.label}
              </p>
              <button
                onClick={() => handleSelectDate(nextAvailable.date)}
                className="ml-auto text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline flex-shrink-0"
              >
                Select →
              </button>
            </div>
          )}

          <h2 className="font-display text-xl text-[#1a1714] mb-5">Choose a date</h2>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {upcomingDays.map((d) => {
              const [y, m, day] = d.split("-").map(Number);
              const dateObj = new Date(Date.UTC(y!, m! - 1, day!));
              const dayOfWeek = dateObj.getUTCDay();
              const weekday = DAY_NAMES[dayOfWeek]!;
              const monthDay = dateObj.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
              const isToday = d === upcomingDays[0];
              const isClosed = dayOfWeek === 0 || dayOfWeek === 1;
              const isNextAvail = nextAvailable?.date === d;

              return (
                <button
                  key={d}
                  onClick={() => !isClosed && handleSelectDate(d)}
                  disabled={isClosed}
                  className={`border rounded-xl py-3 text-center transition-all relative ${
                    isClosed ? "opacity-30 cursor-not-allowed bg-white border-[#e8e2dc]"
                    : isNextAvail ? "bg-emerald-50 border-emerald-300 shadow-sm cursor-pointer"
                    : "bg-white border-[#e8e2dc] hover:border-[#9b6f6f] hover:shadow-sm cursor-pointer"
                  }`}
                >
                  <p className={`text-[10px] font-medium uppercase tracking-wide ${isClosed ? "text-[#8a7e78]" : isNextAvail ? "text-emerald-600" : "text-[#c9a96e]"}`}>
                    {weekday}
                  </p>
                  <p className={`text-sm font-semibold mt-0.5 ${isClosed ? "text-[#8a7e78]" : "text-[#1a1714]"}`}>
                    {monthDay.split(" ")[1]}
                  </p>
                  <p className="text-[10px] mt-0.5 text-[#8a7e78]">{monthDay.split(" ")[0]}</p>
                  {isToday && !isClosed && <div className="w-1 h-1 bg-[#9b6f6f] rounded-full mx-auto mt-1" />}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-[#8a7e78] mt-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e8e2dc] inline-block" />
            Closed Sunday &amp; Monday
          </p>
        </div>
      )}

      {/* ===== SLOTS ===== */}
      {step === "slots" && selectedServices.length > 0 && selectedDate && (
        <div>
          <button onClick={() => { setStep("date"); setSelectedDate(null); setSlots([]); }}
            className="flex items-center gap-1.5 text-sm text-[#8a7e78] hover:text-[#9b6f6f] mb-5 transition-all active:opacity-70 min-h-[44px]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Change date
          </button>

          <div className="bg-[#f5ede8] rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#9b6f6f] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[#5c3a3a]">{formatDateShort(selectedDate)}</p>
              <p className="text-xs text-[#9b6f6f]">{selectedServices.map((s) => s.name).join(", ")} · {formatDuration(totalDuration)}</p>
            </div>
          </div>

          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-display text-xl text-[#1a1714]">Choose a time</h2>
            <p className="text-[10px] tracking-wide text-[#8a7e78] italic">
              all times central · {STUDIO.location.split(",")[0]}
            </p>
          </div>

          {slotsLoading ? <SlotSkeleton /> : slots.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-[#e8e2dc]">
              <p className="text-[#1a1714] font-medium mb-1">No availability on this day</p>
              <p className="text-sm text-[#8a7e78] mb-4">Please choose another date.</p>
              <button onClick={() => { setStep("date"); setSelectedDate(null); setSlots([]); }}
                className="px-5 py-2 border border-[#e8e2dc] text-sm font-medium text-[#5c4a42] rounded-full hover:bg-[#f5ede8] transition-all active:scale-[0.98] min-h-[44px]">
                Choose another date
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.start_at}
                  onClick={() => { setSelectedSlot(slot); setStep("confirm"); }}
                  className="bg-white border border-[#e8e2dc] rounded-xl py-3 text-sm font-medium text-[#1a1714] hover:border-[#9b6f6f] hover:bg-[#fdf8f6] hover:text-[#9b6f6f] active:scale-95 transition-all min-h-[44px]"
                >
                  {formatTime(slot.start_at)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CONFIRM ===== */}
      {step === "confirm" && selectedServices.length > 0 && selectedDate && selectedSlot && (
        <div>
          <button onClick={() => { setStep("slots"); setSelectedSlot(null); }}
            className="flex items-center gap-1.5 text-sm text-[#8a7e78] hover:text-[#9b6f6f] mb-5 transition-all active:opacity-70 min-h-[44px]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Change time
          </button>

          <h2 className="font-display text-2xl text-[#1a1714] mb-6">Confirm your appointment</h2>

          <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-5">
            <div className="bg-gradient-to-r from-[#f5ede8] to-[#faf8f5] px-6 py-4 border-b border-[#e8e2dc]">
              <p className="text-xs text-[#c9a96e] uppercase tracking-widest font-medium mb-1">Appointment Details</p>
              <p className="font-display text-xl text-[#1a1714]">{selectedServices.map((s) => s.name).join(", ")}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              {selectedServices.length > 1 && (
                <div className="space-y-1.5 pb-3 border-b border-[#f0ebe6]">
                  {selectedServices.map((svc) => (
                    <div key={svc.id} className="flex items-center justify-between text-sm">
                      <span className="text-[#5c4a42]">{svc.name}</span>
                      <span className="text-xs text-[#8a7e78]">
                        {formatDuration(svc.duration_minutes)}
                        {svc.internal_price_cents ? ` · ${formatPrice(svc.internal_price_cents)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {[
                { label: "Date", value: formatDate(selectedDate), icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
                { label: "Time", value: formatTime(selectedSlot.start_at), icon: "M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" },
                { label: "Total Duration", value: formatDuration(totalDuration), icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
                { label: "Stylist", value: stylist.name, icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
                ...(totalPrice > 0 ? [{ label: "Total", value: formatPrice(totalPrice), icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }] : []),
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#f5ede8] flex items-center justify-center text-[#9b6f6f] flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={row.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-[#8a7e78]">{row.label}</p>
                    <p className="text-sm font-medium text-[#1a1714]">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Client notes */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#5c4a42] mb-2">
              Notes for {STUDIO.ownerName} <span className="text-[#8a7e78] font-normal">(optional)</span>
            </label>
            <textarea
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="e.g. I want to go lighter, or I have a sensitive scalp…"
              className="w-full border border-[#e8e2dc] rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#9b6f6f] bg-white resize-none leading-relaxed"
            />
            <p className="text-xs text-[#8a7e78] mt-1 text-right">{clientNotes.length}/300</p>
          </div>

          {stylist.cancellation_policy && (
            <div className="bg-[#fffbeb] border border-[#fcd34d] rounded-xl p-3 mb-5">
              <p className="text-xs font-semibold text-amber-700 mb-1">Cancellation Policy</p>
              <p className="text-xs text-amber-700">{stylist.cancellation_policy}</p>
            </div>
          )}

          {bookingError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
              {bookingError}
            </div>
          )}

          <p className="text-xs text-[#8a7e78] mb-4 text-center">{STUDIO.ownerName} will review and confirm your request.</p>

          <button
            onClick={handleConfirm}
            disabled={booking}
            className="w-full py-3.5 bg-[#9b6f6f] text-white font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-60 active:scale-[0.99] transition-all text-sm tracking-wide min-h-[52px]"
          >
            {booking ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending request…
              </span>
            ) : "Send Appointment Request"}
          </button>

          <p className="text-xs text-[#8a7e78] text-center mt-3">
            Need to cancel?{" "}
            <a href={`mailto:${STUDIO.contactEmail}`} className="text-[#9b6f6f] hover:underline">Contact {STUDIO.ownerName}</a>
          </p>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
