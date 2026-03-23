import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { z } from "zod";

// Validation schema for notes
const NotesSchema = z.object({
  notes: z.string().max(10000, "Notes cannot exceed 10,000 characters").nullable(),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = NotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues.map((e) => ({ path: e.path.join("."), message: e.message })) },
      { status: 400 }
    );
  }

  const { notes } = parsed.data;

  const serviceClient = createServiceClient();

  // Upsert — one notes row per stylist+client
  const { data, error } = await serviceClient
    .from("stylist_client_notes")
    .upsert(
      {
        stylist_id: stylist.id,
        client_id: params.id,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stylist_id,client_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data });
}
