import { db } from "@/db";
import { workoutTemplates } from "@/db/schema";
import { sanitizeTemplateMeals, sanitizeTemplateTrainingDays } from "@/lib/template-utils";
import { NextResponse } from "next/server";

export async function GET() {
  const templates = await db.select().from(workoutTemplates).orderBy(workoutTemplates.id);
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const { name, description, trainingDays, meals } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre de la plantilla es obligatorio" }, { status: 400 });
  }

  const [created] = await db.insert(workoutTemplates).values({
    name: name.trim(),
    description: description?.trim() || null,
    trainingDays: sanitizeTemplateTrainingDays(Array.isArray(trainingDays) ? trainingDays : []),
    meals: sanitizeTemplateMeals(Array.isArray(meals) ? meals : []),
  }).returning();

  return NextResponse.json(created, { status: 201 });
}