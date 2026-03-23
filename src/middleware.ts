import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Always allow signout, auth routes, and account deletion API
  if (
    pathname.startsWith("/api/signout") ||
    pathname.startsWith("/api/account") ||
    pathname.startsWith("/auth/")
  ) {
    return supabaseResponse;
  }

  // ─── Admin API routes: inject auth headers ─────────────────────────────────
  if (pathname.startsWith("/api/admin")) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch stylist ID using the authenticated session
    const { data: stylistData } = await supabase
      .from("stylists")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const stylistId = stylistData?.id ?? null;

    if (!stylistId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Inject user/stylist IDs into request headers for the API route
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-stylist-id", stylistId);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Unauthenticated — redirect to login
  if (!user) {
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/book") ||
      pathname.startsWith("/appointments") ||
      pathname === "/account"
    ) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // Check role for authenticated users
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  // Stylists → always go to /admin, redirect away from client pages
  if (role === "stylist") {
    if (pathname === "/login" || pathname === "/") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (pathname.startsWith("/book") || pathname.startsWith("/appointments")) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  // Clients should not access admin
  if (role === "client" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/book", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/book/:path*",
    "/appointments/:path*",
    "/account",
    "/login",
    "/",
    "/api/:path*",
  ],
};
