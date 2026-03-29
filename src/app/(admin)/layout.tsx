import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminSignOutButton from "@/components/AdminSignOutButton";
import AdminBottomNav from "@/components/AdminBottomNav";
import { ToastProvider } from "@/components/Toast";
import ClientAuthGuard from "@/components/ClientAuthGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import PendingBanner from "@/components/PendingBanner";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { STUDIO } from "@/config/studio";

function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-9 bg-[#f0ebe6] rounded-lg w-48 mb-2" />
      <div className="h-4 bg-[#f0ebe6] rounded w-64 mb-6" />
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5">
          <div className="flex gap-4">
            <div className="w-14">
              <div className="h-5 bg-[#f0ebe6] rounded w-10 mx-auto mb-1" />
              <div className="h-3 bg-[#f0ebe6] rounded w-8 mx-auto" />
            </div>
            <div className="flex-1">
              <div className="h-4 bg-[#f0ebe6] rounded w-32 mb-2" />
              <div className="h-3 bg-[#f0ebe6] rounded w-24" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5">
          <div className="flex gap-4">
            <div className="w-14">
              <div className="h-5 bg-[#f0ebe6] rounded w-10 mx-auto mb-1" />
              <div className="h-3 bg-[#f0ebe6] rounded w-8 mx-auto" />
            </div>
            <div className="flex-1">
              <div className="h-4 bg-[#f0ebe6] rounded w-40 mb-2" />
              <div className="h-3 bg-[#f0ebe6] rounded w-28" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8e2dc] p-5">
          <div className="flex gap-4">
            <div className="w-14">
              <div className="h-5 bg-[#f0ebe6] rounded w-10 mx-auto mb-1" />
              <div className="h-3 bg-[#f0ebe6] rounded w-8 mx-auto" />
            </div>
            <div className="flex-1">
              <div className="h-4 bg-[#f0ebe6] rounded w-36 mb-2" />
              <div className="h-3 bg-[#f0ebe6] rounded w-20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV_MAIN = [
  {
    href: "/admin",
    label: "Schedule",
    exact: true,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/requests",
    label: "Requests",
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    href: "/admin/appointments",
    label: "Appointments",
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: "/admin/clients",
    label: "Clients",
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/waitlist",
    label: "Waitlist",
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/blocked-times",
    label: "Blocked Times",
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
];

const NAV_SETTINGS = [
  {
    href: "/admin/analytics",
    label: "Analytics",
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/admin/services",
    label: "Services",
    exact: false,
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
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/profile",
    label: "Profile",
    exact: false,
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

  return (
    <ToastProvider>
    <AdminAuthProvider>
    <ClientAuthGuard />
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3.5 bg-white border-b border-[#e8e2dc] sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center border border-[#e8e2dc]">
            <span className="font-display text-[#9b6f6f] text-sm font-semibold">K</span>
          </div>
          <div className="leading-tight">
            <p className="font-display text-[#1a1714] text-base font-semibold leading-none">
              {STUDIO.ownerName}
            </p>
            <p className="text-[#c9a96e] text-[9px] tracking-widest uppercase leading-tight">
              Studio Dashboard
            </p>
          </div>
        </div>
        {pendingCount > 0 && (
          <Link href="/admin/requests" prefetch={false} className="relative flex items-center gap-1.5 bg-[#fffbeb] border border-[#fcd34d] text-[#d97706] text-xs font-semibold rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d97706] animate-pulse" />
            {pendingCount} pending
          </Link>
        )}
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 bg-[#1a1714] flex-col min-h-screen sticky top-0">
          <div className="px-6 py-6 border-b border-[#2a2320]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center">
                <span className="font-display text-[#9b6f6f] text-lg font-semibold">K</span>
              </div>
              <div>
                <p className="text-white font-semibold text-base leading-none font-display">
                  {STUDIO.ownerName}
                </p>
                <p className="text-[#c9a96e] text-[10px] tracking-widest uppercase leading-tight mt-0.5">
                  Hair Studio
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 py-4 px-3 overflow-y-auto">
            {NAV_MAIN.map((item) => {
              const isRequests = item.href === "/admin/requests";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#a89e96] hover:text-white hover:bg-[#2a2320] transition-colors mb-0.5 group"
                >
                  <span className="text-[#6b5e56] group-hover:text-[#c9a96e] transition-colors">
                    {item.icon}
                  </span>
                  <span className="text-sm font-medium">{item.label}</span>
                  {isRequests && pendingCount > 0 && (
                    <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 bg-[#d97706] text-white text-xs font-bold rounded-full px-1.5">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="mt-4 mb-1 px-3">
              <p className="text-[10px] font-semibold text-[#4a3d37] uppercase tracking-widest">Settings</p>
            </div>
            {NAV_SETTINGS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#a89e96] hover:text-white hover:bg-[#2a2320] transition-colors mb-0.5 group"
              >
                <span className="text-[#6b5e56] group-hover:text-[#c9a96e] transition-colors">
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

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

        {/* Main content — with bottom padding for mobile nav */}
        <div className="flex-1 min-w-0 flex flex-col">
          <PendingBanner />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto pb-24 lg:pb-8 max-w-6xl">
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                {children}
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Mobile bottom tab nav */}
      <AdminBottomNav pendingCount={pendingCount} />
    </div>
    </AdminAuthProvider>
    </ToastProvider>
  );
}
