import { z } from "zod";

const fullNameSchema = z.string().trim().min(2).max(120);

const phoneNumberSchema = z
  .string()
  .trim()
  .min(7)
  .max(30)
  .regex(
    /^\+?[0-9][0-9\s()-]*$/,
    "Enter a valid phone number using digits and an optional country code.",
  )
  .transform((phoneNumber) =>
    phoneNumber.replace(/[\s()-]/g, ""),
  )
  .refine(
    (phoneNumber) => /^\+?[0-9]{7,15}$/.test(phoneNumber),
    "Enter a valid phone number with 7 to 15 digits.",
  );

export const completeProfileSchema = z
  .object({
    fullName: fullNameSchema,
    phoneNumber: phoneNumberSchema,
  })
  .strict();

export const updateProfileSchema = completeProfileSchema;
