/**
 * SPRINT K: Confirmación automática y asistida de pagos
 */

import { supabase } from "@/lib/supabase";
import { recalculateSaleBalance } from "@/lib/matching-engine";

/**
 * Confirma un pago automáticamente basado en matching
 */
export async function autoConfirmPayment(
  paymentId: string,
  transferId: string,
  confidence: number,
  reasons: string[]
) {
  try {
    // Obtener pago
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("[autoConfirmPayment] Error al obtener pago:", paymentError);
      return;
    }

    // Solo confirmar si está pendiente
    if (payment.status !== "pending") {
      console.log(`[autoConfirmPayment] Pago ${paymentId} ya no está pendiente (${payment.status})`);
      return;
    }

    // Actualizar estado del pago
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: "confirmed",
      })
      .eq("id", paymentId);

    if (updateError) {
      console.error("[autoConfirmPayment] Error al confirmar pago:", updateError);
      return;
    }

    // Registrar confirmación automática
    const { error: confirmationError } = await supabase
      .from("payment_confirmations")
      .insert({
        payment_id: paymentId,
        transfer_id: transferId,
        confirmation_type: "auto",
        confidence_score: confidence.toFixed(2),
        confirmed_by: null, // NULL porque es automático
        reason: `Auto-confirmado por matching con confidence ${confidence.toFixed(2)}. Razones: ${reasons.join(", ")}`,
      });

    if (confirmationError) {
      console.error("[autoConfirmPayment] Error al registrar confirmación:", confirmationError);
    }

    // Recalcular balance de la venta
    await recalculateSaleBalance(payment.sale_id);

    console.log(`[autoConfirmPayment] Pago ${paymentId} confirmado automáticamente`);
  } catch (error) {
    console.error("[autoConfirmPayment] Error:", error);
  }
}

/**
 * Confirma un pago de forma asistida (usuario confirma sugerencia)
 */
export async function assistedConfirmPayment(
  paymentId: string,
  transferId: string,
  userId: string
) {
  try {
    // Obtener pago
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error("Pago no encontrado");
    }

    // Solo confirmar si está pendiente o tiene match_suggested
    if (payment.status !== "pending" && payment.match_result !== "matched_suggested") {
      throw new Error(`Pago no puede ser confirmado. Estado: ${payment.status}, Match: ${payment.match_result}`);
    }

    // Actualizar estado del pago
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: "confirmed",
      })
      .eq("id", paymentId);

    if (updateError) {
      throw new Error(`Error al confirmar pago: ${updateError.message}`);
    }

    // Registrar confirmación asistida
    const confidence = parseFloat(payment.match_confidence || "0");
    const { error: confirmationError } = await supabase
      .from("payment_confirmations")
      .insert({
        payment_id: paymentId,
        transfer_id: transferId,
        confirmation_type: "assisted",
        confidence_score: confidence.toFixed(2),
        confirmed_by: userId,
        reason: `Confirmado por usuario después de sugerencia (confidence: ${confidence.toFixed(2)})`,
      });

    if (confirmationError) {
      console.error("[assistedConfirmPayment] Error al registrar confirmación:", confirmationError);
    }

    // Recalcular balance de la venta
    await recalculateSaleBalance(payment.sale_id);

    return { success: true };
  } catch (error: any) {
    console.error("[assistedConfirmPayment] Error:", error);
    throw error;
  }
}

