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
      .catch(() => setError("Failed to load stylists"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-400">Loading stylists…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (stylists.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg">No stylists are available yet.</p>
        <p className="text-sm mt-1">Check back soon.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Our Stylists</h1>
      <p className="text-sm text-gray-500 mb-6">
        Choose a stylist to view their services and book an appointment.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stylists.map((s) => (
          <Link
            key={s.id}
            href={`/book/${s.id}`}
            className="block border rounded-xl p-5 hover:border-blue-400 hover:shadow-sm transition-all bg-white"
          >
            <div className="flex items-start gap-4">
              {s.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.avatar_url}
                  alt={s.name}
                  className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-semibold text-gray-500">
                    {s.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{s.name}</p>
                {s.bio && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{s.bio}</p>
                )}
                {s.services.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.services.slice(0, 3).map((svc) => (
                      <span
                        key={svc.id}
                        className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5"
                      >
                        {svc.name}
                      </span>
                    ))}
                    {s.services.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{s.services.length - 3} more
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-2">No services listed</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
