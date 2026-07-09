import { db } from "@/db";
import { clientDiets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET: obtener la dieta general de un cliente
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  if (!clientId) return NextResponse.json(null);

  const [diet] = await db.select().from(clientDiets).where(eq(clientDiets.clientId, clientId));
  return NextResponse.json(diet ?? null);
}

// POST: crear o actualizar la dieta general de un cliente (upsert)
export async function POST(req: Request) {
  const { clientId, meals } = await req.json();

  const [existing] = await db.select().from(clientDiets).where(eq(clientDiets.clientId, clientId));

  if (existing) {
    const [updated] = await db.update(clientDiets)
      .set({ meals })
      .where(eq(clientDiets.id, existing.id))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db.insert(clientDiets)
    .values({ clientId, meals: meals ?? [] })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
