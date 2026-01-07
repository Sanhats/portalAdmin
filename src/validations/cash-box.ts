import { z } from "zod";

/**
 * SPRINT B1: Validaciones para sistema de contabilidad operativa (cajas diarias)
 */

// Esquema para abrir una caja
export const openCashBoxSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe estar en formato YYYY-MM-DD")
    .or(z.date())
    .transform((val) => {
      if (typeof val === "string") {
        return new Date(val + "T00:00:00");
      }
      return val;
    }),
  openingBalance: z.union([
    z.string().min(1, "El saldo inicial es requerido").regex(/^-?\d+(\.\d{1,2})?$/, "El saldo inicial debe ser un número válido"),
    z.number()
  ]).transform((val) => {
    if (typeof val === "string") {
      return parseFloat(val);
    }
    return val;
  }).refine((val) => val >= 0, {
    message: "El saldo inicial no puede ser negativo"
  }),
});

// Esquema para crear un movimiento manual
export const createCashMovementSchema = z.object({
  type: z.enum(["income", "expense"], {
    errorMap: () => ({ message: "El tipo debe ser: income o expense" })
  }),
  amount: z.union([
    z.string().min(1, "El monto es requerido").regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser un número válido"),
    z.number().positive("El monto debe ser positivo")
  ]).transform((val) => {
    if (typeof val === "string") {
      return parseFloat(val);
    }
    return val;
  }),
  paymentMethod: z.enum(["cash", "transfer"], {
    errorMap: () => ({ message: "El método de pago debe ser: cash o transfer" })
  }),
  reference: z.string()
    .max(255, "La referencia no puede exceder 255 caracteres")
    .optional()
    .nullable(),
});

// Esquema para cerrar una caja (no requiere body, solo el ID en la URL)
export const closeCashBoxSchema = z.object({}).optional(); // Body vacío o sin body
