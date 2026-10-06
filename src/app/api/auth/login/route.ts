import { NextResponse } from "next/server";
import { AUTH_COOKIE, expectedToken, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const fd = await request.formData();
  const pw = typeof fd.get("password") === "string" ? String(fd.get("password")) : "";
  const next = typeof fd.get("next") === "string" ? String(fd.get("next")) : "/";

  if (!(await verifyPassword(pw))) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "1");
    return NextResponse.redirect(url, 303);
  }
  const res = NextResponse.redirect(new URL(next || "/", request.url), 303);
  res.cookies.set(AUTH_COOKIE, await expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
