"use client";

import Link from "next/link";
import QuickBlockSheet from "@/components/QuickBlockSheet";

export default function DashboardQuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 mb-5">
      <QuickBlockSheet />
      <Link
        href="/admin/services"
        className="flex items-center gap-2 bg-white border border-[#e8e2dc] rounded-xl px-3 py-3 text-sm font-medium text-[#5c4a42] hover:border-[#9b6f6f] hover:bg-[#fdf8f6] active:scale-[0.98] transition-all min-h-[48px]"
      >
        <div className="w-7 h-7 rounded-lg bg-[#f5ede8] flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-[#9b6f6f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        Manage Services
      </Link>
    </div>
  );
}
