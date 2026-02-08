/**
 * SPRINT 5: Helpers para cuentas corrientes, pagos y saldos
 * Incluye: obtener/crear cuenta, crear movimientos, recalcular balance, registrar deuda/pago
 */

import { supabase } from "@/lib/supabase";

export interface AccountMovementInput {
  accountId: string;
  type: "debit" | "credit";
  amount: number;
  referenceType: "sale" | "payment" | "adjustment" | "sale_cancelation";
  referenceId: string | null;
  description?: string;
}

/**
 * Obtiene o crea una cuenta corriente para un cliente
 */
export async function getOrCreateAccount(
  customerId: string,
  tenantId: string
): Promise<{ accountId: string; created: boolean }> {
  // Intentar obtener cuenta existente
  const { data: existingAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "customer")
    .eq("entity_id", customerId)
    .single();

  if (existingAccount) {
    return { accountId: existingAccount.id, created: false };
  }

  // Crear nueva cuenta
  const { data: newAccount, error } = await supabase
    .from("accounts")
    .insert({
      tenant_id: tenantId,
      entity_type: "customer",
      entity_id: customerId,
      balance: "0",
    })
    .select("id")
    .single();

  if (error || !newAccount) {
    throw new Error(`Error al crear cuenta: ${error?.message || "Error desconocido"}`);
  }

  return { accountId: newAccount.id, created: true };
}

/**
 * Crea un movimiento de cuenta (inmutable)
 */
export async function createAccountMovement(
  input: AccountMovementInput,
  tenantId: string
): Promise<{ movementId: string }> {
  const { data: movement, error } = await supabase
    .from("account_movements")
    .insert({
      tenant_id: tenantId,
      account_id: input.accountId,
      type: input.type,
      amount: input.amount.toString(),
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      description: input.description || null,
    })
    .select("id")
    .single();

  if (error || !movement) {
    throw new Error(`Error al crear movimiento de cuenta: ${error?.message || "Error desconocido"}`);
  }

  // El trigger en la BD actualiza automáticamente el balance cacheado
  // Pero también podemos recalcular manualmente para asegurar consistencia
  await recalculateAccountBalance(input.accountId);

  return { movementId: movement.id };
}

/**
 * Recalcula el balance de una cuenta desde sus movimientos
 */
export async function recalculateAccountBalance(accountId: string): Promise<number> {
  // Obtener todos los movimientos de la cuenta
  const { data: movements, error } = await supabase
    .from("account_movements")
    .select("type, amount")
    .eq("account_id", accountId);

  if (error) {
    throw new Error(`Error al obtener movimientos: ${error.message}`);
  }

  // Calcular balance
  let balance = 0;
  if (movements) {
    for (const movement of movements) {
      const amount = parseFloat(movement.amount || "0");
      if (movement.type === "debit") {
        balance += amount; // Aumenta deuda
      } else if (movement.type === "credit") {
        balance -= amount; // Reduce deuda
      }
    }
  }

  // Actualizar balance cacheado
  const { error: updateError } = await supabase
    .from("accounts")
    .update({ balance: balance.toString() })
    .eq("id", accountId);

  if (updateError) {
    throw new Error(`Error al actualizar balance: ${updateError.message}`);
  }

  return balance;
}

/**
 * Obtiene el balance actual de una cuenta (calculado desde movimientos)
 */
export async function getAccountBalance(accountId: string): Promise<number> {
  const { data: movements, error } = await supabase
    .from("account_movements")
    .select("type, amount")
    .eq("account_id", accountId);

  if (error) {
    throw new Error(`Error al obtener movimientos: ${error.message}`);
  }

  let balance = 0;
  if (movements) {
    for (const movement of movements) {
      const amount = parseFloat(movement.amount || "0");
      if (movement.type === "debit") {
        balance += amount;
      } else if (movement.type === "credit") {
        balance -= amount;
      }
    }
  }

  return balance;
}

/**
 * Registra la deuda de una venta confirmada
 */
export async function registerSaleDebt(
  saleId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Obtener la venta
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, customer_id, total, status")
      .eq("id", saleId)
      .eq("tenant_id", tenantId)
      .single();

    if (saleError || !sale) {
      return { success: false, error: "Venta no encontrada" };
    }

    // Solo registrar deuda si la venta tiene cliente
    if (!sale.customer_id) {
      return { success: true }; // Venta mostrador, no genera deuda
    }

    // Obtener o crear cuenta
    const { accountId } = await getOrCreateAccount(sale.customer_id, tenantId);

    // Crear movimiento de deuda (debit)
    const total = parseFloat(sale.total || "0");
    if (total > 0) {
      await createAccountMovement(
        {
          accountId,
          type: "debit",
          amount: total,
          referenceType: "sale",
          referenceId: saleId,
          description: `Deuda por venta ${saleId}`,
        },
        tenantId
      );
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar deuda" };
  }
}

/**
 * Registra la reversión de deuda al cancelar una venta
 */
export async function registerSaleCancelation(
  saleId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Obtener la venta
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, customer_id, total, status")
      .eq("id", saleId)
      .eq("tenant_id", tenantId)
      .single();

    if (saleError || !sale) {
      return { success: false, error: "Venta no encontrada" };
    }

    // Solo revertir si la venta tiene cliente
    if (!sale.customer_id) {
      return { success: true }; // Venta mostrador, no había deuda
    }

    // Obtener cuenta (debe existir si se canceló una venta confirmada)
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "customer")
      .eq("entity_id", sale.customer_id)
      .single();

    if (!account) {
      // Si no existe cuenta, no había deuda registrada (venta nunca confirmada)
      return { success: true };
    }

    // Crear movimiento de reversión (credit)
    const total = parseFloat(sale.total || "0");
    if (total > 0) {
      await createAccountMovement(
        {
          accountId: account.id,
          type: "credit",
          amount: total,
          referenceType: "sale_cancelation",
          referenceId: saleId,
          description: `Reversión de deuda por cancelación de venta ${saleId}`,
        },
        tenantId
      );
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al revertir deuda" };
  }
}

/**
 * Registra un pago y genera el movimiento credit correspondiente
 */
export async function registerPayment(
  paymentId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Obtener el pago
    const { data: payment, error: paymentError } = await supabase
      .from("payments_sprint5")
      .select("id, customer_id, amount")
      .eq("id", paymentId)
      .eq("tenant_id", tenantId)
      .single();

    if (paymentError || !payment) {
      return { success: false, error: "Pago no encontrado" };
    }

    // Obtener o crear cuenta
    const { accountId } = await getOrCreateAccount(payment.customer_id, tenantId);

    // Crear movimiento de pago (credit)
    const amount = parseFloat(payment.amount || "0");
    if (amount > 0) {
      await createAccountMovement(
        {
          accountId,
          type: "credit",
          amount: amount,
          referenceType: "payment",
          referenceId: paymentId,
          description: `Pago de ${amount}`,
        },
        tenantId
      );
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar pago" };
  }
}
