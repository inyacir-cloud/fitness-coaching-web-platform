import type { Exercise, Meal, TemplateTrainingDay } from "@/db/schema";

function cloneExercise(exercise: Exercise, sessionIdMap: Map<string, string>) {
  const nextSessionId = exercise.sessionId
    ? (sessionIdMap.get(exercise.sessionId) ?? (() => {
        const created = crypto.randomUUID();
        sessionIdMap.set(exercise.sessionId!, created);
        return created;
      })())
    : undefined;

  return {
    ...exercise,
    id: crypto.randomUUID(),
    sessionId: nextSessionId,
    sets: exercise.sets.map((set) => ({ ...set })),
  };
}

export function cloneTemplateTrainingDays(trainingDays: TemplateTrainingDay[]): TemplateTrainingDay[] {
  const sessionIdMap = new Map<string, string>();
  return trainingDays.map((day) => ({
    dayName: day.dayName,
    displayName: day.displayName,
    exercises: day.exercises.map((exercise) => cloneExercise(exercise, sessionIdMap)),
  }));
}

export function cloneTemplateMeals(meals: Meal[]): Meal[] {
  return meals.map((meal) => ({
    ...meal,
    id: crypto.randomUUID(),
  }));
}

export function sanitizeTemplateTrainingDays(trainingDays: TemplateTrainingDay[]): TemplateTrainingDay[] {
  return trainingDays.map((day) => ({
    dayName: day.dayName,
    displayName: day.displayName,
    exercises: day.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set })),
    })),
  }));
}

export function sanitizeTemplateMeals(meals: Meal[]): Meal[] {
  return meals.map((meal) => ({ ...meal }));
}