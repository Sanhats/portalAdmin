/**
 * SPRINT B1/B2: Helpers para sistema de contabilidad operativa (cajas diarias)
 */

import { supabase } from "@/lib/supabase";

/**
 * Obtiene la caja abierta para un tenant en una fecha específica
 * @param tenantId - ID del tenant
 * @param date - Fecha (solo fecha, sin hora)
 * @returns Caja abierta o null
 */
export async function getOpenCashBox(
  tenantId: string,
  date?: Date
): Promise<any | null> {
  try {
    // Si no se proporciona fecha, usar la fecha actual
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const { data, error } = await supabase
      .from("cash_boxes")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "open")
      .gte("date", `${dateStr}T00:00:00`)
      .lt("date", `${dateStr}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[getOpenCashBox] Error al obtener caja abierta:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("[getOpenCashBox] Error inesperado:", error);
    return null;
  }
}

/**
 * Crea un movimiento de caja automático cuando se confirma un pago
 * Regla: Solo crea el movimiento si hay una caja abierta
 * @param paymentId - ID del pago confirmado
 * @param saleId - ID de la venta
 * @param tenantId - ID del tenant
 * @returns true si se creó el movimiento, false si no había caja abierta
 */
export async function createCashMovementFromPayment(
  paymentId: string,
  saleId: string,
  tenantId: string
): Promise<{ created: boolean; movementId?: string; reason?: string }> {
  try {
    // Obtener el pago
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, amount, method, status, sale_id")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      console.error("[createCashMovementFromPayment] Error al obtener pago:", paymentError);
      return { created: false, reason: "Pago no encontrado" };
    }

    // Solo procesar si el pago está confirmado
    if (payment.status !== "confirmed") {
      return { created: false, reason: "El pago no está confirmado" };
    }

    // Obtener la caja abierta
    const cashBox = await getOpenCashBox(tenantId);

    if (!cashBox) {
      // No hay caja abierta - esto es válido según las reglas
      // El pago se confirma normalmente, pero no se crea el movimiento
      console.log(`[createCashMovementFromPayment] No hay caja abierta para el pago ${paymentId}. El movimiento quedará pendiente.`);
      return { created: false, reason: "No hay caja abierta" };
    }

    // Mapear método de pago a payment_method de caja (cash o transfer)
    const paymentMethod = mapPaymentMethodToCashMethod(payment.method);

    if (!paymentMethod) {
      return { created: false, reason: `Método de pago '${payment.method}' no mapeable a cash/transfer` };
    }

    // Obtener información de la venta para la referencia
    const { data: sale } = await supabase
      .from("sales")
      .select("id, total_amount")
      .eq("id", saleId)
      .single();

    const reference = sale 
      ? `Venta #${sale.id.substring(0, 8)}`
      : `Pago #${payment.id.substring(0, 8)}`;

    // Crear el movimiento
    const { data: movement, error: movementError } = await supabase
      .from("cash_movements")
      .insert({
        cash_box_id: cashBox.id,
        tenant_id: tenantId,
        type: "income",
        amount: payment.amount,
        payment_method: paymentMethod,
        reference: reference,
        payment_id: paymentId,
        sale_id: saleId,
      })
      .select()
      .single();

    if (movementError) {
      console.error("[createCashMovementFromPayment] Error al crear movimiento:", movementError);
      return { created: false, reason: "Error al crear movimiento" };
    }

    console.log(`[createCashMovementFromPayment] Movimiento creado: ${movement.id} para pago ${paymentId}`);
    return { created: true, movementId: movement.id };
  } catch (error) {
    console.error("[createCashMovementFromPayment] Error inesperado:", error);
    return { created: false, reason: "Error inesperado" };
  }
}

/**
 * Mapea el método de pago del sistema de pagos al método de caja (cash o transfer)
 */
function mapPaymentMethodToCashMethod(
  method: string | null | undefined
): "cash" | "transfer" | null {
  if (!method) return null;

  const methodLower = method.toLowerCase();

  // Efectivo
  if (methodLower === "cash") {
    return "cash";
  }

  // Transferencias
  if (methodLower === "transfer") {
    return "transfer";
  }

  // QR y otros métodos digitales → transfer
  if (methodLower === "qr" || methodLower === "mp_point" || methodLower === "card") {
    return "transfer";
  }

  // Por defecto, si no se puede mapear, retornar null
  return null;
}

/**
 * Asocia automáticamente pagos confirmados pendientes cuando se abre una caja
 * @param cashBoxId - ID de la caja recién abierta
 * @param tenantId - ID del tenant
 * @returns Número de movimientos creados
 */
