import { z } from "zod";

/**
 * Validated environment variables.
 * Lazy-evaluated to avoid crashing during build when env vars aren't set.
 */

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

let _clientEnv: z.infer<typeof clientEnvSchema> | null = null;

export const clientEnv = new Proxy({} as z.infer<typeof clientEnvSchema>, {
  get(_target, prop: string) {
    if (!_clientEnv) {
      _clientEnv = clientEnvSchema.parse({
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      });
    }
    return _clientEnv[prop as keyof typeof _clientEnv];
  },
});

/**
 * Server-only env vars. Only import this in server code.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

let _serverEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  if (!_serverEnv) {
    _serverEnv = serverEnvSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  }
  return _serverEnv;
}
