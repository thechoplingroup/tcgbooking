import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-6">
      <h1 className="text-4xl font-bold tracking-tight">TCG Booking</h1>
      <p className="text-gray-500 text-lg">
        Salon appointment booking, simplified.
      </p>
      <div className="flex gap-4">
        <Link
          href="/book"
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 h-9 text-sm font-medium transition-colors hover:opacity-90"
        >
          Book an Appointment
        </Link>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 h-9 text-sm font-medium transition-colors hover:bg-muted"
        >
          Admin Dashboard
        </Link>
      </div>
    </div>
  );
}
