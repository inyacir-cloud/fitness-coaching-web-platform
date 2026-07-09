import { db } from "@/db";
import { inbodyRecords } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  if (!clientId) return NextResponse.json([]);

  const rows = await db
    .select()
    .from(inbodyRecords)
    .where(eq(inbodyRecords.clientId, clientId))
    .orderBy(desc(inbodyRecords.recordDate));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    clientId,
    recordDate,
    weight,
    bodyFatPercent,
    muscleMass,
    bmi,
    bodyWaterPercent,
    bmr,
    visceralFat,
    bodyAge,
    notes,
  } = body;

  const [created] = await db
    .insert(inbodyRecords)
    .values({
      clientId,
      recordDate,
      weight: weight ?? null,
      bodyFatPercent: bodyFatPercent ?? null,
      muscleMass: muscleMass ?? null,
      bmi: bmi ?? null,
      bodyWaterPercent: bodyWaterPercent ?? null,
      bmr: bmr ?? null,
      visceralFat: visceralFat ?? null,
      bodyAge: bodyAge ?? null,
      notes: notes ?? null,
    })
    .returning();
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.delete(inbodyRecords).where(eq(inbodyRecords.id, id));
  return NextResponse.json({ ok: true });
}
