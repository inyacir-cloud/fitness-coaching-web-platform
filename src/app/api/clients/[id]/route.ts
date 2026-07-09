import { db } from "@/db";
import { clients, clientLogs, trainingDays, clientDiets, bodyProgress, inbodyRecords, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, username, monthlyFee, periodicityDays, newPassword, isActive } = await req.json();

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (username !== undefined) updateData.username = username;
  if (monthlyFee !== undefined) updateData.monthlyFee = String(monthlyFee);
  if (periodicityDays !== undefined) updateData.periodicityDays = periodicityDays;
  if (newPassword) updateData.passwordHash = await bcrypt.hash(newPassword, 10);
  if (isActive !== undefined) updateData.isActive = isActive;

  const [updated] = await db.update(clients)
    .set(updateData)
    .where(eq(clients.id, Number(id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  const { passwordHash: _omit, ...safe } = updated;
  return NextResponse.json(safe);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);

  await Promise.all([
    db.delete(clientLogs).where(eq(clientLogs.clientId, clientId)),
    db.delete(trainingDays).where(eq(trainingDays.clientId, clientId)),
    db.delete(clientDiets).where(eq(clientDiets.clientId, clientId)),
    db.delete(bodyProgress).where(eq(bodyProgress.clientId, clientId)),
    db.delete(inbodyRecords).where(eq(inbodyRecords.clientId, clientId)),
    db.delete(payments).where(eq(payments.clientId, clientId)),
  ]);

  await db.delete(clients).where(eq(clients.id, clientId));
  return NextResponse.json({ ok: true });
}
