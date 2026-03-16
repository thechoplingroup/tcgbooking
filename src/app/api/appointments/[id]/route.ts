import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only allow cancellation; client cannot change to other statuses
  const { data: existing } = await supabase
    .from("appointments")
    .select("id, client_id, status, start_at")
    .eq("id", params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (existing.client_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.status === "cancelled") {
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", params.id)
    .select("id, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appointment: data });
}
