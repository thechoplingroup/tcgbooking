import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col">
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
          <span className="block text-[#9b6f6f] italic text-4xl sm:text-5xl md:text-6xl mt-1">
            Hair Studio
          </span>
        </h1>

        <p className="text-[#8a7e78] text-lg sm:text-xl max-w-md mx-auto mt-4 mb-10 leading-relaxed font-light">
          Expert cuts, color, and treatments — crafted with care, just for you.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/book"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-[#9b6f6f] text-white font-medium rounded-full hover:bg-[#8a5f5f] transition-colors text-sm tracking-wide"
          >
            Book an Appointment
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center px-8 py-3.5 border border-[#e8e2dc] text-[#5c4a42] font-medium rounded-full hover:bg-[#f5ede8] transition-colors text-sm tracking-wide bg-white"
          >
            Studio Dashboard
          </Link>
        </div>

        {/* Hours teaser */}
        <div className="mt-14 flex items-center gap-2 text-sm text-[#8a7e78]">
          <svg className="w-4 h-4 text-[#c9a96e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
          <span>Open Tuesday – Saturday &nbsp;·&nbsp; 9 AM – 6 PM</span>
        </div>
      </div>

      {/* Services strip */}
      <div className="border-t border-[#e8e2dc] bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { label: "Cuts & Style", icon: "✂️" },
              { label: "Color & Highlights", icon: "🎨" },
              { label: "Balayage & Ombré", icon: "✨" },
              { label: "Treatments", icon: "💆‍♀️" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2">
                <span className="text-2xl">{s.icon}</span>
                <span className="text-xs text-[#8a7e78] tracking-wide uppercase">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
