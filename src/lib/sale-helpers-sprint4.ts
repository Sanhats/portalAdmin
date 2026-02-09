/**
 * SPRINT 4: Helpers para ventas con clientes y stock saliente
 * Incluye: confirmar venta, cancelar venta, validar stock, calcular totales
 */

import { supabase } from "@/lib/supabase";
import { registerSaleDebt } from "@/lib/accounting-helpers-sprint5";

export interface SaleItemInput {
  productId: string;
  quantity: number | string;
  unitPrice: number | string;
}

export interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  total: number;
}

/**
 * Normaliza la fecha de venta a inicio del día (00:00:00)
 */
export function normalizeSaleDate(date: string | Date | undefined): string {
  if (!date) {
    return new Date().toISOString();
  }

  let dateObj: Date;
  
  if (typeof date === "string") {
    // Si es solo fecha (YYYY-MM-DD), agregar hora 00:00:00
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      dateObj = new Date(date + "T00:00:00");
    } else {
      dateObj = new Date(date);
    }
  } else {
    dateObj = date;
  }

  // Asegurar que sea inicio del día
  dateObj.setHours(0, 0, 0, 0);
  
  return dateObj.toISOString();
}

/**
 * Valida que un producto esté activo y tenga stock suficiente
 */
export async function validateProductStockForSale(
  productId: string,
  quantity: number,
  tenantId: string
): Promise<{ valid: boolean; error?: string; stockAvailable?: number }> {
  const { data: product, error } = await supabase
    .from("products")
    .select("id, is_active, store_id")
    .eq("id", productId)
    .eq("store_id", tenantId)
    .is("deleted_at", null)
    .single();

  if (error || !product) {
    return { valid: false, error: `Producto ${productId} no encontrado` };
  }

  if (!product.is_active) {
    return { valid: false, error: "El producto está inactivo" };
  }

  // Obtener stock actual
  const { data: stock } = await supabase
    .from("product_stock")
    .select("stock_current")
    .eq("product_id", productId)
    .single();

  const stockCurrent = stock ? parseFloat(stock.stock_current || "0") : 0;

  if (stockCurrent < quantity) {
    return {
      valid: false,
      error: `Stock insuficiente. Disponible: ${stockCurrent}, Solicitado: ${quantity}`,
      stockAvailable: stockCurrent,
    };
  }

  return { valid: true, stockAvailable: stockCurrent };
}

/**
 * Valida que todos los productos de una venta tengan stock suficiente
 */
export async function validateSaleItemsStock(
  items: Array<{ productId: string; quantity: number | string }>,
  tenantId: string
): Promise<{ valid: boolean; error?: string }> {
  for (const item of items) {
    const quantity = typeof item.quantity === "string" 
      ? parseFloat(item.quantity) 
      : item.quantity;

    if (quantity <= 0) {
      return { valid: false, error: `La cantidad debe ser mayor a 0 para el producto ${item.productId}` };
    }

    const validation = await validateProductStockForSale(
      item.productId,
      quantity,
      tenantId
    );

    if (!validation.valid) {
      return { valid: false, error: validation.error };
    }
  }

  return { valid: true };
}

/**
 * Calcula los totales de una venta
 * subtotal = suma de ítems
 * discount_amount = subtotal * (discount_percentage / 100) o valor proporcionado
 * total = subtotal - discount_amount
 */
export function calculateSaleTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  discountPercentage?: number,
  discountAmount?: number
): SaleTotals {
  // Calcular subtotal
  const subtotal = items.reduce(
    (sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      return sum + itemTotal;
    },
    0
  );

  // Calcular discount_amount
  let calculatedDiscountAmount = 0;
  if (discountAmount !== undefined && discountAmount !== null) {
    calculatedDiscountAmount = discountAmount;
  } else if (discountPercentage !== undefined && discountPercentage !== null) {
    calculatedDiscountAmount = subtotal * (discountPercentage / 100);
  }

  // Redondear a 2 decimales
  calculatedDiscountAmount = Math.round(calculatedDiscountAmount * 100) / 100;

  // Calcular total
  const total = Math.max(0, subtotal - calculatedDiscountAmount);
  const roundedTotal = Math.round(total * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: calculatedDiscountAmount,
    total: roundedTotal,
  };
}

/**
 * Crea movimientos de stock para una venta confirmada
 * SPRINT 12: Ahora requiere branchId
 * SPRINT 13: El trigger detectará alertas automáticamente
 */
