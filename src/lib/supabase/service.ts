import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { clientEnv, getServerEnv } from "@/lib/env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _serviceClient: SupabaseClient<any, "public", any> | null = null;

export function createServiceClient() {
  if (!_serviceClient) {
    const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
    _serviceClient = createClient(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return _serviceClient;
}
