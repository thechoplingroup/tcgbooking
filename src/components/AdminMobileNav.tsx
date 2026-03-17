"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface Props {
  items: NavItem[];
}

export default function AdminMobileNav({ items }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-[#2a2320] transition-colors text-white"
        aria-label="Menu"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-60 bg-[#1a1714] rounded-2xl border border-[#2a2320] shadow-2xl py-2 overflow-hidden">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-[#a89e96] hover:text-white hover:bg-[#2a2320] transition-colors"
              >
                <span className="text-[#6b5e56]">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 bg-[#c9a96e] text-[#1a1714] text-xs font-bold rounded-full px-1.5">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            ))}
            <div className="border-t border-[#2a2320] mt-2 pt-2">
              <Link
                href="/book"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-[#6b5e56] hover:text-[#c9a96e] text-xs transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View booking page
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-2.5 text-[#6b5e56] hover:text-[#a89e96] text-xs transition-colors w-full"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
