"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

const SERVICE_CATEGORIES: Record<string, string[]> = {
  "Hair Services": [
    "Women's Haircut & Style",
    "Men's Haircut",
    "Children's Haircut",
    "Blowout",
    "Trim & Style",
    "Bang Trim",
  ],
  "Color Services": [
    "Single Process Color",
    "Color Retouch",
    "Full Highlights",
    "Partial Highlights",
    "Balayage",
    "Ombre/Sombre",
    "Gloss/Toner",
    "Color Correction (Consultation Required)",
  ],
  "Treatments": [
    "Deep Conditioning Treatment",
    "Keratin Smoothing Treatment",
    "Olaplex Treatment",
    "Scalp Treatment",
  ],
  "Styling & Special Events": [
    "Updo/Special Occasion Style",
    "Bridal Hair",
    "Blowout + Waves",
  ],
};

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function BookPage() {
  const [stylists, setStylists] = useState<PublicStylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stylists")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setStylists(data.stylists ?? []);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#9b6f6f] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-[#8a7e78]">
        <p>Unable to load at this time. Please try again.</p>
      </div>
    );
  }

  if (stylists.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="font-display text-2xl text-[#1a1714] mb-2">Coming Soon</p>
        <p className="text-[#8a7e78]">Booking will be available shortly. Check back soon.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-px w-12 bg-[#c9a96e]" />
          <span className="text-[#c9a96e] text-xs tracking-[0.25em] uppercase">Book Online</span>
          <div className="h-px w-12 bg-[#c9a96e]" />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-[#1a1714] mb-3">
          Our Services
        </h1>
        <p className="text-[#8a7e78] text-lg max-w-lg mx-auto font-light">
          Choose your stylist and service to get started. Available Tuesday through Saturday.
        </p>
      </div>

      {stylists.map((stylist) => {
        // Group services by category
        const servicesByCategory: Record<string, PublicService[]> = {};
        const uncategorized: PublicService[] = [];

        stylist.services.forEach((svc) => {
          let found = false;
          for (const [cat, names] of Object.entries(SERVICE_CATEGORIES)) {
            if (names.some((n) => svc.name.toLowerCase().includes(n.toLowerCase().split(" ")[0]!))) {
              if (!servicesByCategory[cat]) servicesByCategory[cat] = [];
              servicesByCategory[cat]!.push(svc);
              found = true;
              break;
            }
          }
          if (!found) uncategorized.push(svc);
        });

        if (uncategorized.length > 0) {
          servicesByCategory["Other"] = uncategorized;
        }

        return (
          <div key={stylist.id}>
            {/* Stylist card */}
            <div className="bg-white rounded-2xl border border-[#e8e2dc] p-6 sm:p-8 mb-8 flex flex-col sm:flex-row gap-6 items-start">
              {stylist.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stylist.avatar_url}
                  alt={stylist.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#e8e2dc] flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center flex-shrink-0 border-2 border-[#e8e2dc]">
                  <span className="text-3xl font-display text-[#9b6f6f]">
                    {stylist.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <h2 className="font-display text-2xl text-[#1a1714] mb-1">{stylist.name}</h2>
                {stylist.bio && (
                  <p className="text-[#8a7e78] text-sm leading-relaxed mb-4">{stylist.bio}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {Object.keys(servicesByCategory).map((cat) => (
                    <span
                      key={cat}
                      className="text-xs px-3 py-1 bg-[#f5ede8] text-[#9b6f6f] rounded-full"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Service menu by category */}
            {Object.entries(SERVICE_CATEGORIES).map(([category]) => {
              const catServices = servicesByCategory[category];
              if (!catServices || catServices.length === 0) return null;

              return (
                <div key={category} className="mb-8">
                  <h3 className="font-display text-xl text-[#1a1714] mb-4 pb-2 border-b border-[#e8e2dc]">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {catServices.map((svc) => (
                      <Link
                        key={svc.id}
                        href={`/book/${stylist.id}?serviceId=${svc.id}`}
                        className="group bg-white rounded-xl border border-[#e8e2dc] px-5 py-4 hover:border-[#9b6f6f] hover:shadow-sm transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-[#1a1714] text-sm group-hover:text-[#9b6f6f] transition-colors">
                            {svc.name}
                          </p>
                          <p className="text-xs text-[#8a7e78] mt-0.5">{formatDuration(svc.duration_minutes)}</p>
                        </div>
                        <svg
                          className="w-4 h-4 text-[#c9a96e] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-3"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}

            {servicesByCategory["Other"] && servicesByCategory["Other"].length > 0 && (
              <div className="mb-8">
                <h3 className="font-display text-xl text-[#1a1714] mb-4 pb-2 border-b border-[#e8e2dc]">
                  Other Services
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {servicesByCategory["Other"]!.map((svc) => (
                    <Link
                      key={svc.id}
                      href={`/book/${stylist.id}?serviceId=${svc.id}`}
                      className="group bg-white rounded-xl border border-[#e8e2dc] px-5 py-4 hover:border-[#9b6f6f] hover:shadow-sm transition-all flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-[#1a1714] text-sm group-hover:text-[#9b6f6f] transition-colors">
                          {svc.name}
                        </p>
                        <p className="text-xs text-[#8a7e78] mt-0.5">{formatDuration(svc.duration_minutes)}</p>
                      </div>
                      <svg
                        className="w-4 h-4 text-[#c9a96e] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-3"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="mt-6 mb-12 bg-gradient-to-r from-[#f5ede8] to-[#faf9f7] rounded-2xl p-6 sm:p-8 text-center border border-[#e8d8d0]">
              <p className="font-display text-xl text-[#1a1714] mb-2">Ready to book?</p>
              <p className="text-[#8a7e78] text-sm mb-4">Select any service above to choose your date and time.</p>
              <Link
                href={`/book/${stylist.id}`}
                className="inline-flex items-center px-6 py-2.5 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-colors"
              >
                See All Available Times
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
