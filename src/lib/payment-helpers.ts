import { supabase } from "@/lib/supabase";

/**
 * Recalcula el saldo financiero de una venta y actualiza los campos paid_amount, balance_amount
 * También actualiza el estado de la venta si balance_amount <= 0
 */
export async function recalculateSaleBalance(saleId: string): Promise<{
  paidAmount: number;
  balanceAmount: number;
  isPaid: boolean;
  updated: boolean;
}> {
  // CONTRATO: paid_amount = Suma de pagos con estado confirmed (NO pending)
  const { data: allPayments, error: paymentsError } = await supabase
    .from("payments")
    .select("amount, status")
    .eq("sale_id", saleId)
    .eq("status", "confirmed"); // Solo confirmed cuenta para paid_amount
  
  if (paymentsError) {
    console.error("[recalculateSaleBalance] Error al obtener pagos:", paymentsError);
    throw paymentsError;
  }
  
  // Calcular suma total de pagos válidos
  let paidAmount = 0;
  if (allPayments) {
    paidAmount = allPayments.reduce((sum, p) => {
      return sum + parseFloat(p.amount || "0");
    }, 0);
  }
  
  // Obtener la venta para obtener total_amount
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("id, total_amount, status, paid_amount, balance_amount")
    .eq("id", saleId)
    .single();
  
  if (saleError || !sale) {
    console.error("[recalculateSaleBalance] Error al obtener venta:", saleError);
    throw saleError;
  }
  
  const totalAmount = parseFloat(sale.total_amount || "0");
  const balanceAmount = totalAmount - paidAmount;
  const isPaid = balanceAmount <= 0;
  
  // Preparar actualización
  const updateData: any = {
    paid_amount: paidAmount.toString(),
    balance_amount: balanceAmount.toString(),
  };
  
  // Si está pagado y no estaba en estado paid, actualizar
  if (isPaid && sale.status !== "paid") {
    updateData.status = "paid";
    updateData.payment_completed_at = new Date().toISOString();
  }
  
  // Si no está pagado pero estaba en paid, volver a confirmed
  if (!isPaid && sale.status === "paid") {
    updateData.status = "confirmed";
    updateData.payment_completed_at = null;
  }
  
  // Solo actualizar si hay cambios
  const needsUpdate = 
    sale.paid_amount !== paidAmount.toString() ||
    sale.balance_amount !== balanceAmount.toString() ||
    (isPaid && sale.status !== "paid") ||
    (!isPaid && sale.status === "paid");
  
  if (needsUpdate) {
    const { error: updateError } = await supabase
      .from("sales")
      .update(updateData)
      .eq("id", saleId);
    
    if (updateError) {
      console.error("[recalculateSaleBalance] Error al actualizar venta:", updateError);
      throw updateError;
    }
    
    return {
      paidAmount,
      balanceAmount,
      isPaid,
      updated: true,
    };
  }
  
  return {
    paidAmount,
    balanceAmount,
    isPaid,
    updated: false,
  };
}

/**
 * Registra un evento de auditoría en payment_events
 */
export async function logPaymentEvent(
  paymentId: string,
  action: "created" | "deleted" | "status_changed" | "confirmed" | "cancelled",
  previousState: any,
  newState: any,
  userId: string
): Promise<void> {
  try {
    await supabase
      .from("payment_events")
      .insert({
        payment_id: paymentId,
        action: action,
        previous_state: previousState ? JSON.stringify(previousState) : null,
        new_state: newState ? JSON.stringify(newState) : null,
        created_by: userId,
      });
  } catch (error) {
    // No fallar si no se puede registrar el evento, solo loguear
    console.warn("[logPaymentEvent] No se pudo registrar evento de auditoría:", error);
  }
}

/**
 * SPRINT 1: Determina el proveedor del pago según el método
 */
export function determinePaymentProvider(
  method: string | null | undefined,
  paymentMethodId: string | null | undefined
): "manual" | "mercadopago" | "banco" | "pos" | null {
  if (!method) return null;
  
  const methodLower = method.toLowerCase();
  
  // Mercado Pago
  if (methodLower === "mp_point" || methodLower === "mercadopago") {
    return "mercadopago";
  }
  
  // Banco (transferencias)
  if (methodLower === "transfer") {
    return "banco";
  }
  
  // POS
  if (methodLower === "card") {
    return "pos";
  }
  
  // Manual (efectivo y otros)
  if (methodLower === "cash" || methodLower === "other") {
    return "manual";
  }
  
  // QR puede ser manual o mercadopago según el contexto
  if (methodLower === "qr") {
    // Por defecto manual, pero puede ser mercadopago si viene de un gateway
    return "manual";
  }
  
  return "manual"; // Default
}

/**
 * SPRINT 1: Determina el estado inicial del pago según el proveedor
 * Reglas:
 * - Pagos manuales → status = confirmed por defecto
 * - Pagos automáticos (mercadopago, banco, pos) → pending
 */
export function getInitialPaymentStatus(
  provider: "manual" | "mercadopago" | "banco" | "pos" | null
): "pending" | "confirmed" {
  // Pagos manuales se confirman automáticamente
  if (provider === "manual") {
    return "confirmed";
  }
  
  // Pagos automáticos inician en pending
  return "pending";
}

