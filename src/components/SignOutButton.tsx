"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  variant?: "button" | "link";
}

export default function SignOutButton({ variant = "button" }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (variant === "link") {
    return (
      <button
        onClick={handleSignOut}
        className="text-xs text-[#8a7e78] hover:text-[#9b6f6f] transition-colors"
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-[#8a7e78] hover:text-[#9b6f6f] transition-colors"
    >
      Sign out
    </button>
  );
}
