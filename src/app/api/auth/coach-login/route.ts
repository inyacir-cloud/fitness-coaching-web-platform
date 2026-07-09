/// <reference types="node" />
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signCoachToken } from "@/lib/server-auth";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENV: Record<string, string | undefined> = (globalThis as any).process?.env ?? {};

export async function POST(req: Request) {
  const { username, password } = await req.json();

  const validUser = ENV.COACH_USERNAME || "coach";
  const validPass = ENV.COACH_PASSWORD;

  if (!validPass) {
    console.error("COACH_PASSWORD env var is not set");
    return NextResponse.json({ error: "Configuración del servidor incompleta" }, { status: 500 });
  }

  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
  }

  if (username !== validUser || password !== validPass) {
    return NextResponse.json({ error: "Usuario o contraseña de coach incorrectos" }, { status: 401 });
  }

  const token = await signCoachToken(validUser);

  const cookieStore = await cookies();
  cookieStore.set("emicoach-coach-token", token, {
    httpOnly: true,
    secure: ENV.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  });

  return NextResponse.json({ ok: true, username: validUser, role: "coach" });
}
