import { db } from "@/db";
import { clientDiets, clients, payments, trainingDays, workoutTemplates } from "@/db/schema";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { addDays } from "@/lib/payments";
import { eq } from "drizzle-orm";
import { cloneTemplateMeals, cloneTemplateTrainingDays } from "@/lib/template-utils";

export async function GET() {
  const all = await db.select({
    id: clients.id,
    name: clients.name,
    username: clients.username,
    monthlyFee: clients.monthlyFee,
    periodicityDays: clients.periodicityDays,
    startDate: clients.startDate,
    isActive: clients.isActive,
  }).from(clients).orderBy(clients.id);
  return NextResponse.json(all);
}

export async function POST(req: Request) {
  const { name, username, password, monthlyFee, periodicityDays, startDate, templateId } = await req.json();

  if (!name || !username || !password) {
    return NextResponse.json({ error: "Nombre, usuario y contraseña son obligatorios" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const start = startDate || new Date().toISOString().slice(0, 10);
  const periodDays = periodicityDays ?? 30;
  const fee = monthlyFee ?? 0;

  try {
    const [created] = await db.insert(clients).values({
      name,
      username,
      passwordHash,
      monthlyFee: String(fee),
      periodicityDays: periodDays,
      startDate: start,
      isActive: true,
    }).returning();

    // Registrar el pago inicial automáticamente para activar al cliente desde su fecha de inicio
    if (Number(fee) >= 0) {
      await db.insert(payments).values({
        clientId: created.id,
        amount: String(fee),
        paymentDate: start,
        periodStart: start,
        periodEnd: addDays(start, periodDays),
        notes: "Pago inicial de registro",
      });
    }

    if (templateId) {
      const [template] = await db.select().from(workoutTemplates).where(eq(workoutTemplates.id, Number(templateId)));
      if (template) {
        const trainingSnapshot = cloneTemplateTrainingDays(template.trainingDays ?? []);
        if (trainingSnapshot.length > 0) {
          await db.insert(trainingDays).values(trainingSnapshot.map((day) => ({
            clientId: created.id,
            dayName: day.dayName,
            displayName: day.displayName,
            exercises: day.exercises,
          })));
        }

        const mealsSnapshot = cloneTemplateMeals(template.meals ?? []);
        if (mealsSnapshot.length > 0) {
          await db.insert(clientDiets).values({
            clientId: created.id,
            meals: mealsSnapshot,
          });
        }
      }
    }

    const { passwordHash: _omit, ...safe } = created;
    return NextResponse.json(safe, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    if (message.includes("unique")) {
      return NextResponse.json({ error: "El nombre de usuario ya existe" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
