import { db } from "@/db";
import { bodyProgress } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  if (!clientId) return NextResponse.json([]);

  const rows = await db
    .select()
    .from(bodyProgress)
    .where(eq(bodyProgress.clientId, clientId))
    .orderBy(desc(bodyProgress.recordDate));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { clientId, recordDate, weight, waist, hip, arm, thigh, chest, notes } = body;
  const [created] = await db
    .insert(bodyProgress)
    .values({
      clientId,
      recordDate,
      weight: weight ?? null,
      waist: waist ?? null,
      hip: hip ?? null,
      arm: arm ?? null,
      thigh: thigh ?? null,
      chest: chest ?? null,
      notes: notes ?? null,
    })
    .returning();
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(bodyProgress).where(eq(bodyProgress.id, id));
  return NextResponse.json({ ok: true });
}