/**
 * SPRINT 1: Confirma un pago y actualiza confirmed_by y confirmed_at
 */
export async function confirmPayment(
  paymentId: string,
  userId: string | null = null
): Promise<void> {
  const updateData: any = {
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
  };
  
  // Si userId es null, significa que fue confirmado por el sistema
  if (userId) {
    updateData.confirmed_by = userId;
  }
  
  const { error } = await supabase
    .from("payments")
    .update(updateData)
    .eq("id", paymentId);
  
  if (error) {
    throw error;
  }
}

/**
 * SPRINT 2: Valida que el estado del pago permita confirmación
 * @param payment - Pago a validar
 * @returns true si puede ser confirmado, false en caso contrario
 */
export function canConfirmPayment(payment: any): { valid: boolean; reason?: string } {
  if (!payment) {
    return { valid: false, reason: "Pago no encontrado" };
  }

  // Solo pagos en estado pending pueden ser confirmados
  if (payment.status !== "pending") {
    return { 
      valid: false, 
      reason: `No se puede confirmar un pago en estado '${payment.status}'. Solo se pueden confirmar pagos en estado 'pending'` 
    };
  }

  // Si ya tiene confirmed_at, ya fue confirmado (protección adicional)
  if (payment.confirmed_at) {
    return { 
      valid: false, 
      reason: "El pago ya fue confirmado anteriormente" 
    };
  }

  return { valid: true };
}

/**
 * SPRINT 2: Valida que el monto del pago sea válido
 * @param payment - Pago a validar
 * @param expectedAmount - Monto esperado (opcional, para validar que no haya sido modificado)
 * @returns true si el monto es válido, false en caso contrario
 */
export function validatePaymentAmount(
  payment: any, 
  expectedAmount?: number | string
): { valid: boolean; reason?: string } {
  if (!payment) {
    return { valid: false, reason: "Pago no encontrado" };
  }

  const amount = parseFloat(payment.amount || "0");

  // Validar que el monto sea positivo
  if (amount <= 0) {
    return { valid: false, reason: "El monto del pago debe ser mayor a cero" };
  }

  // Si se proporciona un monto esperado, validar que coincida
  if (expectedAmount !== undefined) {
    const expected = typeof expectedAmount === "string" 
      ? parseFloat(expectedAmount) 
      : expectedAmount;
    
    if (Math.abs(amount - expected) > 0.01) { // Tolerancia de 1 centavo
      return { 
        valid: false, 
        reason: `El monto del pago (${amount}) no coincide con el monto esperado (${expected})` 
      };
    }
  }

  return { valid: true };
}

/**
 * SPRINT 2: Genera una clave de idempotencia para confirmación de pago
 * @param paymentId - ID del pago
 * @param userId - ID del usuario que confirma
 * @param timestamp - Timestamp de la confirmación (opcional)
 * @returns Clave de idempotencia
 */
export function generateConfirmationIdempotencyKey(
  paymentId: string,
  userId: string,
  timestamp?: string
): string {
  const ts = timestamp || new Date().toISOString();
  // Usar hash simple basado en paymentId, userId y timestamp (redondeado a segundo)
  const tsRounded = new Date(ts).toISOString().slice(0, 19); // Redondear a segundo
  return `confirm_${paymentId}_${userId}_${tsRounded}`;
}

/**
 * SPRINT 2: Verifica si ya existe una confirmación para este pago (idempotencia)
 * @param paymentId - ID del pago
 * @param userId - ID del usuario que intenta confirmar
 * @returns true si ya existe una confirmación reciente, false en caso contrario
 */
export async function checkDuplicateConfirmation(
  paymentId: string,
  userId: string
): Promise<{ isDuplicate: boolean; existingEvent?: any }> {
  try {
    // Buscar eventos de confirmación recientes (últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: events, error } = await supabase
      .from("payment_events")
      .select("*")
      .eq("payment_id", paymentId)
      .eq("action", "confirmed")
      .eq("created_by", userId)
      .gte("created_at", fiveMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("[checkDuplicateConfirmation] Error al verificar eventos:", error);
      return { isDuplicate: false }; // En caso de error, permitir (no bloquear)
    }

    if (events && events.length > 0) {
      return { isDuplicate: true, existingEvent: events[0] };
    }

    // También verificar si el pago ya está confirmado
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("status, confirmed_at, confirmed_by")
      .eq("id", paymentId)
      .single();

    if (!paymentError && payment) {
      if (payment.status === "confirmed" && payment.confirmed_at) {
        // Si fue confirmado recientemente (últimos 5 minutos) por el mismo usuario
        const confirmedAt = new Date(payment.confirmed_at);
        const fiveMinutesAgoDate = new Date(Date.now() - 5 * 60 * 1000);
        
        if (confirmedAt >= fiveMinutesAgoDate && payment.confirmed_by === userId) {
          return { isDuplicate: true, existingEvent: { confirmed_at: payment.confirmed_at } };
        }
      }
    }

    return { isDuplicate: false };
  } catch (error) {
    console.warn("[checkDuplicateConfirmation] Error inesperado:", error);
    return { isDuplicate: false }; // En caso de error, permitir (no bloquear)
  }
}

