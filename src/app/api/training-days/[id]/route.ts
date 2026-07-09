import { db } from "@/db";
import { trainingDays, clientLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { dayName, exercises } = await req.json();
  const [updated] = await db.update(trainingDays)
    .set({ dayName, exercises })
    .where(eq(trainingDays.id, Number(id)))
    .returning();

  // Al editar la rutina, invalidar los logs de los clientes para que tengan que hacerla de nuevo
  await db.delete(clientLogs).where(eq(clientLogs.trainingDayId, Number(id)));

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Borrar también logs asociados
  await db.delete(clientLogs).where(eq(clientLogs.trainingDayId, Number(id)));
  await db.delete(trainingDays).where(eq(trainingDays.id, Number(id)));
  return NextResponse.json({ ok: true });
}
