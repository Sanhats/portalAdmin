/**
 * Helpers para el sistema de compras
 * SPRINT ERP: Proveedores → Compras → Costos → Margen
 */

import { supabase } from "@/lib/supabase";
import { getOpenCashBox } from "./cash-box-helpers";

export interface PurchaseItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitCost: number | string;
}

export interface CalculatedPurchaseItem extends PurchaseItemInput {
  totalCost: number;
}

export interface CalculatedPurchaseTotals {
  subtotal: number;
  totalCost: number;
}

/**
 * Calcula los totales de una compra basándose en los items
 */
export async function calculatePurchaseTotals(
  items: PurchaseItemInput[],
  providedSubtotal?: number | string
): Promise<CalculatedPurchaseTotals> {
  let subtotal = 0;
  let totalCost = 0;

  // Calcular subtotal y costo total sumando todos los items
  for (const item of items) {
    const unitCost = typeof item.unitCost === "string" ? parseFloat(item.unitCost) : item.unitCost;
    const quantity = item.quantity;
    const itemTotalCost = unitCost * quantity;
    
    subtotal += itemTotalCost;
    totalCost += itemTotalCost;
  }

  // Si se proporcionó subtotal, usarlo (pero validar que sea consistente)
  if (providedSubtotal !== undefined) {
    const providedSubtotalNum = typeof providedSubtotal === "string" 
      ? parseFloat(providedSubtotal) 
      : providedSubtotal;
    if (Math.abs(providedSubtotalNum - subtotal) > 0.01) {
      console.warn(`[calculatePurchaseTotals] Subtotal proporcionado (${providedSubtotalNum}) difiere del calculado (${subtotal})`);
    }
    subtotal = providedSubtotalNum;
    totalCost = providedSubtotalNum; // En compras, subtotal = totalCost (sin impuestos por ahora)
  }

  return {
    subtotal,
    totalCost,
  };
}

/**
 * Prepara los items de compra con cálculos
 */
export async function preparePurchaseItems(
  items: PurchaseItemInput[]
): Promise<CalculatedPurchaseItem[]> {
  const preparedItems: CalculatedPurchaseItem[] = [];

  for (const item of items) {
    const unitCost = typeof item.unitCost === "string" 
      ? parseFloat(item.unitCost) 
      : item.unitCost;
    const quantity = item.quantity;
    const totalCost = unitCost * quantity;

    preparedItems.push({
      ...item,
      totalCost,
    });
  }

  return preparedItems;
}

/**
 * Calcula el costo promedio ponderado de un producto
 * Fórmula: (stock_actual * costo_actual + cantidad_compra * costo_compra) / (stock_actual + cantidad_compra)
 * 
 * @param currentStock - Stock actual del producto
 * @param currentCost - Costo actual del producto (puede ser null/0)
 * @param purchaseQuantity - Cantidad comprada
 * @param purchaseUnitCost - Costo unitario de la compra
 * @returns Nuevo costo promedio ponderado
 */
export function calculateWeightedAverageCost(
  currentStock: number,
  currentCost: number | null,
  purchaseQuantity: number,
  purchaseUnitCost: number
): number {
  const currentCostNum = currentCost || 0;

  // Si no hay stock previo o no hay costo previo, usar el costo de la compra
  if (currentStock === 0 || currentCostNum === 0) {
    return purchaseUnitCost;
  }

  // Calcular costo promedio ponderado
  const totalCurrentValue = currentStock * currentCostNum;
  const totalPurchaseValue = purchaseQuantity * purchaseUnitCost;
  const totalStock = currentStock + purchaseQuantity;
  const weightedAverageCost = (totalCurrentValue + totalPurchaseValue) / totalStock;

  return weightedAverageCost;
}

/**
 * Actualiza el stock y costo de un producto al recibir una compra
 * 
 * @param productId - ID del producto
 * @param quantity - Cantidad recibida
 * @param unitCost - Costo unitario de la compra
 * @param purchaseId - ID de la compra (para trazabilidad)
 * @returns Resultado de la actualización
 */
