import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: stylist } = await supabase
    .from("stylists").select("id").eq("user_id", user.id).single();
  if (!stylist) return NextResponse.json({ clients: [], total: 0, hasMore: false });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q")?.toLowerCase() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  // Use service role to read auth user emails
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Get all distinct clients who have booked with this stylist
  const { data: apptRows, error } = await serviceClient
    .from("appointments")
    .select("client_id, start_at, status")
    .eq("stylist_id", stylist.id)
    .not("client_id", "is", null);

  if (error) {
    console.error("[api/admin/clients GET]", { error: error.message, userId: user.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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

  if (clientMap.size === 0) return NextResponse.json({ clients: [], total: 0, hasMore: false });

  const clientIds = Array.from(clientMap.keys());

  // Get profile data
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, full_name")
    .in("id", clientIds);

  // Get emails from auth.users via admin API
  const emailMap = new Map<string, string>();
  try {
    const { data: usersData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
    for (const u of usersData?.users ?? []) {
      if (u.email) emailMap.set(u.id, u.email);
    }
  } catch { /* emails optional */ }

  // Build + filter full list
  let clients = (profiles ?? [])
    .map((p) => {
      const stats = clientMap.get(p.id)!;
      return {
        id: p.id,
        full_name: p.full_name,
        email: emailMap.get(p.id) ?? null,
        totalAppointments: stats.totalAppointments,
        lastAppointment: stats.lastAppointment,
        firstAppointment: stats.firstAppointment,
      };
    })
    .filter((c) => {
      if (!search) return true;
      return (
        c.full_name?.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => b.lastAppointment.localeCompare(a.lastAppointment));

  const total = clients.length;
  const offset = (page - 1) * limit;
  clients = clients.slice(offset, offset + limit);
  const hasMore = offset + clients.length < total;

  return NextResponse.json({ clients, total, hasMore, page, limit });
}
