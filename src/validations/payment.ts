import { z } from "zod";

// Esquema para crear pago
export const createPaymentSchema = z.object({
  amount: z.union([
    z.string().min(1, "El monto es requerido").regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser un número válido"),
    z.number().positive("El monto debe ser positivo")
  ]),
  // payment_method_id es el nuevo campo (preferido)
  paymentMethodId: z.string()
    .uuid("El paymentMethodId debe ser un UUID válido")
    .optional()
    .nullable(),
  // method se mantiene para backward compatibility (ahora acepta todos los tipos)
  method: z.enum(["cash", "transfer", "mercadopago", "qr", "card", "gateway", "other"], {
    errorMap: () => ({ message: "El método de pago debe ser: cash, transfer, mercadopago, qr, card, gateway u other" })
  }).optional(),
  status: z.enum(["pending", "confirmed", "failed", "refunded"]).optional().default("pending"),
  reference: z.string()
    .max(255, "La referencia no puede exceder 255 caracteres")
    .optional()
    .nullable(),
  // Campos para integración con pasarelas (Mercado Pago, etc.)
  externalReference: z.string()
    .max(255, "La referencia externa no puede exceder 255 caracteres")
    .optional()
    .nullable(),
  gatewayMetadata: z.record(z.any())
    .optional()
    .nullable(),
}).refine(
  (data) => data.paymentMethodId || data.method,
  {
    message: "Debe proporcionar paymentMethodId o method (para backward compatibility)",
    path: ["paymentMethodId"],
  }
);

