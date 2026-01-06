import { supabase } from "./supabase";

/**
 * SPRINT 6: Obtiene ventas por método de pago
 * @param tenantId - ID del tenant
 * @param startDate - Fecha de inicio (ISO string)
 * @param endDate - Fecha de fin (ISO string)
 * @returns Resumen de ventas agrupadas por método de pago
 */
export async function getSalesByMethod(
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  byMethod: Array<{
    method: string;
    provider: string | null;
    totalAmount: number;
    totalSales: number;
    averageAmount: number;
  }>;
  total: {
    totalAmount: number;
    totalSales: number;
  };
}> {
  // Construir query base para pagos confirmados
  let paymentsQuery = supabase
    .from("payments")
    .select("amount, method, provider, sale_id")
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed"); // Solo pagos confirmados

  // Aplicar filtros de fecha si se proporcionan
  if (startDate) {
    paymentsQuery = paymentsQuery.gte("confirmed_at", startDate);
  }
  if (endDate) {
    // Agregar 1 día para incluir todo el día final
    const endDatePlusOne = new Date(endDate);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
    paymentsQuery = paymentsQuery.lt("confirmed_at", endDatePlusOne.toISOString());
  }

  const { data: payments, error } = await paymentsQuery;

  if (error) {
    console.error("[getSalesByMethod] Error al obtener pagos:", error);
    throw error;
  }

  // Agrupar por método y proveedor
  const byMethodMap = new Map<string, {
    method: string;
    provider: string | null;
    amounts: number[];
    saleIds: Set<string>;
  }>();

  if (payments) {
    for (const payment of payments) {
      const method = payment.method || "other";
      const provider = payment.provider || null;
      const key = `${method}_${provider || "null"}`;
      const amount = parseFloat(payment.amount || "0");

      if (!byMethodMap.has(key)) {
        byMethodMap.set(key, {
          method,
          provider,
          amounts: [],
          saleIds: new Set(),
        });
      }

      const entry = byMethodMap.get(key)!;
      entry.amounts.push(amount);
      entry.saleIds.add(payment.sale_id);
    }
  }

  // Calcular totales por método
  const byMethod = Array.from(byMethodMap.values()).map(entry => {
    const totalAmount = entry.amounts.reduce((sum, amt) => sum + amt, 0);
    const totalSales = entry.saleIds.size;
    const averageAmount = totalSales > 0 ? totalAmount / totalSales : 0;

    return {
      method: entry.method,
      provider: entry.provider,
      totalAmount: Math.round(totalAmount * 100) / 100, // Redondear a 2 decimales
      totalSales,
      averageAmount: Math.round(averageAmount * 100) / 100,
    };
  });

  // Ordenar por totalAmount descendente
  byMethod.sort((a, b) => b.totalAmount - a.totalAmount);

  // Calcular totales generales
  const totalAmount = byMethod.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalSales = new Set(
    payments?.map(p => p.sale_id) || []
  ).size;

  return {
    byMethod,
    total: {
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalSales,
    },
  };
}

/**
 * SPRINT 6: Obtiene caja diaria (resumen del día)
 * @param tenantId - ID del tenant
 * @param date - Fecha del día (ISO string, opcional, default: hoy)
 * @returns Resumen de caja diaria
 */
