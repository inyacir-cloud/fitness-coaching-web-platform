import { type NextRequest, NextResponse } from "next/server";
import { verifyCoachToken } from "@/lib/server-auth";

const COACH_ONLY: string[] = ["/api/clients", "/api/payments"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isCoachRoute = COACH_ONLY.some((prefix) => pathname.startsWith(prefix));
  if (!isCoachRoute) return NextResponse.next();

  const token = req.cookies.get("emicoach-coach-token")?.value;
  if (!token || !(await verifyCoachToken(token))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/clients/:path*", "/api/payments/:path*"],
};
