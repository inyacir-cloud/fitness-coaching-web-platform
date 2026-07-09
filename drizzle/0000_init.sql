CREATE TABLE "body_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"record_date" text NOT NULL,
	"weight" numeric,
	"waist" numeric,
	"hip" numeric,
	"arm" numeric,
	"thigh" numeric,
	"chest" numeric,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_diets" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"meals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"training_day_id" integer NOT NULL,
	"log_date" text NOT NULL,
	"completed_sets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"day_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"monthly_fee" numeric DEFAULT '0' NOT NULL,
	"periodicity_days" integer DEFAULT 30 NOT NULL,
	"start_date" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "clients_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "inbody_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"record_date" text NOT NULL,
	"weight" numeric,
	"body_fat_percent" numeric,
	"muscle_mass" numeric,
	"bmi" numeric,
	"body_water_percent" numeric,
	"bmr" numeric,
	"visceral_fat" numeric,
	"body_age" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"amount" numeric NOT NULL,
	"payment_date" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "training_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"day_name" text NOT NULL,
	"exercises" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "body_progress" ADD CONSTRAINT "body_progress_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_diets" ADD CONSTRAINT "client_diets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_logs" ADD CONSTRAINT "client_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_logs" ADD CONSTRAINT "client_logs_training_day_id_training_days_id_fk" FOREIGN KEY ("training_day_id") REFERENCES "public"."training_days"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbody_records" ADD CONSTRAINT "inbody_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_days" ADD CONSTRAINT "training_days_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;