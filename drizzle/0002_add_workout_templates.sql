CREATE TABLE IF NOT EXISTS "workout_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "training_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "meals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now()
);