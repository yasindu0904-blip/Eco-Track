import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(5000),

  WEB_ORIGIN: z
    .string()
    .url("WEB_ORIGIN must be a valid URL")
    .default("http://localhost:5173"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  SUPABASE_URL: z
    .string()
    .url("SUPABASE_URL must be a valid URL"),

  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "SUPABASE_PUBLISHABLE_KEY is required"),

  SUPER_ADMIN_AUTH_USER_ID: z
    .string()
    .trim()
    .default(""),

  SUPER_ADMIN_EMAIL: z
    .string()
    .email("SUPER_ADMIN_EMAIL must be a valid email address")
    .default("superadmin@ecotrack.com"),

  SUPER_ADMIN_FULL_NAME: z
    .string()
    .trim()
    .min(2, "SUPER_ADMIN_FULL_NAME must contain at least 2 characters")
    .default("EcoTrack Super Admin"),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  console.error("Invalid EcoTrack backend environment variables:");

  console.error(
    JSON.stringify(
      parsedEnvironment.error.flatten().fieldErrors,
      null,
      2,
    ),
  );

  process.exit(1);
}

export const env = parsedEnvironment.data;

export type Environment = z.infer<typeof environmentSchema>;