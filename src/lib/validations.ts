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

export const createEventSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(200),
  description: z.string().max(2000).optional(),
  date: z.string().min(1, "La fecha es obligatoria"),
  endDate: z.string().optional(),
  location: z.string().max(300).optional(),
  maxAttendees: z.number().int().positive().optional(),
  visibility: z.enum(["public", "private"]).default("public"),
  imageUrl: z.string().nullable().optional(),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  date: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  maxAttendees: z.number().int().positive().nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  imageUrl: z.string().nullable().optional(),
});

export const eventInterestSchema = z.object({
  eventGameId: z.string().min(1),
  intensity: z.number().int().min(1).max(5),
  notes: z.string().max(500).optional(),
});
