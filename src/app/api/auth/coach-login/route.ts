/// <reference types="node" />
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signCoachToken } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { username, password } = await req.json();

  const validUser = process.env.COACH_USERNAME?.trim() || "coach";
  const validPass = process.env.COACH_PASSWORD?.trim();

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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  });

  return NextResponse.json({ ok: true, username: validUser, role: "coach" });
}
