"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ClientNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-[#e8e2dc] sticky top-0 z-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/book" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center border border-[#e8e2dc] flex-shrink-0">
            <span className="font-display text-[#9b6f6f] text-sm font-semibold">K</span>
          </div>
          <div className="leading-tight min-w-0 hidden xs:block">
            <p className="font-display text-[#1a1714] text-base font-semibold leading-none truncate">Keri Choplin</p>
            <p className="text-[10px] text-[#c9a96e] tracking-widest uppercase leading-tight">Lafayette, LA</p>
          </div>
        </Link>

        {/* Right side nav */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Appointments — text on sm+, icon on mobile */}
          <Link
            href="/appointments"
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
              pathname === "/appointments"
                ? "text-[#9b6f6f] bg-[#f5ede8]"
                : "text-[#8a7e78] hover:text-[#9b6f6f] hover:bg-[#faf9f7]"
            }`}
            aria-label="My appointments"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Appointments</span>
          </Link>

          {/* Account icon */}
          <Link
            href="/account"
            className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all active:scale-95 ${
              pathname === "/account"
                ? "text-[#9b6f6f] bg-[#f5ede8]"
                : "text-[#8a7e78] hover:text-[#9b6f6f] hover:bg-[#faf9f7]"
            }`}
            aria-label="Account"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>

          {/* Book CTA */}
          <Link
            href="/book"
            className="inline-flex items-center px-4 py-2.5 bg-[#9b6f6f] text-white text-sm font-semibold rounded-full hover:bg-[#8a5f5f] active:bg-[#7a5050] active:scale-[0.98] transition-all min-h-[44px] ml-1"
          >
            Book
          </Link>
        </div>
      </div>
    </nav>
  );
}
