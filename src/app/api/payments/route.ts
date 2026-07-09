import { db } from "@/db";
import { payments, clients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { addDays, computePaidUntil, todayISO } from "@/lib/payments";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  if (!clientId) return NextResponse.json([]);

  const rows = await db.select().from(payments).where(eq(payments.clientId, clientId)).orderBy(desc(payments.paymentDate));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { clientId, amount, paymentDate, notes } = await req.json();
  if (!clientId || amount === undefined) {
    return NextResponse.json({ error: "clientId y amount son requeridos" }, { status: 400 });
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const existingPayments = await db.select().from(payments).where(eq(payments.clientId, clientId));
  const paidUntil = computePaidUntil(existingPayments);
  const today = paymentDate || todayISO();

  // El nuevo periodo empieza donde terminó el anterior si aún no vence, si no, empieza hoy
  const periodStart = paidUntil && paidUntil >= today ? paidUntil : today;
  const periodEnd = addDays(periodStart, client.periodicityDays);

  const [created] = await db.insert(payments).values({
    clientId,
    amount: String(amount),
    paymentDate: today,
    periodStart,
    periodEnd,
    notes: notes ?? null,
  }).returning();

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(payments).where(eq(payments.id, id));
  return NextResponse.json({ ok: true });
}
