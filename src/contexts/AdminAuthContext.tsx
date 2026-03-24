"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface AdminAuthCtx {
  userId: string | null;
  stylistId: string | null;
  ready: boolean;
}

const AdminAuthContext = createContext<AdminAuthCtx>({
  userId: null,
  stylistId: null,
  ready: false,
});

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<AdminAuthCtx>({
    userId: null,
    stylistId: null,
    ready: false,
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setCtx({ userId: null, stylistId: null, ready: true });
        return;
      }
      supabase
        .from("stylists")
        .select("id")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          setCtx({ userId: user.id, stylistId: data?.id ?? null, ready: true });
        });
    });
  }, []);

  return (
    <AdminAuthContext.Provider value={ctx}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
