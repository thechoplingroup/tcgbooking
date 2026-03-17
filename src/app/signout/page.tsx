"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.signOut().then(() => {
      router.push("/login");
      router.refresh();
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
      <p className="text-[#8a7e78] text-sm">Signing out…</p>
    </div>
  );
}
