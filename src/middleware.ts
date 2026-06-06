import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/webhooks/",
  "/manifest.json",
];

// Pages/API prefixes allowed for LIMITED role users
const LIMITED_ALLOWED = [
  "/inventory",
  "/finances",
  "/dashboard",
  "/api/inventory",
  "/api/finances",
  "/api/auth",
  "/api/push",
  "/_next",
  "/favicon",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-touch-icon") ||
    pathname.startsWith("/sw.js")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("rb_session")?.value;
  const session = sessionCookie ? await verifySession(sessionCookie) : null;

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Restrict LIMITED users to their allowed sections
  if (session.role === "LIMITED") {
    const allowed = LIMITED_ALLOWED.some((p) => pathname.startsWith(p));
    if (!allowed) {
      const inventoryUrl = req.nextUrl.clone();
      inventoryUrl.pathname = "/inventory";
      return NextResponse.redirect(inventoryUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|apple-touch-icon\\.png|sw\\.js|manifest\\.json).*)"],
};
