import { z } from "zod";

/**
 * SPRINT C: Validaciones para payment_gateways
 */

export const gatewayProviderSchema = z.enum([
  'mercadopago',
  'qr',
  'pos',
  'stripe',
  'paypal',
  'other',
  'interoperable_qr'
], {
  errorMap: () => ({ message: "El provider debe ser: mercadopago, qr, pos, stripe, paypal, other o interoperable_qr" })
});

export const createPaymentGatewaySchema = z.object({
  provider: gatewayProviderSchema,
  enabled: z.boolean().optional().default(false),
  credentials: z.record(z.any()).optional().nullable(),
  config: z.record(z.any()).optional().nullable(),
});

export const updatePaymentGatewaySchema = z.object({
  enabled: z.boolean().optional(),
  credentials: z.record(z.any()).optional().nullable(),
  config: z.record(z.any()).optional().nullable(),
});

export type CreatePaymentGatewayInput = z.infer<typeof createPaymentGatewaySchema>;
export type UpdatePaymentGatewayInput = z.infer<typeof updatePaymentGatewaySchema>;

