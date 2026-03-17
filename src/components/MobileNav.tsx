"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

interface Props {
  items: NavItem[];
}

export default function MobileNav({ items }: Props) {
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
        className="p-2 rounded-lg hover:bg-gray-100 transition-all active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Toggle menu"
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
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-10 z-30 w-52 bg-white rounded-xl border shadow-lg py-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 min-h-[44px] flex items-center"
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t mt-2 pt-2">
              <button
                onClick={handleSignOut}
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 min-h-[44px]"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
