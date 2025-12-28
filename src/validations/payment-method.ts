import { z } from "zod";

// Esquema para crear método de pago
export const createPaymentMethodSchema = z.object({
  code: z.string()
    .min(1, "El código es requerido")
    .max(100, "El código no puede exceder 100 caracteres")
    .regex(/^[a-z0-9_]+$/, "El código debe contener solo letras minúsculas, números y guiones bajos"),
  label: z.string()
    .min(1, "La etiqueta es requerida")
    .max(255, "La etiqueta no puede exceder 255 caracteres"),
  // SPRINT C: Incluir tipos de gateways externos
  type: z.enum(["cash", "transfer", "qr", "card", "gateway", "mercadopago", "stripe", "paypal", "other"], {
    errorMap: () => ({ message: "El tipo debe ser: cash, transfer, qr, card, gateway, mercadopago, stripe, paypal u other" })
  }),
  // SPRINT B: Clasificación manual vs gateway
  // SPRINT C: Incluir "external" para gateways externos async
  paymentCategory: z.enum(["manual", "gateway", "external"], {
    errorMap: () => ({ message: "La categoría debe ser: manual, gateway o external" })
  }).optional(), // Si no se proporciona, se infiere del type
  isActive: z.boolean().optional().default(true),
  metadata: z.record(z.any()).optional().nullable(), // JSON object para metadata
});

// Esquema para actualizar método de pago
export const updatePaymentMethodSchema = createPaymentMethodSchema.partial().extend({
  code: z.string()
    .min(1, "El código es requerido")
    .max(100, "El código no puede exceder 100 caracteres")
    .regex(/^[a-z0-9_]+$/, "El código debe contener solo letras minúsculas, números y guiones bajos")
    .optional(),
});

