export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-lg">TCG Booking</span>
        <a href="/login" className="text-sm text-gray-600 hover:underline">
          Sign in
        </a>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
