import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Navigation */}
      <nav className="bg-white border-b border-[#e8e2dc] sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#9b6f6f] flex items-center justify-center">
              <span className="text-white text-xs font-semibold">K</span>
            </div>
            <div className="leading-tight">
              <p className="font-display text-[#1a1714] text-base font-semibold leading-none">Keri Choplin</p>
              <p className="text-[10px] text-[#c9a96e] tracking-widest uppercase leading-tight">Hair Studio</p>
            </div>
          </Link>

          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/book"
              className="text-sm text-[#5c4a42] hover:text-[#9b6f6f] transition-colors hidden sm:block"
            >
              Services
            </Link>
            <Link
              href="/appointments"
              className="text-sm text-[#5c4a42] hover:text-[#9b6f6f] transition-colors hidden sm:block"
            >
              My Appointments
            </Link>
            {user ? (
              <SignOutButton />
            ) : (
              <Link
                href="/login"
                className="text-sm text-[#9b6f6f] hover:text-[#8a5f5f] font-medium"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/book"
              className="hidden sm:inline-flex items-center px-4 py-2 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-colors"
            >
              Book Now
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">{children}</main>

      {/* Footer */}
      <footer className="border-t border-[#e8e2dc] bg-white mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-display text-[#1a1714] text-base">Keri Choplin Hair Studio</p>
          <p className="text-sm text-[#8a7e78]">
            Tue–Sat &nbsp;·&nbsp; 9 AM – 6 PM &nbsp;·&nbsp; Lafayette, LA
          </p>
          <Link
            href="/book"
            className="text-sm text-[#9b6f6f] hover:underline font-medium"
          >
            Book an appointment →
          </Link>
        </div>
      </footer>
    </div>
  );
}