export async function createStockMovementsForSale(
  tenantId: string,
  saleId: string,
  branchId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<void> {
  const movements = items.map((item) => ({
    tenant_id: tenantId,
    branch_id: branchId, // SPRINT 12: Sucursal
    product_id: item.productId,
    type: "sale",
    quantity: -Math.abs(item.quantity), // Negativo para salida
    reference_id: saleId,
  }));

  const { error } = await supabase
    .from("stock_movements")
    .insert(movements);

  if (error) {
    throw new Error(`Error al crear movimientos de stock: ${error.message}`);
  }
}

/**
 * Crea movimientos de stock inversos para una venta cancelada
 */
export async function createStockMovementsForCancelation(
  tenantId: string,
  saleId: string,
  branchId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<void> {
  const movements = items.map((item) => ({
    tenant_id: tenantId,
    branch_id: branchId, // SPRINT 12: Sucursal
    product_id: item.productId,
    type: "cancelation",
    quantity: Math.abs(item.quantity), // Positivo para entrada (reversión)
    reference_id: saleId,
  }));

  const { error } = await supabase
    .from("stock_movements")
    .insert(movements);

  if (error) {
    throw new Error(`Error al crear movimientos de cancelación: ${error.message}`);
  }
}

/**
 * Confirma una venta (cambia estado a confirmed y genera movimientos de stock)
 * SPRINT 12: Ahora requiere branchId de la venta
 * SPRINT 13: El trigger detectará alertas automáticamente
 */
export async function confirmSale(
  saleId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Obtener la venta y validar estado
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("id, status, tenant_id, branch_id")
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .single();

  if (saleError || !sale) {
    return { success: false, error: "Venta no encontrada" };
  }

  if (sale.status !== "draft") {
    return { 
      success: false, 
      error: `No se puede confirmar una venta con estado ${sale.status}. Solo se pueden confirmar ventas en estado 'draft'` 
    };
  }

  // SPRINT 12: Validar branch_id
  if (!sale.branch_id) {
    return { success: false, error: "La venta debe tener una sucursal asignada (branch_id)" };
  }

  // 2. Obtener items de la venta
  const { data: saleItems, error: itemsError } = await supabase
    .from("sale_items")
    .select("product_id, quantity")
    .eq("sale_id", saleId);

  if (itemsError || !saleItems || saleItems.length === 0) {
    return { success: false, error: "La venta no tiene items" };
  }

  // 3. Validar stock disponible
  const normalizedItems = saleItems.map((item) => ({
    productId: item.product_id,
    quantity: parseFloat(item.quantity || "0"),
  }));

  const stockValidation = await validateSaleItemsStock(normalizedItems, tenantId);
  if (!stockValidation.valid) {
    return { success: false, error: stockValidation.error };
  }

  // 4. Crear movimientos de stock
  try {
    await createStockMovementsForSale(tenantId, saleId, sale.branch_id, normalizedItems);
  } catch (stockError: any) {
    return { success: false, error: `Error al crear movimientos de stock: ${stockError.message}` };
  }

  // 5. Actualizar estado de la venta a confirmed
  const { error: updateError } = await supabase
    .from("sales")
    .update({ 
      status: "confirmed",
      updated_at: new Date().toISOString()
    })
    .eq("id", saleId);

  if (updateError) {
    // Rollback: eliminar movimientos de stock creados
    await supabase
      .from("stock_movements")
      .delete()
      .eq("reference_id", saleId)
      .eq("type", "sale");
    
    return { success: false, error: `Error al actualizar venta: ${updateError.message}` };
  }

  // SPRINT 5: Registrar deuda en cuenta corriente (si la venta tiene cliente)
  try {
    const debtResult = await registerSaleDebt(saleId, tenantId);
    if (!debtResult.success) {
      // No fallar la confirmación si falla el registro de deuda, solo loguear
      console.warn(`[confirmSale] Error al registrar deuda: ${debtResult.error}`);
    }
  } catch (debtError: any) {
    // No fallar la confirmación si falla el registro de deuda, solo loguear
    console.warn(`[confirmSale] Error al registrar deuda: ${debtError.message}`);
  }

  return { success: true };
}

/**
 * Cancela una venta (solo si está confirmed, genera movimientos inversos)
 */
export async function cancelSale(
  saleId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  // Importar helper de accounting (lazy import para evitar dependencia circular)
  const { registerSaleCancelation } = await import("@/lib/accounting-helpers-sprint5");
  // 1. Obtener la venta y validar estado
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("id, status, tenant_id, branch_id")
    .eq("id", saleId)
    .eq("tenant_id", tenantId)
    .single();

  if (saleError || !sale) {
    return { success: false, error: "Venta no encontrada" };
  }

  if (sale.status !== "confirmed") {
    return { 
      success: false, 
      error: `No se puede cancelar una venta con estado ${sale.status}. Solo se pueden cancelar ventas en estado 'confirmed'` 
    };
  }

  // 2. Obtener items de la venta
  const { data: saleItems, error: itemsError } = await supabase
    .from("sale_items")
    .select("product_id, quantity")
    .eq("sale_id", saleId);

  if (itemsError || !saleItems || saleItems.length === 0) {
    return { success: false, error: "La venta no tiene items" };
  }

  // 3. Crear movimientos de stock inversos (cancelation)
  const normalizedItems = saleItems.map((item) => ({
    productId: item.product_id,
    quantity: parseFloat(item.quantity || "0"),
  }));

  // SPRINT 12: Validar branch_id
  if (!sale.branch_id) {
    return { success: false, error: "La venta debe tener una sucursal asignada (branch_id)" };
  }

  try {
    await createStockMovementsForCancelation(tenantId, saleId, sale.branch_id, normalizedItems);
  } catch (stockError: any) {
    return { success: false, error: `Error al crear movimientos de cancelación: ${stockError.message}` };
  }

  // 4. Actualizar estado de la venta a cancelled
  const { error: updateError } = await supabase
    .from("sales")
    .update({ 
      status: "cancelled",
      updated_at: new Date().toISOString()
    })
    .eq("id", saleId);

  if (updateError) {
    // Rollback: eliminar movimientos de cancelación creados
    await supabase
      .from("stock_movements")
      .delete()
      .eq("reference_id", saleId)
      .eq("type", "cancelation");
    
    return { success: false, error: `Error al actualizar venta: ${updateError.message}` };
  }

  // SPRINT 5: Revertir deuda en cuenta corriente (si la venta tenía cliente)
  try {
    const cancelationResult = await registerSaleCancelation(saleId, tenantId);
    if (!cancelationResult.success) {
      // No fallar la cancelación si falla el registro de reversión, solo loguear
      console.warn(`[cancelSale] Error al revertir deuda: ${cancelationResult.error}`);
    }
  } catch (cancelationError: any) {
    // No fallar la cancelación si falla el registro de reversión, solo loguear
    console.warn(`[cancelSale] Error al revertir deuda: ${cancelationError.message}`);
  }

  return { success: true };
}
