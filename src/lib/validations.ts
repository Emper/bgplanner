import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().email("Email no válido"),
});

export const otpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "El código debe tener 6 dígitos"),
});

export const profileSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  surname: z.string().min(1, "Los apellidos son obligatorios"),
  location: z.string().optional(),
  bggUsername: z.string().optional(),
});

export const groupSchema = z.object({
  name: z.string().min(1, "El nombre del grupo es obligatorio").max(100),
});

export const inviteSchema = z.object({
  email: z.string().email("Email no válido"),
});

export const addGameSchema = z.object({
  bggId: z.number().int().positive(),
});

export const voteSchema = z.object({
  type: z.enum(["up", "super", "down"]),
});
