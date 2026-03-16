import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const { data: stylist, error } = await supabase
    .from("stylists")
    .select("id, name, bio, avatar_url")
    .eq("id", params.id)
    .single();

  if (error || !stylist) {
    return NextResponse.json({ error: "Stylist not found" }, { status: 404 });
  }

  const { data: services, error: svcError } = await supabase
    .from("services")
    .select("id, stylist_id, name, duration_minutes, is_active")
    .eq("stylist_id", params.id)
    .eq("is_active", true)
    .order("name");

  if (svcError) {
    return NextResponse.json({ error: svcError.message }, { status: 500 });
  }

  return NextResponse.json({ stylist: { ...stylist, services: services ?? [] } });
}
