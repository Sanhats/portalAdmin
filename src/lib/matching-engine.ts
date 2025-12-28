/**
 * SPRINT I: Motor de Matching Automático
 * Detecta pagos compatibles automáticamente basado en:
 * - Monto exacto
 * - Reference en descripción
 * - Ventana de tiempo
 */

import { supabase } from "@/lib/supabase";

export interface MatchingResult {
  paymentId: string;
  transferId: string;
  confidence: number;
  matchResult: "matched_auto" | "matched_suggested" | "no_match";
  reasons: string[];
}

/**
 * Ejecuta el motor de matching para una transferencia
 */
export async function runMatchingEngine(
  tenantId: string,
  transferId: string
): Promise<MatchingResult[]> {
  try {
    // Obtener la transferencia
    const { data: transfer, error: transferError } = await supabase
      .from("incoming_transfers")
      .select("*")
      .eq("id", transferId)
      .eq("tenant_id", tenantId)
      .single();

    if (transferError || !transfer) {
      console.error("[runMatchingEngine] Error al obtener transferencia:", transferError);
      return [];
    }

    const transferAmount = parseFloat(transfer.amount);
    const transferReference = transfer.reference || "";
    const transferDescription = transfer.raw_description || "";
    const receivedAt = new Date(transfer.received_at);

    // Buscar pagos pendientes del mismo tenant
    // Ventana de tiempo: ±24 horas desde received_at
    const windowStart = new Date(receivedAt.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = new Date(receivedAt.getTime() + 24 * 60 * 60 * 1000);

    const { data: pendingPayments, error: paymentsError } = await supabase
      .from("payments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString());

    if (paymentsError) {
      console.error("[runMatchingEngine] Error al obtener pagos:", paymentsError);
      return [];
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      console.log(`[runMatchingEngine] No hay pagos pendientes para matching con transferencia ${transferId}`);
      return [];
    }

    const results: MatchingResult[] = [];

    // Calcular confidence score para cada pago
    for (const payment of pendingPayments) {
      const paymentAmount = parseFloat(payment.amount);
      const paymentReference = payment.reference || "";
      const gatewayMetadata = payment.gateway_metadata as any;
      const qrReference = gatewayMetadata?.reference || "";

      let confidence = 0.0;
      let matchReasons: string[] = [];

      // 1. Match por monto exacto (peso alto)
      if (Math.abs(paymentAmount - transferAmount) < 0.01) {
        confidence += 0.5;
        matchReasons.push("Monto exacto");
      }

      // 2. Match por reference en descripción
      if (transferReference && paymentReference && transferDescription.includes(paymentReference)) {
        confidence += 0.3;
        matchReasons.push("Reference encontrado en descripción");
      }

      // 3. Match por QR reference
      if (qrReference && transferDescription.includes(qrReference)) {
        confidence += 0.3;
        matchReasons.push("QR reference encontrado");
      }

      // 4. Match por reference directo
      if (transferReference === paymentReference || transferReference === qrReference) {
        confidence += 0.4;
        matchReasons.push("Reference exacto");
      }

      // 5. Penalizar si el monto difiere mucho
      const amountDiff = Math.abs(paymentAmount - transferAmount);
      if (amountDiff > 0.01) {
        const penalty = Math.min(amountDiff / paymentAmount, 0.3);
        confidence -= penalty;
        matchReasons.push(`Penalización por diferencia de monto: ${amountDiff.toFixed(2)}`);
      }

      // Normalizar confidence entre 0 y 1
      confidence = Math.max(0, Math.min(1, confidence));

      // Determinar match_result
      let matchResult: "matched_auto" | "matched_suggested" | "no_match" = "no_match";
      if (confidence >= 0.9) {
        matchResult = "matched_auto";
      } else if (confidence >= 0.6) {
        matchResult = "matched_suggested";
      }

      // Actualizar pago con matching
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          match_confidence: confidence.toFixed(2),
          matched_transfer_id: matchResult !== "no_match" ? transferId : null,
          match_result: matchResult,
        })
        .eq("id", payment.id);

      if (updateError) {
        console.error(`[runMatchingEngine] Error al actualizar pago ${payment.id}:`, updateError);
        continue;
      }

      results.push({
        paymentId: payment.id,
        transferId,
        confidence,
        matchResult,
        reasons: matchReasons,
      });

      console.log(`[runMatchingEngine] Matching para pago ${payment.id}:`, {
        confidence: confidence.toFixed(2),
        matchResult,
        reasons: matchReasons,
      });
    }

    return results;
  } catch (error) {
    console.error("[runMatchingEngine] Error:", error);
    return [];
  }
}

/**
 * Recalcula el balance de una venta después de confirmar un pago
 */
export async function recalculateSaleBalance(saleId: string) {
  try {
    // Obtener todos los pagos confirmados de la venta
    const { data: confirmedPayments, error } = await supabase
      .from("payments")
      .select("amount")
      .eq("sale_id", saleId)
      .eq("status", "confirmed");

    if (error) {
      console.error("[recalculateSaleBalance] Error al obtener pagos:", error);
      return;
    }

    const paidAmount = confirmedPayments?.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0) || 0;

    // Obtener venta para calcular balance
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("total_amount, status")
      .eq("id", saleId)
      .single();

    if (saleError || !sale) {
      console.error("[recalculateSaleBalance] Error al obtener venta:", saleError);
      return;
    }

    const totalAmount = parseFloat(sale.total_amount || "0");
    const balanceAmount = totalAmount - paidAmount;

    // Actualizar venta
    await supabase
      .from("sales")
      .update({
        paid_amount: paidAmount.toFixed(2),
        balance_amount: balanceAmount.toFixed(2),
        payment_completed_at: balanceAmount <= 0 ? new Date().toISOString() : null,
        status: balanceAmount <= 0 ? "paid" : sale.status,
      })
      .eq("id", saleId);
  } catch (error) {
    console.error("[recalculateSaleBalance] Error:", error);
  }
}

