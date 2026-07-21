import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum([
      "development",
      "test",
      "production",
    ])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(5000),

  WEB_ORIGIN: z.string().url(),

  DATABASE_URL: z.string().min(1),

  SUPABASE_URL: z.string().url(),

  SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1),
});

const result = envSchema.safeParse(
  process.env,
);

if (!result.success) {
  console.error(
    "Invalid backend environment variables:",
  );

  console.error(
    result.error.flatten().fieldErrors,
  );

  throw new Error(
    "Backend environment configuration is invalid",
  );
}

export const env = result.data;