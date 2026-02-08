/**
 * SPRINT 6: Helpers para caja, ingresos y cierre diario
 * Incluye: abrir caja, cerrar caja, calcular totales, validar caja abierta
 */

import { supabase } from "@/lib/supabase";

export interface CashTotals {
  totalCash: number;
  totalTransfer: number;
  totalCard: number;
  totalOther: number;
  totalIncome: number;
}

/**
 * Abre una caja para un vendedor
 */
export async function openCashRegister(
  sellerId: string,
  tenantId: string,
  openingAmount: number = 0
): Promise<{ cashRegisterId: string; error?: string }> {
  // Validar que el vendedor existe y está activo
  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .select("id, active")
    .eq("id", sellerId)
    .eq("tenant_id", tenantId)
    .single();

  if (sellerError || !seller) {
    return { cashRegisterId: "", error: "Vendedor no encontrado" };
  }

  if (!seller.active) {
    return { cashRegisterId: "", error: "El vendedor está inactivo" };
  }

  // Validar que no haya caja abierta para este vendedor
  const { data: existingCashRegister } = await supabase
    .from("cash_registers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("seller_id", sellerId)
    .eq("status", "open")
    .single();

  if (existingCashRegister) {
    return { cashRegisterId: "", error: "Ya existe una caja abierta para este vendedor" };
  }

  // Crear nueva caja
  const { data: cashRegister, error: createError } = await supabase
    .from("cash_registers")
    .insert({
      tenant_id: tenantId,
      seller_id: sellerId,
      opening_amount: openingAmount.toString(),
      status: "open",
    })
    .select("id")
    .single();

  if (createError || !cashRegister) {
    return { cashRegisterId: "", error: `Error al abrir caja: ${createError?.message || "Error desconocido"}` };
  }

  return { cashRegisterId: cashRegister.id };
}

/**
 * Obtiene la caja abierta de un vendedor
 */
export async function getOpenCashRegister(
  sellerId: string,
  tenantId: string
): Promise<{ cashRegister: any | null; error?: string }> {
  const { data: cashRegister, error } = await supabase
    .from("cash_registers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("seller_id", sellerId)
    .eq("status", "open")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No hay caja abierta
      return { cashRegister: null };
    }
    return { cashRegister: null, error: `Error al obtener caja: ${error.message}` };
  }

  return { cashRegister };
}

/**
 * Calcula los totales de una caja desde los pagos registrados
 */
export async function calculateCashTotals(
  cashRegisterId: string
): Promise<CashTotals> {
  const { data: payments, error } = await supabase
    .from("payments_sprint5")
    .select("method, amount")
    .eq("cash_register_id", cashRegisterId);

  if (error) {
    throw new Error(`Error al obtener pagos: ${error.message}`);
  }

  let totalCash = 0;
  let totalTransfer = 0;
  let totalCard = 0;
  let totalOther = 0;

  if (payments) {
    for (const payment of payments) {
      const amount = parseFloat(payment.amount || "0");
      
      switch (payment.method) {
        case "cash":
          totalCash += amount;
          break;
        case "transfer":
          totalTransfer += amount;
          break;
        case "card":
          totalCard += amount;
          break;
        case "other":
          totalOther += amount;
          break;
      }
    }
  }

  const totalIncome = totalCash + totalTransfer + totalCard + totalOther;

  return {
    totalCash,
    totalTransfer,
    totalCard,
    totalOther,
    totalIncome,
  };
}

/**
 * Cierra una caja y genera el cierre
 */
export async function closeCashRegister(
  cashRegisterId: string,
  tenantId: string,
  closingAmount: number
): Promise<{ success: boolean; error?: string; closure?: any }> {
  try {
    // 1. Obtener la caja y validar estado
    const { data: cashRegister, error: cashRegisterError } = await supabase
      .from("cash_registers")
      .select("id, status, seller_id, opening_amount")
      .eq("id", cashRegisterId)
      .eq("tenant_id", tenantId)
      .single();

    if (cashRegisterError || !cashRegister) {
      return { success: false, error: "Caja no encontrada" };
    }

    if (cashRegister.status !== "open") {
      return { success: false, error: `No se puede cerrar una caja con estado ${cashRegister.status}. Solo se pueden cerrar cajas abiertas` };
    }

    // SPRINT 6: Validar que la caja no esté cerrada (inmutable)
    if (cashRegister.status === "closed") {
      return { success: false, error: "No se puede modificar una caja cerrada. Las cajas cerradas son inmutables" };
    }

    // 2. Calcular totales desde pagos
    const totals = await calculateCashTotals(cashRegisterId);

    // 3. Calcular diferencia
    const difference = closingAmount - totals.totalIncome;

    // 4. Crear cierre (inmutable)
    const { data: closure, error: closureError } = await supabase
      .from("cash_closures")
      .insert({
        tenant_id: tenantId,
        cash_register_id: cashRegisterId,
        total_cash: totals.totalCash.toString(),
        total_transfer: totals.totalTransfer.toString(),
        total_card: totals.totalCard.toString(),
        total_other: totals.totalOther.toString(),
        total_income: totals.totalIncome.toString(),
        difference: difference.toString(),
      })
      .select()
      .single();

    if (closureError || !closure) {
      return { success: false, error: `Error al crear cierre: ${closureError?.message || "Error desconocido"}` };
    }

    // 5. Cerrar la caja (marcar como closed)
    const { error: updateError } = await supabase
      .from("cash_registers")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closing_amount: closingAmount.toString(),
      })
      .eq("id", cashRegisterId);

    if (updateError) {
      // Rollback: eliminar cierre creado
      await supabase.from("cash_closures").delete().eq("id", closure.id);
      return { success: false, error: `Error al cerrar caja: ${updateError.message}` };
    }

    return { success: true, closure };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al cerrar caja" };
  }
}

/**
 * Valida que un pago pueda asociarse a una caja
 */
export async function validatePaymentCashRegister(
  sellerId: string,
  tenantId: string
): Promise<{ valid: boolean; cashRegisterId?: string; error?: string }> {
  // Obtener caja abierta del vendedor
  const { cashRegister, error } = await getOpenCashRegister(sellerId, tenantId);

  if (error) {
    return { valid: false, error };
  }

  if (!cashRegister) {
    return { valid: false, error: "No hay caja abierta para este vendedor" };
  }

  return { valid: true, cashRegisterId: cashRegister.id };
}
