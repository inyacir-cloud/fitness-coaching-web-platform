import { db } from "@/db";
import { clientLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  const trainingDayId = Number(searchParams.get("trainingDayId"));
  const logDate = searchParams.get("logDate");

  if (!clientId || !trainingDayId || !logDate) return NextResponse.json(null);

  const [log] = await db.select().from(clientLogs).where(
    and(
      eq(clientLogs.clientId, clientId),
      eq(clientLogs.trainingDayId, trainingDayId),
      eq(clientLogs.logDate, logDate)
    )
  );
  return NextResponse.json(log ?? null);
}

export async function POST(req: Request) {
  const { clientId, trainingDayId, logDate, completedSets, dayCompleted } = await req.json();

  // Upsert: si ya existe, actualizar
  const [existing] = await db.select().from(clientLogs).where(
    and(
      eq(clientLogs.clientId, clientId),
      eq(clientLogs.trainingDayId, trainingDayId),
      eq(clientLogs.logDate, logDate)
    )
  );

  if (existing) {
    const [updated] = await db.update(clientLogs)
      .set({ completedSets, dayCompleted })
      .where(eq(clientLogs.id, existing.id))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db.insert(clientLogs)
    .values({ clientId, trainingDayId, logDate, completedSets: completedSets ?? [], dayCompleted: dayCompleted ?? false })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
