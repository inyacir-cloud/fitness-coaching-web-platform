import { db } from "@/db";
import { workoutTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(workoutTemplates).where(eq(workoutTemplates.id, Number(id)));
  return NextResponse.json({ ok: true });
}