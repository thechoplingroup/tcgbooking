import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminContext } from "@/lib/supabase/admin-auth";
import { z } from "zod";
import { log } from "@/lib/logger";

// Validation schema for walk-in client creation
const WalkInClientSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100, "Name too long"),
  phone: z.string().max(30, "Phone too long").optional().nullable(),
  email: z.string().email("Invalid email").max(255, "Email too long").optional().nullable().or(z.literal("")),
  notes: z.string().max(5000, "Notes too long").optional().nullable(),
  linked_to_profile_id: z.string().uuid("Invalid profile id").optional().nullable(),
});

// Sanitize search input to prevent SQL injection in ilike patterns
function sanitizeSearch(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

export async function GET(request: Request) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stylistId } = ctx;

  const serviceClient = createServiceClient();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q")?.toLowerCase() ?? "";
  const linkedTo = searchParams.get("linked_to"); // filter dependents for a specific profile

  let query = serviceClient
    .from("walk_in_clients")
    .select("*")
    .eq("stylist_id", stylistId)
    .is("merged_into_profile_id", null)
    .order("created_at", { ascending: false });

  if (linkedTo) {
    query = query.eq("linked_to_profile_id", linkedTo);
  } else {
    // By default, exclude dependents from the main walk-in list
    // (they appear under their parent's profile instead)
    query = query.is("linked_to_profile_id", null);
  }

  if (search) {
    const sanitized = sanitizeSearch(search);
    query = query.or(`full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
  }

  const { data, error } = await query;

  if (error) {
    log.error("api/admin/walk-in-clients GET", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: data ?? [] });
}

export async function PATCH(request: Request) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stylistId } = ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, full_name, phone, email, notes } = body as {
    id: string;
    full_name?: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
  };

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name.trim();
  if (phone !== undefined) updates.phone = phone?.trim() || null;
  if (email !== undefined) updates.email = email?.trim() || null;
  if (notes !== undefined) updates.notes = notes?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("walk_in_clients")
    .update(updates)
    .eq("id", id)
    .eq("stylist_id", stylistId)
    .select()
    .single();

  if (error) {
    log.error("api/admin/walk-in-clients PATCH", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ client: data });
}

export async function POST(request: Request) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { stylistId } = ctx;

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

  const { full_name, phone, email, notes, linked_to_profile_id } = parsed.data;

  const serviceClient = createServiceClient();
  const cleanEmail = email?.trim() || null;

  // Check if a registered account exists with this email — non-blocking warning
  let emailWarning: string | null = null;
  if (cleanEmail) {
    try {
      const { data: exists } = await serviceClient.rpc("check_email_registered", { p_email: cleanEmail });
      if (exists) {
        emailWarning = "A registered account with this email already exists. You can merge them later from the Clients page.";
      }
    } catch {
      // Non-blocking — skip warning if check fails
    }
  }

  const { data, error } = await serviceClient
    .from("walk_in_clients")
    .insert({
      stylist_id: stylistId,
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      email: cleanEmail,
      notes: notes?.trim() || null,
      linked_to_profile_id: linked_to_profile_id ?? null,
    })
    .select()
    .single();

  if (error) {
    log.error("api/admin/walk-in-clients POST", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ client: data, warning: emailWarning }, { status: 201 });
}
