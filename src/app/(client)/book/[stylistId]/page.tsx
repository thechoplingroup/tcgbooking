"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

interface PublicService {
  id: string;
  name: string;
  duration_minutes: number;
}

interface PublicStylist {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  services: PublicService[];
}

interface Slot {
  start_at: string;
  end_at: string;
}

type Step = "service" | "date" | "slots" | "confirm" | "done";

const SERVICE_CATEGORIES: Record<string, string[]> = {
  "Hair Services": ["Women's Haircut", "Men's Haircut", "Children's Haircut", "Blowout", "Trim", "Bang"],
  "Color Services": ["Color", "Highlights", "Balayage", "Ombre", "Gloss", "Toner"],
  "Treatments": ["Treatment", "Keratin", "Olaplex", "Scalp"],
  "Styling": ["Updo", "Bridal", "Waves"],
};

function categorizeService(name: string): string {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(SERVICE_CATEGORIES)) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) return cat;
  }
  return "Other";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

function formatDate(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!)).toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDateShort(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, day!)).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
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
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    days.push(`${y}-${mo}-${day}`);
  }
  return days;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StylistBookingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stylistId = params.stylistId as string;
  const preselectedServiceId = searchParams.get("serviceId");

  const [stylist, setStylist] = useState<PublicStylist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const upcomingDays = getUpcomingDays(28);

  useEffect(() => {
    fetch(`/api/stylists/${stylistId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setStylist(data.stylist);
          // Preselect service if passed via query param
          if (preselectedServiceId && data.stylist?.services) {
            const svc = data.stylist.services.find((s: PublicService) => s.id === preselectedServiceId);
            if (svc) {
              setSelectedService(svc);
              setStep("date");
            }
          }
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stylistId]);

  async function handleSelectDate(date: string) {
    if (!selectedService) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlotsLoading(true);
    try {
      const res = await fetch(
        `/api/stylists/${stylistId}/availability?date=${date}&serviceId=${selectedService.id}`
      );
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
      setStep("slots");
    }
  }

  async function handleConfirm() {
    if (!selectedService || !selectedSlot) return;
    setBooking(true);
    setBookingError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stylist_id: stylistId,
          service_id: selectedService.id,
          start_at: selectedSlot.start_at,
          end_at: selectedSlot.end_at,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookingError(data.error ?? "Booking failed. Please try again.");
      } else {
        setStep("done");
      }
    } catch {
      setBookingError("Network error. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
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

  // Step progress
  const steps: Step[] = ["service", "date", "slots", "confirm"];
  const stepLabels: Record<Step, string> = {
    service: "Service",
    date: "Date",
    slots: "Time",
    confirm: "Confirm",
    done: "Done",
  };
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Stylist header */}
      <div className="flex items-center gap-4 mb-8">
        {stylist.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stylist.avatar_url}
            alt={stylist.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-[#e8e2dc]"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center border-2 border-[#e8e2dc] flex-shrink-0">
            <span className="text-2xl font-display text-[#9b6f6f]">
              {stylist.name.charAt(0)}
            </span>
          </div>
        )}
        <div>
          <h1 className="font-display text-2xl text-[#1a1714]">{stylist.name}</h1>
          {stylist.bio && <p className="text-sm text-[#8a7e78] mt-0.5">{stylist.bio}</p>}
        </div>
      </div>

      {/* Progress indicator */}
      {step !== "done" && (
        <div className="flex items-center gap-0 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    i < currentStepIndex
                      ? "bg-[#9b6f6f] text-white"
                      : i === currentStepIndex
                      ? "bg-[#9b6f6f] text-white ring-4 ring-[#f5ede8]"
                      : "bg-[#e8e2dc] text-[#8a7e78]"
                  }`}
                >
                  {i < currentStepIndex ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
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
      {step === "done" && (
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f0f9f0] border border-[#c6e8c6] flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-[#4caf50]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl text-[#1a1714] mb-2">You&apos;re booked!</h2>
          <p className="text-[#8a7e78] mb-6 text-sm">
            Your appointment request has been submitted. Keri will confirm it shortly.
          </p>

          <div className="bg-[#faf9f7] rounded-xl p-5 text-left space-y-3 mb-7 border border-[#e8e2dc]">
            <div className="flex justify-between text-sm">
              <span className="text-[#8a7e78]">Service</span>
              <span className="font-medium text-[#1a1714]">{selectedService?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8a7e78]">Duration</span>
              <span className="font-medium text-[#1a1714]">{formatDuration(selectedService?.duration_minutes ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8a7e78]">Date</span>
              <span className="font-medium text-[#1a1714]">{selectedDate ? formatDate(selectedDate) : ""}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8a7e78]">Time</span>
              <span className="font-medium text-[#1a1714]">{selectedSlot ? formatTime(selectedSlot.start_at) : ""}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#8a7e78]">Stylist</span>
              <span className="font-medium text-[#1a1714]">{stylist.name}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push("/appointments")}
              className="px-6 py-2.5 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-colors"
            >
              View my appointments
            </button>
            <button
              onClick={() => {
                setStep("service");
                setSelectedService(null);
                setSelectedDate(null);
                setSelectedSlot(null);
                setSlots([]);
              }}
              className="px-6 py-2.5 border border-[#e8e2dc] text-[#5c4a42] text-sm font-medium rounded-full hover:bg-[#f5ede8] transition-colors"
            >
              Book another
            </button>
          </div>
        </div>
      )}

      {/* ===== SERVICE SELECTION ===== */}
      {step === "service" && (
        <div>
          <h2 className="font-display text-xl text-[#1a1714] mb-5">Choose a service</h2>
          {stylist.services.length === 0 ? (
            <p className="text-sm text-[#8a7e78]">No services available at this time.</p>
          ) : (
            <div className="space-y-6">
              {(["Hair Services", "Color Services", "Treatments", "Styling", "Other"] as const).map((category) => {
                const catServices = stylist.services.filter(
                  (svc) => categorizeService(svc.name) === category
                );
                if (catServices.length === 0) return null;
                return (
                  <div key={category}>
                    <h3 className="text-xs font-semibold text-[#c9a96e] uppercase tracking-widest mb-3">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {catServices.map((svc) => (
                        <button
                          key={svc.id}
                          onClick={() => {
                            setSelectedService(svc);
                            setStep("date");
                          }}
                          className="w-full text-left bg-white border border-[#e8e2dc] rounded-xl px-5 py-4 hover:border-[#9b6f6f] hover:shadow-sm transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-[#1a1714] text-sm group-hover:text-[#9b6f6f] transition-colors">
                                {svc.name}
                              </span>
                              <span className="block text-xs text-[#8a7e78] mt-0.5">
                                {formatDuration(svc.duration_minutes)}
                              </span>
                            </div>
                            <svg
                              className="w-4 h-4 text-[#c9a96e] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-3"
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== DATE SELECTION ===== */}
      {step === "date" && selectedService && (
        <div>
          <button
            onClick={() => { setStep("service"); setSelectedDate(null); }}
            className="flex items-center gap-1.5 text-sm text-[#8a7e78] hover:text-[#9b6f6f] mb-5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to services
          </button>

          {/* Selected service summary */}
          <div className="bg-[#f5ede8] rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#5c3a3a]">{selectedService.name}</p>
              <p className="text-xs text-[#9b6f6f]">{formatDuration(selectedService.duration_minutes)}</p>
            </div>
            <button
              onClick={() => { setStep("service"); setSelectedDate(null); }}
              className="text-xs text-[#9b6f6f] hover:text-[#8a5f5f] font-medium"
            >
              Change
            </button>
          </div>

          <h2 className="font-display text-xl text-[#1a1714] mb-5">Choose a date</h2>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {upcomingDays.map((d) => {
              const [y, m, day] = d.split("-").map(Number);
              const dateObj = new Date(Date.UTC(y!, m! - 1, day!));
              const dayOfWeek = dateObj.getUTCDay();
              const weekday = DAY_NAMES[dayOfWeek]!;
              const monthDay = dateObj.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
              const isToday = d === getUpcomingDays(1)[0];
              // Tue-Sat = 2-6
              const isClosed = dayOfWeek === 0 || dayOfWeek === 1;

              return (
                <button
                  key={d}
                  onClick={() => !isClosed && handleSelectDate(d)}
                  disabled={isClosed}
                  className={`border rounded-xl py-3 text-center transition-all ${
                    isClosed
                      ? "opacity-30 cursor-not-allowed bg-white border-[#e8e2dc]"
                      : "bg-white border-[#e8e2dc] hover:border-[#9b6f6f] hover:shadow-sm cursor-pointer"
                  }`}
                >
                  <p className={`text-[10px] font-medium uppercase tracking-wide ${isClosed ? "text-[#8a7e78]" : "text-[#c9a96e]"}`}>
                    {weekday}
                  </p>
                  <p className={`text-sm font-semibold mt-0.5 ${isClosed ? "text-[#8a7e78]" : "text-[#1a1714]"}`}>
                    {monthDay.split(" ")[1]}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${isClosed ? "text-[#8a7e78]" : "text-[#8a7e78]"}`}>
                    {monthDay.split(" ")[0]}
                  </p>
                  {isToday && !isClosed && (
                    <div className="w-1 h-1 bg-[#9b6f6f] rounded-full mx-auto mt-1" />
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-[#8a7e78] mt-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e8e2dc] inline-block" />
            Closed Sunday & Monday
          </p>
        </div>
      )}

      {/* ===== TIME SLOT SELECTION ===== */}
      {step === "slots" && selectedService && selectedDate && (
        <div>
          <button
            onClick={() => { setStep("date"); setSelectedDate(null); setSlots([]); }}
            className="flex items-center gap-1.5 text-sm text-[#8a7e78] hover:text-[#9b6f6f] mb-5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Change date
          </button>

          {/* Summary bar */}
          <div className="bg-[#f5ede8] rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#9b6f6f] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[#5c3a3a]">{formatDateShort(selectedDate)}</p>
              <p className="text-xs text-[#9b6f6f]">{selectedService.name}</p>
            </div>
          </div>

          <h2 className="font-display text-xl text-[#1a1714] mb-5">Choose a time</h2>

          {slotsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-[#e8e2dc]">
              <p className="text-[#1a1714] font-medium mb-1">No availability on this day</p>
              <p className="text-sm text-[#8a7e78]">Please go back and choose another date.</p>
              <button
                onClick={() => { setStep("date"); setSelectedDate(null); setSlots([]); }}
                className="mt-4 px-5 py-2 border border-[#e8e2dc] text-sm font-medium text-[#5c4a42] rounded-full hover:bg-[#f5ede8] transition-colors"
              >
                Choose another date
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.start_at}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setStep("confirm");
                  }}
                  className="bg-white border border-[#e8e2dc] rounded-xl py-3 text-sm font-medium text-[#1a1714] hover:border-[#9b6f6f] hover:bg-[#fdf8f6] hover:text-[#9b6f6f] transition-all"
                >
                  {formatTime(slot.start_at)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CONFIRM ===== */}
      {step === "confirm" && selectedService && selectedDate && selectedSlot && (
        <div>
          <button
            onClick={() => { setStep("slots"); setSelectedSlot(null); }}
            className="flex items-center gap-1.5 text-sm text-[#8a7e78] hover:text-[#9b6f6f] mb-5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Change time
          </button>

          <h2 className="font-display text-2xl text-[#1a1714] mb-6">Confirm your appointment</h2>

          <div className="bg-white rounded-2xl border border-[#e8e2dc] overflow-hidden mb-5">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#f5ede8] to-[#faf9f7] px-6 py-4 border-b border-[#e8e2dc]">
              <p className="text-xs text-[#c9a96e] uppercase tracking-widest font-medium mb-1">Appointment Details</p>
              <p className="font-display text-xl text-[#1a1714]">{selectedService.name}</p>
            </div>
            {/* Details */}
            <div className="px-6 py-5 space-y-4">
              {[
                {
                  icon: (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  ),
                  label: "Stylist",
                  value: stylist.name,
                },
                {
                  icon: (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ),
                  label: "Date",
                  value: formatDate(selectedDate),
                },
                {
                  icon: (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                    </svg>
                  ),
                  label: "Time",
                  value: formatTime(selectedSlot.start_at),
                },
                {
                  icon: (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  label: "Duration",
                  value: formatDuration(selectedService.duration_minutes),
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#f5ede8] flex items-center justify-center text-[#9b6f6f] flex-shrink-0">
                    {row.icon}
                  </div>
                  <div>
                    <p className="text-xs text-[#8a7e78]">{row.label}</p>
                    <p className="text-sm font-medium text-[#1a1714]">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {bookingError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
              {bookingError}
            </div>
          )}

          <p className="text-xs text-[#8a7e78] mb-4 text-center">
            You&apos;ll receive a confirmation once your appointment is approved.
          </p>

          <button
            onClick={handleConfirm}
            disabled={booking}
            className="w-full py-3.5 bg-[#9b6f6f] text-white font-semibold rounded-full hover:bg-[#8a5f5f] disabled:opacity-60 transition-colors text-sm tracking-wide"
          >
            {booking ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Booking…
              </span>
            ) : (
              "Confirm Appointment"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
