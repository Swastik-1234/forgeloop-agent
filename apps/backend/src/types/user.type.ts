import { z } from "zod";

export const registerUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type RegisterUserSchema = z.infer<typeof registerUserSchema>;

export const loginUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type LoginUserSchema = z.infer<typeof loginUserSchema>;
