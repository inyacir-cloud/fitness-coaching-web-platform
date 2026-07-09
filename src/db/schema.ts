import { pgTable, serial, text, jsonb, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";

// Clientes
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  monthlyFee: numeric("monthly_fee").notNull().default("0"),
  periodicityDays: integer("periodicity_days").notNull().default(30),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pagos registrados por el coach
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  amount: numeric("amount").notNull(),
  paymentDate: text("payment_date").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Días de entrenamiento de un cliente (lun, mar, etc.)
export const trainingDays = pgTable("training_days", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  dayName: text("day_name").notNull(),
  exercises: jsonb("exercises").$type<Exercise[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

// Dieta general de un cliente
export const clientDiets = pgTable("client_diets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  meals: jsonb("meals").$type<Meal[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

// Logs de entrenamiento diarios del cliente
export const clientLogs = pgTable("client_logs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  trainingDayId: integer("training_day_id").references(() => trainingDays.id).notNull(),
  logDate: text("log_date").notNull(),
  completedSets: jsonb("completed_sets").$type<CompletedSet[]>().notNull().default([]),
  dayCompleted: boolean("day_completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Registro de peso + medidas corporales del cliente
export const bodyProgress = pgTable("body_progress", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  recordDate: text("record_date").notNull(),
  weight: numeric("weight"),
  waist: numeric("waist"),
  hip: numeric("hip"),
  arm: numeric("arm"),
  thigh: numeric("thigh"),
  chest: numeric("chest"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// InBody / composición corporal mensual
export const inbodyRecords = pgTable("inbody_records", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  recordDate: text("record_date").notNull(),
  weight: numeric("weight"),
  bodyFatPercent: numeric("body_fat_percent"),
  muscleMass: numeric("muscle_mass"),
  bmi: numeric("bmi"),
  bodyWaterPercent: numeric("body_water_percent"),
  bmr: numeric("bmr"),
  visceralFat: numeric("visceral_fat"),
  bodyAge: integer("body_age"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---- Types ----
export type Exercise = {
  id: string;
  name: string;
  sets: { reps: string }[];
};

export type Meal = {
  id: string;
  time: string;
  description: string;
};

export type CompletedSet = {
  exerciseId: string;
  setIndex: number;
  weight: string;
  done: boolean;
};
