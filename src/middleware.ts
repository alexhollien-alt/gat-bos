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

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");

  // Portal-scoped public routes: redeem handler + per-slug login page.
  // Slice 7C: agent portal sessions are separate from Alex's account session;
  // these endpoints must be reachable without a session to bootstrap one.
  const isPortalPublic =
    pathname === "/portal/redeem" ||
    pathname.startsWith("/portal/redeem/") ||
    /^\/portal\/[^/]+\/login(?:\/|$)/.test(pathname);

  const isPortalRoute = pathname.startsWith("/portal/");

  const isPublicRoute =
    pathname.startsWith("/api/") ||
    pathname.startsWith("/intake") ||
    pathname.startsWith("/agents/") ||
    isPortalPublic;

  if (isPublicRoute) {
    return supabaseResponse;
  }

  // Authed portal routes: redirect to slug-scoped login on no session.
  // requirePortalSession enforces the email/slug binding inside the layout;
  // middleware only enforces presence of any Supabase session.
  if (isPortalRoute && !user) {
    const slugMatch = pathname.match(/^\/portal\/([^/]+)/);
    const slug = slugMatch?.[1];
    const url = request.nextUrl.clone();
    url.pathname = slug ? `/portal/${slug}/login` : "/login";
    return NextResponse.redirect(url);
  }

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
