import { db } from "@/db";
import { clientLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function getMondayStr(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  if (!clientId) return NextResponse.json([]);

  const weekStart = searchParams.get("weekStart");
  const mondayStr = weekStart ?? getMondayStr(new Date());

  const rows = await db.select().from(clientLogs).where(eq(clientLogs.clientId, clientId));

  const weekLogs = rows.filter(r => r.logDate >= mondayStr);

  return NextResponse.json(weekLogs);
}
