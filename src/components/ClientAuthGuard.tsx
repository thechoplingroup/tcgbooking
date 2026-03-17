"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * ClientAuthGuard — listens for Supabase auth state changes.
 * When the session expires (SIGNED_OUT event), redirects to /login
 * instead of failing silently.
 *
 * Mount this in admin and client layouts.
 */
export default function ClientAuthGuard() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
