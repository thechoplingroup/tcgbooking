import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "https://tcgbooking.vercel.app"), {
    status: 302,
  });
  // Clear cached role cookie
  response.cookies.set("x-user-role", "", { path: "/", maxAge: 0 });
  return response;
}