/**
 * SPRINT 2: Helpers para sesiones de caja
 * Incluye: abrir caja, cerrar caja, validar caja, calcular totales
 */

import { supabase } from "@/lib/supabase";

export interface CashSessionSummary {
  openingAmount: number;
  totalSales: number;
  totalRefunds: number;
  totalManual: number;
  calculatedClosing: number;
  actualClosing?: number;
  difference?: number;
}

/**
 * Valida que un vendedor no tenga una caja abierta
 */
export async function validateNoOpenCashSession(
  sellerId: string
): Promise<{ valid: boolean; error?: string }> {
  const { data: existingSession } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("seller_id", sellerId)
    .eq("status", "open")
    .single();

  if (existingSession) {
    return {
      valid: false,
      error: "El vendedor ya tiene una caja abierta",
    };
  }

  return { valid: true };
}

/**
 * Valida que un vendedor tenga una caja abierta
 */
export async function validateOpenCashSession(
  sellerId: string
): Promise<{ valid: boolean; error?: string; cashSessionId?: string }> {
  const { data: cashSession } = await supabase
    .from("cash_sessions")
    .select("id, opening_amount")
    .eq("seller_id", sellerId)
    .eq("status", "open")
    .single();

  if (!cashSession) {
    return {
      valid: false,
      error: "El vendedor no tiene una caja abierta",
    };
  }

  return { valid: true, cashSessionId: cashSession.id };
}

/**
 * Obtiene el resumen de una sesión de caja
 */
export async function getCashSessionSummary(
  cashSessionId: string
): Promise<CashSessionSummary> {
  // Obtener sesión
  const { data: session, error: sessionError } = await supabase
    .from("cash_sessions")
    .select("opening_amount, closing_amount")
    .eq("id", cashSessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(`Sesión de caja ${cashSessionId} no encontrada`);
  }

  // Obtener movimientos
  const { data: movements, error: movementsError } = await supabase
    .from("cash_movements")
    .select("type, amount")
    .eq("cash_session_id", cashSessionId);

  if (movementsError) {
    throw new Error(`Error al obtener movimientos: ${movementsError.message}`);
  }

  const openingAmount = parseFloat(session.opening_amount || "0");
  let totalSales = 0;
  let totalRefunds = 0;
  let totalManual = 0;

  for (const movement of movements || []) {
    const amount = parseFloat(movement.amount || "0");
    switch (movement.type) {
      case "sale":
        totalSales += amount;
        break;
      case "refund":
        totalRefunds += amount;
        break;
      case "manual":
        totalManual += amount;
        break;
    }
  }

  const calculatedClosing = openingAmount + totalSales - totalRefunds + totalManual;
  const actualClosing = session.closing_amount
    ? parseFloat(session.closing_amount)
    : undefined;
  const difference = actualClosing
    ? actualClosing - calculatedClosing
    : undefined;

  return {
    openingAmount,
    totalSales,
    totalRefunds,
    totalManual,
    calculatedClosing,
    actualClosing,
    difference,
  };
}

/**
 * Crea un movimiento de caja
 */
export async function createCashMovement(
  cashSessionId: string,
  type: "sale" | "refund" | "manual",
  amount: number,
  referenceId?: string
): Promise<void> {
  const { error } = await supabase
    .from("cash_movements")
    .insert({
      cash_session_id: cashSessionId,
      type: type,
      amount: amount.toString(),
      reference_id: referenceId || null,
    });

  if (error) {
    throw new Error(`Error al crear movimiento de caja: ${error.message}`);
  }
}
