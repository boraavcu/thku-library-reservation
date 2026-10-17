import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req) {
  const host = req.headers.get("host") || "";

  // Sadece admin paneli domaininden gelen isteklerde yetki kontrolü uygula
  if (host.includes("panel.library.thk.edu.tr")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const role = token.role;
    if (!["ADMIN", "LIBRARIAN", "SUPER_ADMIN"].includes(role)) {
      const userPanelUrl = process.env.FRONTEND_URL || "https://library.thk.edu.tr";
      return NextResponse.redirect(userPanelUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};