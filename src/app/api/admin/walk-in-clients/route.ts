import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

async function getStylistId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("stylists")
    .select("id")
    .eq("user_id", userId)
    .single();
  return data?.id ?? null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stylistId = await getStylistId(supabase, user.id);
  if (!stylistId) return NextResponse.json({ clients: [] });

  const serviceClient = createServiceClient();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q")?.toLowerCase() ?? "";

  let query = serviceClient
    .from("walk_in_clients")
    .select("*")
    .eq("stylist_id", stylistId)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[api/admin/walk-in-clients GET]", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stylistId = await getStylistId(supabase, user.id);
  if (!stylistId) return NextResponse.json({ error: "Create your profile first." }, { status: 400 });

  let body: { full_name?: string; phone?: string; email?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fullName = body.full_name?.trim();
  if (!fullName) return NextResponse.json({ error: "full_name is required" }, { status: 400 });

  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("walk_in_clients")
    .insert({
      stylist_id: stylistId,
      full_name: fullName,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/admin/walk-in-clients POST]", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ client: data }, { status: 201 });
}
