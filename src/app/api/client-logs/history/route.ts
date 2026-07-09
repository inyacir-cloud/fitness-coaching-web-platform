import { db } from "@/db";
import { clientLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  const trainingDayId = Number(searchParams.get("trainingDayId"));

  if (!clientId || !trainingDayId) {
    return NextResponse.json({ error: "clientId y trainingDayId requeridos" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(clientLogs)
    .where(eq(clientLogs.clientId, clientId))
    .orderBy(desc(clientLogs.logDate));

  // Filter in memory by trainingDayId (keep all logs for that day)
  const filtered = rows.filter(r => r.trainingDayId === trainingDayId);

  // Map to simplified: [{ logDate, completedSets, dayCompleted }]
  return NextResponse.json(filtered);
}
