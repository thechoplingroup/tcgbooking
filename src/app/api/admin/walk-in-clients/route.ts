import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStylistId } from "@/lib/auth-helpers";
import { z } from "zod";

// Validation schema for walk-in client creation
const WalkInClientSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100, "Name too long"),
  phone: z.string().max(30, "Phone too long").optional().nullable(),
  email: z.string().email("Invalid email").max(255, "Email too long").optional().nullable().or(z.literal("")),
  notes: z.string().max(5000, "Notes too long").optional().nullable(),
});

// Sanitize search input to prevent SQL injection in ilike patterns
function sanitizeSearch(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
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
    const sanitized = sanitizeSearch(search);
    query = query.or(`full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = WalkInClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues.map((e) => ({ path: e.path.join("."), message: e.message })) },
      { status: 400 }
    );
  }

  const { full_name, phone, email, notes } = parsed.data;

  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("walk_in_clients")
    .insert({
      stylist_id: stylistId,
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/admin/walk-in-clients POST]", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ client: data }, { status: 201 });
}
