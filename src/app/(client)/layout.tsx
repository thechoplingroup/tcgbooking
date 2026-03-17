import Link from "next/link";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Navigation */}
      <nav className="bg-white border-b border-[#e8e2dc] sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/book" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f5ede8] to-[#e8d8d0] flex items-center justify-center border border-[#e8e2dc]">
              <span className="font-display text-[#9b6f6f] text-sm font-semibold">K</span>
            </div>
            <div className="leading-tight">
              <p className="font-display text-[#1a1714] text-base font-semibold leading-none">Keri Choplin</p>
              <p className="text-[10px] text-[#c9a96e] tracking-widest uppercase leading-tight">Lafayette, LA</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/appointments"
              className="text-sm text-[#8a7e78] hover:text-[#9b6f6f] font-medium transition-colors hidden sm:block"
            >
              My Appointments
            </Link>
            <Link
              href="/book"
              className="inline-flex items-center px-4 py-2 bg-[#9b6f6f] text-white text-sm font-medium rounded-full hover:bg-[#8a5f5f] transition-colors"
            >
              Book Now
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">{children}</main>

      {/* Footer */}
      <footer className="border-t border-[#e8e2dc] bg-white mt-16">
        <div className="max-w-2xl mx-auto px-6 py-8 text-center">
          <p className="font-display text-[#1a1714] text-lg mb-1">Keri Choplin</p>
          <p className="text-sm text-[#8a7e78]">Tue – Sat &nbsp;·&nbsp; 9 AM – 5 PM &nbsp;·&nbsp; Lafayette, Louisiana</p>
        </div>
      </footer>
    </div>
  );
}
