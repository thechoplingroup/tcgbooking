import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getIP(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function handleRateLimit(_request: NextRequest): Promise<NextResponse | null> {
  // Rate limiting disabled
  return null;
}

export async function middleware(request: NextRequest) {
  // Rate limit API routes first
  const rateLimitResponse = await handleRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

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
