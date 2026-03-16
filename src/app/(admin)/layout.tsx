export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-lg">TCG Booking — Admin</span>
        <span className="text-sm text-gray-500">Dashboard</span>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
