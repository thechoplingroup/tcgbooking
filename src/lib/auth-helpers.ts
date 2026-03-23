/**
 * Shared authentication helpers for API routes
 */

import { createClient } from "@/lib/supabase/server";

export interface AuthContext {
  userId: string;
  stylistId: string;
}

/**
 * Get the stylist ID for the current authenticated user.
 * Returns null if user is not a stylist.
 */
export async function getStylistId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("stylists")
    .select("id")
    .eq("user_id", userId)
    .single();
  return data?.id ?? null;
}

/**
 * Get full auth context including user and stylist IDs.
 * Returns null if user is not authenticated or not a stylist.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const stylistId = await getStylistId(supabase, user.id);
  if (!stylistId) return null;

  return { userId: user.id, stylistId };
}

/**
 * Verify user is authenticated and return supabase client + user.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return null;

  return { supabase, user };
}
