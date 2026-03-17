"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface Props {
  pendingCount: number;
}

const PRIMARY_TABS = [
  {
    href: "/admin",
    label: "Schedule",
    exact: true,
    icon: (active: boolean) => (
      <svg className={`w-5 h-5 ${active ? "text-[#9b6f6f]" : "text-[#8a7e78]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/appointments",
    label: "Requests",
    exact: false,
    icon: (active: boolean) => (
      <svg className={`w-5 h-5 ${active ? "text-[#9b6f6f]" : "text-[#8a7e78]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.5}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    href: "/admin/clients",
    label: "Clients",
    exact: false,
    icon: (active: boolean) => (
      <svg className={`w-5 h-5 ${active ? "text-[#9b6f6f]" : "text-[#8a7e78]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/blocked-times",
    label: "Blocked",
    exact: false,
    icon: (active: boolean) => (
      <svg className={`w-5 h-5 ${active ? "text-[#9b6f6f]" : "text-[#8a7e78]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.5}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
];

const MORE_ITEMS = [
  {
    href: "/admin/services",
    label: "Services",
    icon: (
      <svg className="w-5 h-5 text-[#8a7e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/admin/hours",
    label: "Hours",
    icon: (
      <svg className="w-5 h-5 text-[#8a7e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/profile",
    label: "Profile",
    icon: (
      <svg className="w-5 h-5 text-[#8a7e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function AdminBottomNav({ pendingCount }: Props) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* More sheet backdrop */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More sheet */}
      {showMore && (
        <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-50 bg-white border-t border-[#e8e2dc] rounded-t-2xl shadow-xl lg:hidden px-4 pt-4 pb-6">
          <div className="w-10 h-1 bg-[#e8e2dc] rounded-full mx-auto mb-5" />
          <p className="text-[10px] font-semibold text-[#c9a96e] uppercase tracking-widest mb-3 px-1">More</p>
          <div className="space-y-1">
            {MORE_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    active ? "bg-[#f5ede8] text-[#9b6f6f]" : "text-[#1a1714] hover:bg-[#f5f0eb]"
                  }`}
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#9b6f6f]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e8e2dc] lg:hidden">
        <div className="flex items-stretch">
          {PRIMARY_TABS.map((tab) => {
            const active = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href) && !(tab.href === "/admin" && pathname !== "/admin");
            const isRequests = tab.href === "/admin/appointments";

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 relative transition-colors ${
                  active ? "text-[#9b6f6f]" : "text-[#8a7e78]"
                }`}
              >
                <div className="relative">
                  {tab.icon(active)}
                  {isRequests && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 bg-[#d97706] text-white text-[9px] font-bold rounded-full px-1">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-medium tracking-wide ${active ? "text-[#9b6f6f]" : "text-[#8a7e78]"}`}>
                  {tab.label}
                </span>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#9b6f6f] rounded-full" />
                )}
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 relative transition-colors ${
              isMoreActive || showMore ? "text-[#9b6f6f]" : "text-[#8a7e78]"
            }`}
          >
            <svg className={`w-5 h-5 ${isMoreActive || showMore ? "text-[#9b6f6f]" : "text-[#8a7e78]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isMoreActive || showMore ? 2 : 1.5}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className={`text-[9px] font-medium tracking-wide ${isMoreActive || showMore ? "text-[#9b6f6f]" : "text-[#8a7e78]"}`}>
              More
            </span>
            {(isMoreActive || showMore) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#9b6f6f] rounded-full" />
            )}
          </button>
        </div>
        <div className="bg-white" style={{ height: "env(safe-area-inset-bottom)" }} />
      </nav>
    </>
  );
}
