import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const env = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

// Para migraciones usamos el transaction pooler sin pgbouncer
const migrationsUrl = (env.DIRECT_URL ?? env.DATABASE_URL ?? "")
  .replace("?pgbouncer=true", "")
  .replace("&pgbouncer=true", "");

if (!migrationsUrl) throw new Error("DIRECT_URL o DATABASE_URL es requerida");

const urlWithSsl = migrationsUrl.includes("sslmode")
  ? migrationsUrl
  : `${migrationsUrl}?sslmode=require`;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url: urlWithSsl },
});
