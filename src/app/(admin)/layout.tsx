import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminMobileNav from "@/components/AdminMobileNav";
import AdminSignOutButton from "@/components/AdminSignOutButton";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/admin/appointments",
    label: "Appointments",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/services",
    label: "Services",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/admin/hours",
    label: "Hours",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/blocked-times",
    label: "Blocked Times",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  {
    href: "/admin/profile",
    label: "My Profile",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

async function getPendingCount() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;
    const { data: stylist } = await supabase
      .from("stylists").select("id").eq("user_id", user.id).single();
    if (!stylist) return 0;
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("stylist_id", stylist.id)
      .eq("status", "pending")
      .gte("start_at", new Date().toISOString());
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pendingCount = await getPendingCount();

  const navItemsWithBadge = NAV_ITEMS.map((item) => ({
    ...item,
    badge: item.href === "/admin/appointments" && pendingCount > 0 ? pendingCount : 0,
  }));

  return (
    <div className="min-h-screen bg-[#f5f0eb]">
      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3.5 bg-[#1a1714] border-b border-[#2a2320]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#c9a96e] flex items-center justify-center">
            <span className="text-[#1a1714] text-xs font-bold">K</span>
          </div>
          <div className="leading-tight">
            <p className="text-white text-sm font-semibold leading-none font-display">
              Studio
            </p>
            <p className="text-[#c9a96e] text-[9px] tracking-widest uppercase leading-tight">
              Dashboard
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Link href="/admin/appointments" className="relative">
              <span className="flex items-center justify-center w-6 h-6 bg-[#c9a96e] text-[#1a1714] text-xs font-bold rounded-full">
                {pendingCount}
              </span>
            </Link>
          )}
          <AdminMobileNav items={navItemsWithBadge} />
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 bg-[#1a1714] flex-col min-h-screen sticky top-0">
          {/* Logo */}
          <div className="px-6 py-6 border-b border-[#2a2320]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#c9a96e] flex items-center justify-center">
                <span className="text-[#1a1714] text-sm font-bold">K</span>
              </div>
              <div>
                <p className="text-white font-semibold text-base leading-none font-display">
                  Keri Choplin
                </p>
                <p className="text-[#c9a96e] text-[10px] tracking-widest uppercase leading-tight mt-0.5">
                  Hair Studio
                </p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-4 px-3">
            {navItemsWithBadge.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#a89e96] hover:text-white hover:bg-[#2a2320] transition-colors mb-0.5 group"
              >
                <span className="text-[#6b5e56] group-hover:text-[#c9a96e] transition-colors">
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
                {item.badge > 0 && (
                  <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 bg-[#c9a96e] text-[#1a1714] text-xs font-bold rounded-full px-1.5">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Bottom links */}
          <div className="px-6 py-5 border-t border-[#2a2320] space-y-3">
            <Link
              href="/book"
              className="flex items-center gap-2 text-xs text-[#6b5e56] hover:text-[#c9a96e] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View booking page
            </Link>
            <AdminSignOutButton />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