export async function getDailyCash(
  tenantId: string,
  date?: string
): Promise<{
  date: string;
  sales: {
    total: number;
    confirmed: number;
    paid: number;
    cancelled: number;
  };
  payments: {
    totalAmount: number;
    byMethod: Array<{
      method: string;
      provider: string | null;
      amount: number;
      count: number;
    }>;
  };
  financial: {
    totalSales: number;
    totalPaid: number;
    pendingAmount: number;
    cancelledAmount: number;
  };
}> {
  // Determinar fecha (hoy si no se proporciona)
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const startDateStr = startOfDay.toISOString();
  const endDateStr = endOfDay.toISOString();

  // Obtener ventas del día
  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, status, total_amount, paid_amount, balance_amount")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDateStr)
    .lte("created_at", endDateStr);

  if (salesError) {
    console.error("[getDailyCash] Error al obtener ventas:", salesError);
    throw salesError;
  }

  // Obtener pagos confirmados del día
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("amount, method, provider")
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed")
    .gte("confirmed_at", startDateStr)
    .lte("confirmed_at", endDateStr);

  if (paymentsError) {
    console.error("[getDailyCash] Error al obtener pagos:", paymentsError);
    throw paymentsError;
  }

  // Calcular resumen de ventas
  const salesSummary = {
    total: sales?.length || 0,
    confirmed: sales?.filter(s => s.status === "confirmed").length || 0,
    paid: sales?.filter(s => s.status === "paid").length || 0,
    cancelled: sales?.filter(s => s.status === "cancelled").length || 0,
  };

  // Calcular totales financieros de ventas
  const totalSales = sales?.reduce((sum, s) => sum + parseFloat(s.total_amount || "0"), 0) || 0;
  const totalPaid = sales?.reduce((sum, s) => sum + parseFloat(s.paid_amount || "0"), 0) || 0;
  const pendingAmount = sales?.reduce((sum, s) => {
    if (s.status === "confirmed") {
      return sum + parseFloat(s.balance_amount || "0");
    }
    return sum;
  }, 0) || 0;
  const cancelledAmount = sales
    ?.filter(s => s.status === "cancelled")
    .reduce((sum, s) => sum + parseFloat(s.total_amount || "0"), 0) || 0;

  // Agrupar pagos por método
  const paymentsByMethod = new Map<string, {
    method: string;
    provider: string | null;
    amounts: number[];
  }>();

  if (payments) {
    for (const payment of payments) {
      const method = payment.method || "other";
      const provider = payment.provider || null;
      const key = `${method}_${provider || "null"}`;
      const amount = parseFloat(payment.amount || "0");

      if (!paymentsByMethod.has(key)) {
        paymentsByMethod.set(key, {
          method,
          provider,
          amounts: [],
        });
      }

      paymentsByMethod.get(key)!.amounts.push(amount);
    }
  }

  const paymentsByMethodArray = Array.from(paymentsByMethod.values()).map(entry => ({
    method: entry.method,
    provider: entry.provider,
    amount: Math.round(entry.amounts.reduce((sum, amt) => sum + amt, 0) * 100) / 100,
    count: entry.amounts.length,
  }));

  // Ordenar por amount descendente
  paymentsByMethodArray.sort((a, b) => b.amount - a.amount);

  const totalPayments = paymentsByMethodArray.reduce((sum, item) => sum + item.amount, 0);

  return {
    date: targetDate.toISOString().split("T")[0], // YYYY-MM-DD
    sales: salesSummary,
    payments: {
      totalAmount: Math.round(totalPayments * 100) / 100,
      byMethod: paymentsByMethodArray,
    },
    financial: {
      totalSales: Math.round(totalSales * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      cancelledAmount: Math.round(cancelledAmount * 100) / 100,
    },
  };
}

/**
 * SPRINT 6: Obtiene diferencias (ventas vs pagos)
 * @param tenantId - ID del tenant
 * @param startDate - Fecha de inicio (ISO string)
 * @param endDate - Fecha de fin (ISO string)
 * @returns Diferencias entre ventas y pagos
 */
export async function getDifferences(
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  sales: {
    totalAmount: number;
    totalSales: number;
    byStatus: {
      confirmed: number;
      paid: number;
      cancelled: number;
    };
  };
  payments: {
    totalAmount: number;
    totalPayments: number;
    byMethod: Array<{
      method: string;
      provider: string | null;
      amount: number;
      count: number;
    }>;
  };
  differences: {
    totalDifference: number;
    pendingSales: number;
    overPayments: number;
    breakdown: Array<{
      saleId: string;
      saleAmount: number;
      paidAmount: number;
      difference: number;
      status: string;
    }>;
  };
}> {
  // Construir query base para ventas
  let salesQuery = supabase
    .from("sales")
    .select("id, status, total_amount, paid_amount, balance_amount")
    .eq("tenant_id", tenantId)
    .in("status", ["confirmed", "paid", "cancelled"]); // Solo ventas procesadas

  // Aplicar filtros de fecha si se proporcionan
  if (startDate) {
    salesQuery = salesQuery.gte("created_at", startDate);
  }
  if (endDate) {
    const endDatePlusOne = new Date(endDate);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
    salesQuery = salesQuery.lt("created_at", endDatePlusOne.toISOString());
  }

  const { data: sales, error: salesError } = await salesQuery;

  if (salesError) {
    console.error("[getDifferences] Error al obtener ventas:", salesError);
    throw salesError;
  }

  // Construir query base para pagos confirmados
  let paymentsQuery = supabase
    .from("payments")
    .select("amount, method, provider, sale_id")
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed");

  if (startDate) {
    paymentsQuery = paymentsQuery.gte("confirmed_at", startDate);
  }
  if (endDate) {
    const endDatePlusOne = new Date(endDate);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
    paymentsQuery = paymentsQuery.lt("confirmed_at", endDatePlusOne.toISOString());
  }

  const { data: payments, error: paymentsError } = await paymentsQuery;

  if (paymentsError) {
    console.error("[getDifferences] Error al obtener pagos:", paymentsError);
    throw paymentsError;
  }

  // Calcular resumen de ventas
  const totalSalesAmount = sales?.reduce((sum, s) => sum + parseFloat(s.total_amount || "0"), 0) || 0;
  const salesByStatus = {
    confirmed: sales?.filter(s => s.status === "confirmed").length || 0,
    paid: sales?.filter(s => s.status === "paid").length || 0,
    cancelled: sales?.filter(s => s.status === "cancelled").length || 0,
  };

  // Calcular resumen de pagos
  const totalPaymentsAmount = payments?.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0) || 0;

  // Agrupar pagos por método
  const paymentsByMethod = new Map<string, {
    method: string;
    provider: string | null;
    amounts: number[];
  }>();

  if (payments) {
    for (const payment of payments) {
      const method = payment.method || "other";
      const provider = payment.provider || null;
      const key = `${method}_${provider || "null"}`;

      if (!paymentsByMethod.has(key)) {
        paymentsByMethod.set(key, {
          method,
          provider,
          amounts: [],
        });
      }

      paymentsByMethod.get(key)!.amounts.push(parseFloat(payment.amount || "0"));
    }
  }

  const paymentsByMethodArray = Array.from(paymentsByMethod.values()).map(entry => ({
    method: entry.method,
    provider: entry.provider,
    amount: Math.round(entry.amounts.reduce((sum, amt) => sum + amt, 0) * 100) / 100,
    count: entry.amounts.length,
  }));

  // Calcular diferencias por venta
  const breakdown: Array<{
    saleId: string;
    saleAmount: number;
    paidAmount: number;
    difference: number;
    status: string;
  }> = [];

  if (sales) {
    // Agrupar pagos por sale_id
    const paymentsBySale = new Map<string, number>();
    if (payments) {
      for (const payment of payments) {
        const current = paymentsBySale.get(payment.sale_id) || 0;
        paymentsBySale.set(payment.sale_id, current + parseFloat(payment.amount || "0"));
      }
    }

    for (const sale of sales) {
      const saleAmount = parseFloat(sale.total_amount || "0");
      const paidAmount = paymentsBySale.get(sale.id) || 0;
      const difference = saleAmount - paidAmount;

      breakdown.push({
        saleId: sale.id,
        saleAmount: Math.round(saleAmount * 100) / 100,
        paidAmount: Math.round(paidAmount * 100) / 100,
        difference: Math.round(difference * 100) / 100,
        status: sale.status,
      });
    }
  }

  // Ordenar breakdown por diferencia descendente (mayores diferencias primero)
  breakdown.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  // Calcular totales de diferencias
  const totalDifference = totalSalesAmount - totalPaymentsAmount;
  const pendingSales = breakdown
    .filter(b => b.difference > 0 && b.status === "confirmed")
    .reduce((sum, b) => sum + b.difference, 0);
  const overPayments = breakdown
    .filter(b => b.difference < 0)
    .reduce((sum, b) => sum + Math.abs(b.difference), 0);

  return {
    period: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    sales: {
      totalAmount: Math.round(totalSalesAmount * 100) / 100,
      totalSales: sales?.length || 0,
      byStatus: salesByStatus,
    },
    payments: {
      totalAmount: Math.round(totalPaymentsAmount * 100) / 100,
      totalPayments: payments?.length || 0,
      byMethod: paymentsByMethodArray,
    },
    differences: {
      totalDifference: Math.round(totalDifference * 100) / 100,
      pendingSales: Math.round(pendingSales * 100) / 100,
      overPayments: Math.round(overPayments * 100) / 100,
      breakdown: breakdown.slice(0, 100), // Limitar a 100 para no sobrecargar
    },
  };
}

