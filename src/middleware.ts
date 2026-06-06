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
  "/orders",
  "/products",
  "/dashboard",
  "/api/inventory",
  "/api/finances",
  "/api/shopify/orders",
  "/api/shopify/products",
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

  if (!sessionCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Admin — cookie equals ADMIN_PASSWORD
  const adminPwd = process.env.ADMIN_PASSWORD;
  if (adminPwd && sessionCookie === adminPwd) {
    return NextResponse.next();
  }

  // Demo — direct cookie value, LIMITED access
  if (sessionCookie === "demo-access") {
    const allowed = LIMITED_ALLOWED.some((p) => pathname.startsWith(p));
    if (!allowed) {
      const inventoryUrl = req.nextUrl.clone();
      inventoryUrl.pathname = "/inventory";
      return NextResponse.redirect(inventoryUrl);
    }
    return NextResponse.next();
  }

  // JWT session (staff users)
  const session = await verifySession(sessionCookie).catch(() => null);
  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

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
