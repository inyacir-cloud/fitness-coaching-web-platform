import { db } from "@/db";
import { clients, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { computePaidUntil, getPaymentStatus } from "@/lib/payments";

export async function POST(req: Request) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
  }

  const [client] = await db.select().from(clients).where(eq(clients.username, username));
  if (!client) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  const match = await bcrypt.compare(password, client.passwordHash);
  if (!match) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  const clientPayments = await db.select().from(payments).where(eq(payments.clientId, client.id));
  const paidUntil = computePaidUntil(clientPayments);
  const status = getPaymentStatus(paidUntil);

  return NextResponse.json({
    id: client.id,
    name: client.name,
    username: client.username,
    status,
    paidUntil,
    isActive: client.isActive,
  });
}
