import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: stylist } = await supabase
    .from("stylists").select("id").eq("user_id", user.id).single();
  if (!stylist) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { final_price_cents?: number; discount_cents?: number; discount_note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const updateFields: Record<string, unknown> = {};
  if (body.final_price_cents !== undefined) updateFields.final_price_cents = body.final_price_cents;
  if (body.discount_cents !== undefined) updateFields.discount_cents = body.discount_cents;
  if (body.discount_note !== undefined) updateFields.discount_note = body.discount_note || null;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("appointments")
    .update(updateFields)
    .eq("id", params.id)
    .eq("stylist_id", stylist.id)
    .select()
    .single();

  if (error) {
    console.error("[api/admin/appointments/[id]/pricing PATCH]", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointment: data });
}
