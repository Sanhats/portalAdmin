import { z } from "zod";

// SPRINT 1: Esquema para crear pago - Modelo definitivo
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
  // SPRINT 1: Método de pago unificado (incluye mp_point)
  method: z.enum(["cash", "transfer", "mp_point", "qr", "card", "other"], {
    errorMap: () => ({ message: "El método de pago debe ser: cash, transfer, mp_point, qr, card u other" })
  }).optional(),
  // SPRINT 1: Proveedor del pago
  provider: z.enum(["manual", "mercadopago", "banco", "pos"], {
    errorMap: () => ({ message: "El proveedor debe ser: manual, mercadopago, banco o pos" })
  }).optional(),
  // SPRINT 1: Estado simplificado - el backend decide según el tipo de pago
  status: z.enum(["pending", "confirmed"], {
    errorMap: () => ({ message: "El estado debe ser: pending o confirmed" })
  }).optional(),
  reference: z.string()
    .max(255, "La referencia no puede exceder 255 caracteres")
    .optional()
    .nullable(),
  // SPRINT 1: Metadata JSON para información adicional
  metadata: z.record(z.any())
    .optional()
    .nullable(),
  // Campos para integración con pasarelas (Mercado Pago, etc.) - backward compatibility
  externalReference: z.string()
    .max(255, "La referencia externa no puede exceder 255 caracteres")
    .optional()
    .nullable(),
  gatewayMetadata: z.record(z.any())
    .optional()
    .nullable(),
  // SPRINT F: Campos de evidencia de pago (opcional al crear)
  proofType: z.enum(["qr_code", "receipt", "transfer_screenshot", "pos_ticket", "other"]).optional(),
  proofReference: z.string().max(255).optional().nullable(),
  proofFileUrl: z.string().url().optional().nullable(),
  terminalId: z.string().max(100).optional().nullable(),
  cashRegisterId: z.string().max(100).optional().nullable(),
}).refine(
  (data) => data.paymentMethodId || data.method,
  {
    message: "Debe proporcionar paymentMethodId o method (para backward compatibility)",
    path: ["paymentMethodId"],
  }
);

// SPRINT 1: Esquema para confirmar pago
export const confirmPaymentSchema = z.object({
  // Opcional: metadata adicional al confirmar
  metadata: z.record(z.any()).optional().nullable(),
  // SPRINT F: Campos de evidencia de pago (opcional al confirmar)
  proofType: z.enum(["qr_code", "receipt", "transfer_screenshot", "pos_ticket", "other"]).optional(),
  proofReference: z.string().max(255).optional().nullable(),
  proofFileUrl: z.string().url().optional().nullable(),
  terminalId: z.string().max(100).optional().nullable(),
  cashRegisterId: z.string().max(100).optional().nullable(),
});

