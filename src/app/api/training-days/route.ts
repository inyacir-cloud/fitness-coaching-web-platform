import { db } from "@/db";
import { trainingDays } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  if (!clientId) return NextResponse.json([]);
  const rows = await db.select().from(trainingDays).where(eq(trainingDays.clientId, clientId));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { clientId, dayName, exercises } = await req.json();
  const [created] = await db.insert(trainingDays)
    .values({ clientId, dayName, exercises: exercises ?? [] })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