export async function associatePendingPaymentsToCashBox(
  cashBoxId: string,
  tenantId: string
): Promise<{ count: number; movements: any[] }> {
  try {
    // Obtener todos los pagos confirmados que tienen sale_id
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, amount, method, sale_id")
      .eq("tenant_id", tenantId)
      .eq("status", "confirmed")
      .not("sale_id", "is", null); // Asegurar que tiene sale_id

    if (paymentsError) {
      console.error("[associatePendingPaymentsToCashBox] Error al obtener pagos:", paymentsError);
      return { count: 0, movements: [] };
    }

    if (!payments || payments.length === 0) {
      return { count: 0, movements: [] };
    }

    // Obtener los IDs de pagos que ya tienen movimientos
    const { data: existingMovements } = await supabase
      .from("cash_movements")
      .select("payment_id")
      .eq("tenant_id", tenantId)
      .not("payment_id", "is", null);

    const existingPaymentIds = new Set(
      existingMovements?.map((m: any) => m.payment_id).filter(Boolean) || []
    );

    // Filtrar pagos que no tienen movimiento
    const pendingPayments = payments.filter((p: any) => !existingPaymentIds.has(p.id));

    if (pendingPayments.length === 0) {
      return { count: 0, movements: [] };
    }

    // Crear movimientos para cada pago pendiente
    const movementsToCreate = pendingPayments.map((payment: any) => {
      const paymentMethod = mapPaymentMethodToCashMethod(payment.method);
      
      if (!paymentMethod) {
        return null; // Saltar si no se puede mapear
      }

      return {
        cash_box_id: cashBoxId,
        tenant_id: tenantId,
        type: "income" as const,
        amount: payment.amount,
        payment_method: paymentMethod,
        reference: `Venta #${payment.sale_id?.substring(0, 8) || "N/A"}`,
        payment_id: payment.id,
        sale_id: payment.sale_id,
      };
    }).filter(Boolean);

    if (movementsToCreate.length === 0) {
      return { count: 0, movements: [] };
    }

    // Insertar todos los movimientos
    const { data: createdMovements, error: createError } = await supabase
      .from("cash_movements")
      .insert(movementsToCreate)
      .select();

    if (createError) {
      console.error("[associatePendingPaymentsToCashBox] Error al crear movimientos:", createError);
      return { count: 0, movements: [] };
    }

    console.log(`[associatePendingPaymentsToCashBox] ${createdMovements?.length || 0} movimientos creados para caja ${cashBoxId}`);
    return { count: createdMovements?.length || 0, movements: createdMovements || [] };
  } catch (error) {
    console.error("[associatePendingPaymentsToCashBox] Error inesperado:", error);
    return { count: 0, movements: [] };
  }
}

/**
 * Calcula los totales de una caja (ingresos, egresos, saldo final)
 * @param cashBoxId - ID de la caja
 * @returns Totales calculados
 */
export async function calculateCashBoxTotals(
  cashBoxId: string
): Promise<{
  totalIncome: number;
  totalExpense: number;
  finalBalance: number;
  incomeCash: number;
  incomeTransfer: number;
  expenseCash: number;
  expenseTransfer: number;
}> {
  try {
    const { data: movements, error } = await supabase
      .from("cash_movements")
      .select("type, amount, payment_method")
      .eq("cash_box_id", cashBoxId);

    if (error) {
      console.error("[calculateCashBoxTotals] Error al obtener movimientos:", error);
      throw error;
    }

    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCash = 0;
    let incomeTransfer = 0;
    let expenseCash = 0;
    let expenseTransfer = 0;

    movements?.forEach((movement: any) => {
      const amount = parseFloat(movement.amount || "0");
      
      if (movement.type === "income") {
        totalIncome += amount;
        if (movement.payment_method === "cash") {
          incomeCash += amount;
        } else if (movement.payment_method === "transfer") {
          incomeTransfer += amount;
        }
      } else if (movement.type === "expense") {
        totalExpense += amount;
        if (movement.payment_method === "cash") {
          expenseCash += amount;
        } else if (movement.payment_method === "transfer") {
          expenseTransfer += amount;
        }
      }
    });

    // Obtener saldo inicial de la caja
    const { data: cashBox } = await supabase
      .from("cash_boxes")
      .select("opening_balance")
      .eq("id", cashBoxId)
      .single();

    const openingBalance = parseFloat(cashBox?.opening_balance || "0");
    const finalBalance = openingBalance + totalIncome - totalExpense;

    return {
      totalIncome,
      totalExpense,
      finalBalance,
      incomeCash,
      incomeTransfer,
      expenseCash,
      expenseTransfer,
    };
  } catch (error) {
    console.error("[calculateCashBoxTotals] Error inesperado:", error);
    throw error;
  }
}

/**
 * Obtiene el conteo de pagos confirmados sin movimiento de caja
 * @param tenantId - ID del tenant
 * @returns Número de pagos pendientes
 */
export async function getPendingPaymentsCount(tenantId: string): Promise<number> {
  try {
    // Obtener todos los pagos confirmados
    const { data: payments } = await supabase
      .from("payments")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "confirmed")
      .not("sale_id", "is", null);

    if (!payments || payments.length === 0) {
      return 0;
    }

    // Obtener los IDs de pagos que ya tienen movimientos
    const { data: existingMovements } = await supabase
      .from("cash_movements")
      .select("payment_id")
      .eq("tenant_id", tenantId)
      .not("payment_id", "is", null);

    const existingPaymentIds = new Set(
      existingMovements?.map((m: any) => m.payment_id).filter(Boolean) || []
    );

    // Contar pagos sin movimiento
    const pendingCount = payments.filter((p: any) => !existingPaymentIds.has(p.id)).length;

    return pendingCount;
  } catch (error) {
    console.error("[getPendingPaymentsCount] Error:", error);
    return 0;
  }
}
