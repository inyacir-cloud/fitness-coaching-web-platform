import { db } from "@/db";
import { trainingDays } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = Number(searchParams.get("clientId"));
    if (!clientId) return NextResponse.json([]);
    const rows = await db.select().from(trainingDays).where(eq(trainingDays.clientId, clientId));
    return NextResponse.json(rows ?? []);
  } catch (error) {
    console.error("Error fetching training days:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: Request) {
  const { clientId, dayName, displayName, exercises } = await req.json();
  const [created] = await db.insert(trainingDays)
    .values({ clientId, dayName, displayName, exercises: exercises ?? [] })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
