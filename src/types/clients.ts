/**
 * Shared client type definitions
 */

export interface ClientRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  totalAppointments: number;
  lastAppointment: string;
  firstAppointment?: string;
  clientType: "auth" | "walkin";
}

export interface ClientDetail {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  created_at: string;
  clientType?: "auth" | "walkin";
}

export interface ClientStats {
  totalAppointments: number;
  totalConfirmed: number;
  firstBooking: string | null;
}

export interface ServiceLogEntry {
  id: string;
  service_name: string;
  price_cents: number;
  visit_date: string;
  notes: string | null;
  service_id: string | null;
}

export interface AppointmentRow {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  final_price_cents?: number | null;
  discount_cents?: number | null;
  discount_note?: string | null;
  service?: { id: string; name: string; duration_minutes: number } | null;
}
