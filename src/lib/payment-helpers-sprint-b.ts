/**
 * Helpers para el sistema de pagos - SPRINT B
 * Normalización de Pagos (Pre-Gateway)
 */

import { createHash } from "crypto";

/**
 * Genera una clave de idempotencia para un pago
 * Basado en: sale_id, amount, method, payment_method_id, external_reference
 * SPRINT B: Incluir payment_method_id para diferenciar métodos con el mismo type
 */
export function generateIdempotencyKey(
  saleId: string,
  amount: number | string,
  method?: string | null,
  externalReference?: string | null,
  paymentMethodId?: string | null
): string {
  const amountStr = typeof amount === "number" ? amount.toString() : amount;
  const methodStr = method || "";
  const externalRefStr = externalReference || "";
  const paymentMethodIdStr = paymentMethodId || "";
  
  // SPRINT B: Incluir payment_method_id en la clave de idempotencia
  const data = `${saleId}|${amountStr}|${methodStr}|${paymentMethodIdStr}|${externalRefStr}`;
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Determina el estado inicial de un pago basado en el tipo de método de pago
 * Reglas SPRINT B/C:
 * - manual: puede confirmarse instantáneamente (confirmed)
 * - gateway: siempre inicia en pending
 * - external: siempre inicia en pending (async)
 */
export function getInitialPaymentStatus(paymentCategory: "manual" | "gateway" | "external"): "pending" | "confirmed" {
  return paymentCategory === "manual" ? "confirmed" : "pending";
}

/**
 * Valida si un método de pago es manual o gateway
 */
export function isManualPayment(paymentCategory: string): boolean {
  return paymentCategory === "manual";
}

export function isGatewayPayment(paymentCategory: string): boolean {
  return paymentCategory === "gateway";
}

