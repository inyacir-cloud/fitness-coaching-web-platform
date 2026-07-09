import { db } from "@/db";
import { clients, clientLogs, bodyProgress, inbodyRecords } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  if (!clientId) return NextResponse.json(null);

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) return NextResponse.json(null);

  const logs = await db
    .select()
    .from(clientLogs)
    .where(eq(clientLogs.clientId, clientId));

  const body = await db
    .select()
    .from(bodyProgress)
    .where(eq(bodyProgress.clientId, clientId))
    .orderBy(desc(bodyProgress.recordDate));

  const inbody = await db
    .select()
    .from(inbodyRecords)
    .where(eq(inbodyRecords.clientId, clientId))
    .orderBy(desc(inbodyRecords.recordDate));

  return NextResponse.json({
    client,
    logs,
    bodyProgress: body,
    inbody: inbody,
  });
}
