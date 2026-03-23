import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import ClientsPageClient from "./ClientsPageClient";
import type { ClientRow } from "@/types/clients";

const PAGE_LIMIT = 20;

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase
    .from("stylists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!stylist) {
    return (
      <ClientsPageClient
        initialClients={[]}
        initialTotal={0}
        initialHasMore={false}
      />
    );
  }

  const serviceClient = createServiceClient();

  // Get all distinct clients who have booked with this stylist
  const { data: apptRows } = await serviceClient
    .from("appointments")
    .select("client_id, start_at, status")
    .eq("stylist_id", stylist.id)
    .not("client_id", "is", null);

  // Aggregate per client
  const clientMap = new Map<string, {
    totalAppointments: number;
    lastAppointment: string;
    firstAppointment: string;
  }>();

  for (const row of apptRows ?? []) {
    const cid = row.client_id as string;
    const existing = clientMap.get(cid);
    if (!existing) {
      clientMap.set(cid, {
        totalAppointments: 1,
        lastAppointment: row.start_at as string,
        firstAppointment: row.start_at as string,
      });
    } else {
      existing.totalAppointments++;
      if (row.start_at > existing.lastAppointment) existing.lastAppointment = row.start_at as string;
      if (row.start_at < existing.firstAppointment) existing.firstAppointment = row.start_at as string;
    }
  }

  const clientIds = clientMap.size > 0 ? Array.from(clientMap.keys()) : [];

  // Get profile data and walk-in clients in parallel
  const [profilesResult, walkInsResult] = await Promise.all([
    clientIds.length > 0
      ? serviceClient.from("profiles").select("id, full_name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    serviceClient
      .from("walk_in_clients")
      .select("id, full_name, phone, email, created_at")
      .eq("stylist_id", stylist.id),
  ]);

  const profiles = profilesResult.data ?? [];

  // Build auth client list
  const authClients: ClientRow[] = profiles.map((p) => {
    const stats = clientMap.get(p.id);
    return {
      id: p.id,
      full_name: p.full_name,
      email: null,
      totalAppointments: stats?.totalAppointments ?? 0,
      lastAppointment: stats?.lastAppointment ?? "",
      clientType: "auth" as const,
    };
  });

  // Walk-in clients
  const walkIns = walkInsResult.data ?? [];
  const walkInIds = walkIns.map((w) => w.id);

  const walkInLogMap = new Map<string, { count: number; lastDate: string }>();
  if (walkInIds.length > 0) {
    const { data: logRows } = await serviceClient
      .from("client_service_log")
      .select("walk_in_client_id, visit_date")
      .eq("stylist_id", stylist.id)
      .in("walk_in_client_id", walkInIds);
    for (const row of logRows ?? []) {
      const wid = row.walk_in_client_id as string;
      const existing = walkInLogMap.get(wid);
      if (!existing) {
        walkInLogMap.set(wid, { count: 1, lastDate: row.visit_date as string });
      } else {
        existing.count++;
        if ((row.visit_date as string) > existing.lastDate) existing.lastDate = row.visit_date as string;
      }
    }
  }

  const walkInClients: ClientRow[] = walkIns.map((w) => {
    const stats = walkInLogMap.get(w.id);
    return {
      id: w.id,
      full_name: w.full_name,
      email: w.email ?? null,
      totalAppointments: stats?.count ?? 0,
      lastAppointment: stats?.lastDate ?? w.created_at,
      clientType: "walkin" as const,
    };
  });

  // Merge and sort
  const allClients = [...authClients, ...walkInClients].sort(
    (a, b) => b.lastAppointment.localeCompare(a.lastAppointment)
  );

  const total = allClients.length;
  const paginatedClients = allClients.slice(0, PAGE_LIMIT);
  const hasMore = total > PAGE_LIMIT;

  // Fetch emails for paginated auth clients
  const authClientIds = paginatedClients
    .filter((c) => c.clientType === "auth")
    .map((c) => c.id);

  if (authClientIds.length > 0) {
    const emailResults = await Promise.all(
      authClientIds.map((id) =>
        serviceClient.auth.admin.getUserById(id).then(
          ({ data }) => ({ id, email: data?.user?.email ?? null }),
          () => ({ id, email: null })
        )
      )
    );
    const emailMap = new Map(emailResults.map((r) => [r.id, r.email]));
    for (const c of paginatedClients) {
      if (c.clientType === "auth") {
        c.email = emailMap.get(c.id) ?? null;
      }
    }
  }

  return (
    <ClientsPageClient
      initialClients={paginatedClients}
      initialTotal={total}
      initialHasMore={hasMore}
    />
  );
}
