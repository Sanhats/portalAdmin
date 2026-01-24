import { z } from "zod";

export const expenseSchema = z.object({
  type: z.enum(["alquiler", "servicios", "proveedores", "otros"]),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  date: z.string().or(z.date()).transform((val) => new Date(val)),
  isRecurring: z.boolean().default(false).optional(),
});

export const expenseQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