export async function updateProductStockAndCost(
  productId: string,
  quantity: number,
  unitCost: number,
  purchaseId: string
): Promise<{
  previousStock: number;
  newStock: number;
  previousCost: number | null;
  newCost: number;
}> {
  // Obtener producto actual
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("stock, cost")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    throw new Error(`Producto ${productId} no encontrado`);
  }

  const previousStock = product.stock || 0;
  const previousCost = product.cost ? parseFloat(product.cost) : null;
  const newStock = previousStock + quantity;

  // Calcular nuevo costo (promedio ponderado)
  const newCost = calculateWeightedAverageCost(
    previousStock,
    previousCost,
    quantity,
    unitCost
  );

  // Actualizar producto
  const { error: updateError } = await supabase
    .from("products")
    .update({
      stock: newStock,
      cost: newCost.toString(),
    })
    .eq("id", productId);

  if (updateError) {
    throw new Error(`Error al actualizar producto: ${updateError.message}`);
  }

  // Registrar movimiento de stock
  try {
    await supabase
      .from("stock_movements")
      .insert({
        product_id: productId,
        previous_stock: previousStock,
        new_stock: newStock,
        difference: quantity, // Positivo porque es entrada
        reason: `Compra recibida: ${purchaseId}`,
        purchase_id: purchaseId,
      });
  } catch (movementError) {
    // No fallar si no se puede registrar el movimiento, solo loguear
    console.warn(`[updateProductStockAndCost] No se pudo registrar movimiento de stock para producto ${productId}:`, movementError);
  }

  return {
    previousStock,
    newStock,
    previousCost,
    newCost,
  };
}

/**
 * Crea un movimiento de caja para una compra recibida
 * 
 * @param purchaseId - ID de la compra
 * @param tenantId - ID del tenant
 * @param totalCost - Costo total de la compra
 * @param paymentMethod - Método de pago ('cash' | 'transfer')
 * @returns Resultado de la creación
 */
export async function createCashMovementFromPurchase(
  purchaseId: string,
  tenantId: string,
  totalCost: number,
  paymentMethod: "cash" | "transfer" = "transfer"
): Promise<{ created: boolean; movementId?: string; reason?: string }> {
  try {
    // Obtener la caja abierta
    const cashBox = await getOpenCashBox(tenantId);

    if (!cashBox) {
      // No hay caja abierta - esto es válido según las reglas
      // La compra se registra normalmente, pero no se crea el movimiento
      console.log(`[createCashMovementFromPurchase] No hay caja abierta para la compra ${purchaseId}. El movimiento quedará pendiente.`);
      return { created: false, reason: "No hay caja abierta" };
    }

    // Obtener información de la compra para la referencia
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id, supplier_id, suppliers(name)")
      .eq("id", purchaseId)
      .single();

    const supplierName = (purchase as any)?.suppliers?.name || "Proveedor";
    const reference = `Compra #${purchaseId.substring(0, 8)} - ${supplierName}`;

    // Crear el movimiento
    const { data: movement, error: movementError } = await supabase
      .from("cash_movements")
      .insert({
        cash_box_id: cashBox.id,
        tenant_id: tenantId,
        type: "expense",
        amount: totalCost.toString(),
        payment_method: paymentMethod,
        reference: reference,
        purchase_id: purchaseId,
      })
      .select()
      .single();

    if (movementError) {
      console.error("[createCashMovementFromPurchase] Error al crear movimiento:", movementError);
      return { created: false, reason: "Error al crear movimiento" };
    }

    console.log(`[createCashMovementFromPurchase] Movimiento creado: ${movement.id} para compra ${purchaseId}`);
    return { created: true, movementId: movement.id };
  } catch (error) {
    console.error("[createCashMovementFromPurchase] Error inesperado:", error);
    return { created: false, reason: "Error inesperado" };
  }
}

/**
 * Valida que una compra puede ser recibida (confirmada)
 */
export async function canReceivePurchase(purchaseId: string): Promise<{
  canReceive: boolean;
  reason?: string;
}> {
  const { data: purchase, error } = await supabase
    .from("purchases")
    .select("id, status")
    .eq("id", purchaseId)
    .single();

  if (error || !purchase) {
    return { canReceive: false, reason: "Compra no encontrada" };
  }

  if (purchase.status === "received") {
    return { canReceive: false, reason: "La compra ya fue recibida" };
  }

  if (purchase.status === "cancelled") {
    return { canReceive: false, reason: "No se puede recibir una compra cancelada" };
  }

  if (purchase.status === "draft") {
    return { canReceive: false, reason: "La compra debe estar confirmada antes de recibirla" };
  }

  return { canReceive: true };
}
