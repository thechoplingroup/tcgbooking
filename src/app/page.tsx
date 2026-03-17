import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        {/* Decorative line */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px w-16 bg-[#c9a96e]" />
          <span className="text-[#c9a96e] text-xs tracking-[0.3em] uppercase font-medium">
            Lafayette, Louisiana
          </span>
          <div className="h-px w-16 bg-[#c9a96e]" />
        </div>

        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl text-[#1a1714] mb-4 leading-tight">
          Keri Choplin
        </h1>

        <p className="text-[#8a7e78] text-lg sm:text-xl max-w-md mx-auto mt-4 mb-10 leading-relaxed font-light">
          Expert cuts, color, and treatments — crafted with care, just for you.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/book"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-[#9b6f6f] text-white font-medium rounded-full hover:bg-[#8a5f5f] transition-all active:scale-[0.98] text-sm tracking-wide min-h-[48px]"
          >
            Book an Appointment
          </Link>

        </div>

        {/* Hours teaser */}
        <div className="mt-14 flex items-center gap-2 text-sm text-[#8a7e78]">
          <svg className="w-4 h-4 text-[#c9a96e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
          <span>Open Tuesday – Saturday &nbsp;·&nbsp; 9 AM – 5 PM</span>
        </div>
      </div>

      {/* Services strip */}
      <div className="border-t border-[#e8e2dc] bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              {
                label: "Cuts & Style",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                  </svg>
                ),
              },
              {
                label: "Color & Highlights",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                ),
              },
              {
                label: "Balayage & Ombré",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                ),
              },
              {
                label: "Treatments",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                ),
              },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[#f5ede8] flex items-center justify-center text-[#9b6f6f]">
                  {s.icon}
                </div>
                <span className="text-xs text-[#8a7e78] tracking-wide uppercase">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
