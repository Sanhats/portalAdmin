import { z } from "zod";

// SPRINT B: Esquema para crear intención de pago
export const createPaymentIntentSchema = z.object({
  saleId: z.string()
    .uuid("El saleId debe ser un UUID válido"),
  amount: z.union([
    z.string().min(1, "El monto es requerido").regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser un número válido"),
    z.number().positive("El monto debe ser positivo")
  ]),
  gateway: z.string()
    .min(1, "El gateway es requerido")
    .max(50, "El gateway no puede exceder 50 caracteres"),
  expiresAt: z.string()
    .datetime("La fecha de expiración debe ser una fecha válida")
    .optional()
    .nullable(),
  externalReference: z.string()
    .max(255, "La referencia externa no puede exceder 255 caracteres")
    .optional()
    .nullable(),
  gatewayMetadata: z.record(z.any())
    .optional()
    .nullable(),
});

// Esquema para actualizar intención de pago
export const updatePaymentIntentSchema = z.object({
  status: z.enum(["created", "processing", "completed", "failed"]).optional(),
  externalReference: z.string()
    .max(255, "La referencia externa no puede exceder 255 caracteres")
    .optional()
    .nullable(),
  gatewayMetadata: z.record(z.any())
    .optional()
    .nullable(),
  paymentId: z.string()
    .uuid("El paymentId debe ser un UUID válido")
    .optional()
    .nullable(),
});

