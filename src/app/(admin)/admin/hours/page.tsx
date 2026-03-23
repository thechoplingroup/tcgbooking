import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import HoursPageClient from "./HoursPageClient";

export default async function HoursPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase
    .from("stylists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!stylist) {
    return <HoursPageClient initialHours={[]} initialOverrides={[]} />;
  }

  const serviceClient = createServiceClient();

  // Fetch hours and overrides in parallel
  const [hoursResult, overridesResult] = await Promise.all([
    serviceClient
      .from("operational_hours")
      .select("*")
      .eq("stylist_id", stylist.id)
      .order("day_of_week"),
    serviceClient
      .from("operational_hours_overrides")
      .select("*")
      .eq("stylist_id", stylist.id)
      .order("effective_from"),
  ]);

  return (
    <HoursPageClient
      initialHours={hoursResult.data ?? []}
      initialOverrides={overridesResult.data ?? []}
    />
  );
}
