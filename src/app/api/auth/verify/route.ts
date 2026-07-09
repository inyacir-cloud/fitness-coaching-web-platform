import { db } from "@/db";
import { clients, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { computePaidUntil, getPaymentStatus } from "@/lib/payments";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const clientPayments = await db.select().from(payments).where(eq(payments.clientId, client.id));
  const paidUntil = computePaidUntil(clientPayments);
  const status = getPaymentStatus(paidUntil);

  return NextResponse.json({
    id: client.id,
    name: client.name,
    username: client.username,
    status,
    paidUntil,
    monthlyFee: client.monthlyFee,
    isActive: client.isActive,
  });
}
