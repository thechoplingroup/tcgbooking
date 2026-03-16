import Link from "next/link";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b px-6 py-3 flex items-center justify-between">
        <Link href="/book" className="font-semibold text-lg">
          TCG Booking
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/book" className="text-sm text-gray-600 hover:text-gray-900">
            Stylists
          </Link>
          <Link href="/appointments" className="text-sm text-gray-600 hover:text-gray-900">
            My Appointments
          </Link>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
