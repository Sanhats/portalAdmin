/**
 * SPRINT 2: Helpers para ventas del POS Core
 * Incluye: confirmar venta, cancelar venta, calcular totales, validar stock
 */

import { supabase } from "@/lib/supabase";

export interface SaleItemInput {
  productId: string;
  quantity: number | string;
  unitPrice: number | string;
  priceListId?: number; // Lista de precios a usar (1-4)
}

export interface SaleTotals {
  subtotal: number;
  discountTotal: number;
  total: number;
}

/**
 * Obtiene el precio del producto desde la lista de precios especificada
 * Si no hay precio en la lista, usa el precio base del producto
 */
export async function getProductPrice(
  productId: string,
  priceListId?: number
): Promise<number> {
  // Si se especifica lista de precios, buscar precio en esa lista
  if (priceListId && [1, 2, 3, 4].includes(priceListId)) {
    const { data: priceData } = await supabase
      .from("product_prices")
      .select("price")
      .eq("product_id", productId)
      .eq("price_list_id", priceListId)
      .single();

    if (priceData) {
      return parseFloat(priceData.price);
    }
  }

  // Si no hay precio en la lista o no se especificó lista, usar precio base
  const { data: product } = await supabase
    .from("products")
    .select("price")
    .eq("id", productId)
    .single();

  if (!product) {
    throw new Error(`Producto ${productId} no encontrado`);
  }

  return parseFloat(product.price || "0");
}

/**
 * Valida que un producto esté activo y tenga stock suficiente
 */
export async function validateProductForSale(
  productId: string,
  quantity: number
): Promise<{ valid: boolean; error?: string; stockAvailable?: number }> {
  const { data: product, error } = await supabase
    .from("products")
    .select("id, is_active, store_id")
    .eq("id", productId)
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

  const stockCurrent = stock?.stock_current || 0;

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
 * Calcula los totales de una venta
 */
export function calculateSaleTotals(
  items: Array<{ quantity: number; unitPrice: number; discount?: number }>,
  discountTotal?: number
): SaleTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const calculatedDiscountTotal = discountTotal || 0;
  const total = subtotal - calculatedDiscountTotal;

  return {
    subtotal,
    discountTotal: calculatedDiscountTotal,
    total: Math.max(0, total), // Asegurar que total no sea negativo
  };
}

/**
 * Crea movimientos de stock para una venta confirmada
 */
export async function createStockMovementsForSale(
  tenantId: string,
  saleId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<void> {
  const movements = items.map((item) => ({
    tenant_id: tenantId,
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
  items: Array<{ productId: string; quantity: number }>
): Promise<void> {
  const movements = items.map((item) => ({
    tenant_id: tenantId,
    product_id: item.productId,
    type: "cancelation",
    quantity: Math.abs(item.quantity), // Positivo para entrada
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
 * Valida que un vendedor tenga una caja abierta
 */
export async function validateSellerHasOpenCashSession(
  sellerId: string
): Promise<{ valid: boolean; error?: string; cashSessionId?: string }> {
  const { data: cashSession, error } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("seller_id", sellerId)
    .eq("status", "open")
    .single();

  if (error || !cashSession) {
    return {
      valid: false,
      error: "El vendedor no tiene una caja abierta",
    };
  }

  return { valid: true, cashSessionId: cashSession.id };
}

/**
 * Calcula el vuelto (change) para una venta en efectivo
 */
export function calculateChange(
  total: number,
  cashReceived: number
): number {
  if (cashReceived < total) {
    throw new Error("El efectivo recibido es menor al total de la venta");
  }
  return cashReceived - total;
}
