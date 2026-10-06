import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authDisabled, expectedToken, AUTH_COOKIE } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  if (authDisabled()) return NextResponse.next();
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await expectedToken())) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
