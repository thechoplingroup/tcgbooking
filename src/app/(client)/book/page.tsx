import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BookPage() {
  const supabase = await createClient();
  const { data: stylists } = await supabase
    .from("stylists")
    .select("id")
    .limit(1);

  const stylistId = stylists?.[0]?.id;
  if (stylistId) {
    redirect(`/book/${stylistId}`);
  }

  return (
    <div className="text-center py-20 text-[#8a7e78]">
      No stylists available at this time.
    </div>
  );
}
