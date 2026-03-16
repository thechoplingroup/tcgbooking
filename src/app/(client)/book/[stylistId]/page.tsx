"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
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

// Generate next N days as YYYY-MM-DD strings (UTC)
function getUpcomingDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

export default function StylistBookingPage() {
  const params = useParams();
  const router = useRouter();
  const stylistId = params.stylistId as string;

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

  const upcomingDays = getUpcomingDays(14);

  useEffect(() => {
    fetch(`/api/stylists/${stylistId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setStylist(data.stylist);
      })
      .catch(() => setError("Failed to load stylist"))
      .finally(() => setLoading(false));
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
        setBookingError(data.error ?? "Booking failed");
      } else {
        setStep("done");
      }
    } catch {
      setBookingError("Network error. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!stylist) return null;

  return (
    <div className="max-w-lg">
      {/* Stylist header */}
      <div className="flex items-center gap-4 mb-6">
        {stylist.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={stylist.avatar_url}
            alt={stylist.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-2xl font-semibold text-gray-500">
              {stylist.name.charAt(0)}
            </span>
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">{stylist.name}</h1>
          {stylist.bio && <p className="text-sm text-gray-500 mt-0.5">{stylist.bio}</p>}
        </div>
      </div>

      {/* Step: done */}
      {step === "done" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-green-700 font-semibold text-lg">Booking confirmed!</p>
          <p className="text-green-600 text-sm mt-1">
            Your appointment with {stylist.name} is pending confirmation.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {selectedService?.name} on {selectedDate ? formatDate(selectedDate) : ""} at{" "}
            {selectedSlot ? formatTime(selectedSlot.start_at) : ""}
          </p>
          <div className="flex justify-center gap-3 mt-5">
            <button
              onClick={() => router.push("/appointments")}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
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
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
            >
              Book another
            </button>
          </div>
        </div>
      )}

      {/* Step: select service */}
      {step === "service" && (
        <div>
          <h2 className="text-base font-semibold mb-3">Select a service</h2>
          {stylist.services.length === 0 ? (
            <p className="text-sm text-gray-400">No services available.</p>
          ) : (
            <div className="space-y-2">
              {stylist.services.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => {
                    setSelectedService(svc);
                    setStep("date");
                  }}
                  className="w-full text-left border rounded-lg px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <span className="font-medium text-sm">{svc.name}</span>
                  <span className="ml-3 text-xs text-gray-400">
                    {svc.duration_minutes} min
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step: select date */}
      {step === "date" && selectedService && (
        <div>
          <button
            onClick={() => { setStep("service"); setSelectedService(null); }}
            className="text-xs text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1"
          >
            ← Back
          </button>
          <h2 className="text-base font-semibold mb-1">Select a date</h2>
          <p className="text-sm text-gray-500 mb-3">
            Service: <span className="font-medium text-gray-700">{selectedService.name}</span>{" "}
            ({selectedService.duration_minutes} min)
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {upcomingDays.map((d) => {
              const [y, m, day] = d.split("-").map(Number);
              const dateObj = new Date(Date.UTC(y!, m! - 1, day!));
              const weekday = dateObj.toLocaleDateString([], { weekday: "short", timeZone: "UTC" });
              const monthDay = dateObj.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
              return (
                <button
                  key={d}
                  onClick={() => handleSelectDate(d)}
                  className="border rounded-lg py-3 text-center hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <p className="text-xs text-gray-400">{weekday}</p>
                  <p className="text-sm font-medium">{monthDay}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step: select slot */}
      {step === "slots" && selectedService && selectedDate && (
        <div>
          <button
            onClick={() => { setStep("date"); setSelectedDate(null); setSlots([]); }}
            className="text-xs text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1"
          >
            ← Back
          </button>
          <h2 className="text-base font-semibold mb-1">Select a time</h2>
          <p className="text-sm text-gray-500 mb-3">{formatDate(selectedDate)}</p>

          {slotsLoading ? (
            <p className="text-sm text-gray-400">Loading availability…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-400">No available times on this day. Please pick another date.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.start_at}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setStep("confirm");
                  }}
                  className="border rounded-lg py-2.5 text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  {formatTime(slot.start_at)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step: confirm */}
      {step === "confirm" && selectedService && selectedDate && selectedSlot && (
        <div>
          <button
            onClick={() => { setStep("slots"); setSelectedSlot(null); }}
            className="text-xs text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1"
          >
            ← Back
          </button>
          <h2 className="text-base font-semibold mb-4">Confirm your booking</h2>
          <div className="bg-gray-50 border rounded-xl p-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Stylist</span>
              <span className="font-medium">{stylist.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Service</span>
              <span className="font-medium">{selectedService.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Duration</span>
              <span className="font-medium">{selectedService.duration_minutes} min</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-medium">{formatDate(selectedDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time</span>
              <span className="font-medium">{formatTime(selectedSlot.start_at)}</span>
            </div>
          </div>

          {bookingError && (
            <p className="text-sm text-red-500 mt-3">{bookingError}</p>
          )}

          <button
            onClick={handleConfirm}
            disabled={booking}
            className="mt-4 w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {booking ? "Booking…" : "Confirm Booking"}
          </button>
        </div>
      )}
    </div>
  );
}
