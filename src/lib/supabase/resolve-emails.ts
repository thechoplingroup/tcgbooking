import { createServiceClient } from "@/lib/supabase/service";

/**
 * Resolve email addresses for a list of auth user IDs.
 * Uses batched getUserById instead of listUsers to avoid fetching the entire user table.
 */
export async function resolveEmails(clientIds: string[]): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  if (clientIds.length === 0) return emailMap;

  const unique = Array.from(new Set(clientIds));
  const serviceClient = createServiceClient();

  const results = await Promise.allSettled(
    unique.map((id) => serviceClient.auth.admin.getUserById(id))
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.data?.user?.email) {
      emailMap.set(result.value.data.user.id, result.value.data.user.email);
    }
  }

  return emailMap;
}
