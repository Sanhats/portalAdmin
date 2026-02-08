/**
 * SPRINT 1: Helpers para valorización de stock
 * Calcula el valor del stock por costo o por precio de venta
 */

import { supabase } from "@/lib/supabase";

export interface StockValuationItem {
  productId: string;
  productName: string;
  sku: string;
  stockCurrent: number;
  cost: number | null;
  price: number | null;
  valuationCost: number;
  valuationPrice: number;
}

export interface StockValuationResult {
  totalValuationCost: number;
  totalValuationPrice: number;
  items: StockValuationItem[];
  count: number;
}

/**
 * Calcula la valorización de stock por costo
 * @param tenantId - ID del tenant
 * @returns Valorización total y detalle por producto
 */
export async function calculateStockValuationByCost(
  tenantId: string
): Promise<StockValuationResult> {
  // Obtener productos con stock y costo
  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id,
      name_internal,
      sku,
      cost,
      store_id
    `)
    .eq("store_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Error al obtener productos: ${error.message}`);
  }

  // Obtener stock actual de cada producto
  const { data: stockData, error: stockError } = await supabase
    .from("product_stock")
    .select("product_id, stock_current")
    .in(
      "product_id",
      (products || []).map((p) => p.id)
    );

  if (stockError) {
    throw new Error(`Error al obtener stock: ${stockError.message}`);
  }

  const stockMap = new Map(
    (stockData || []).map((s) => [s.product_id, s.stock_current])
  );

  let totalValuationCost = 0;
  const items: StockValuationItem[] = [];

  for (const product of products || []) {
    const stockCurrent = stockMap.get(product.id) || 0;
    const cost = product.cost ? parseFloat(product.cost) : null;
    const valuationCost = cost && stockCurrent > 0 ? cost * stockCurrent : 0;

    totalValuationCost += valuationCost;

    items.push({
      productId: product.id,
      productName: product.name_internal,
      sku: product.sku,
      stockCurrent,
      cost,
      price: null,
      valuationCost,
      valuationPrice: 0,
    });
  }

  return {
    totalValuationCost,
    totalValuationPrice: 0,
    items,
    count: items.length,
  };
}

/**
 * Calcula la valorización de stock por precio de venta (lista de precios)
 * @param tenantId - ID del tenant
 * @param priceListId - ID de la lista de precios (1, 2, 3, 4)
 * @returns Valorización total y detalle por producto
 */
export async function calculateStockValuationByPrice(
  tenantId: string,
  priceListId: number
): Promise<StockValuationResult> {
  if (![1, 2, 3, 4].includes(priceListId)) {
    throw new Error("priceListId debe ser 1, 2, 3 o 4");
  }

  // Obtener productos con stock
  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id,
      name_internal,
      sku,
      cost,
      price,
      store_id
    `)
    .eq("store_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Error al obtener productos: ${error.message}`);
  }

  // Obtener precios de la lista especificada
  const { data: prices, error: pricesError } = await supabase
    .from("product_prices")
    .select("product_id, price")
    .eq("price_list_id", priceListId)
    .in(
      "product_id",
      (products || []).map((p) => p.id)
    );

  if (pricesError) {
    throw new Error(`Error al obtener precios: ${pricesError.message}`);
  }

  const priceMap = new Map(
    (prices || []).map((p) => [p.product_id, parseFloat(p.price)])
  );

  // Obtener stock actual
  const { data: stockData, error: stockError } = await supabase
    .from("product_stock")
    .select("product_id, stock_current")
    .in(
      "product_id",
      (products || []).map((p) => p.id)
    );

  if (stockError) {
    throw new Error(`Error al obtener stock: ${stockError.message}`);
  }

  const stockMap = new Map(
    (stockData || []).map((s) => [s.product_id, s.stock_current])
  );

  let totalValuationCost = 0;
  let totalValuationPrice = 0;
  const items: StockValuationItem[] = [];

  for (const product of products || []) {
    const stockCurrent = stockMap.get(product.id) || 0;
    const cost = product.cost ? parseFloat(product.cost) : null;
    const price = priceMap.get(product.id) || parseFloat(product.price || "0");
    const valuationCost = cost && stockCurrent > 0 ? cost * stockCurrent : 0;
    const valuationPrice = stockCurrent > 0 ? price * stockCurrent : 0;

    totalValuationCost += valuationCost;
    totalValuationPrice += valuationPrice;

    items.push({
      productId: product.id,
      productName: product.name_internal,
      sku: product.sku,
      stockCurrent,
      cost,
      price,
      valuationCost,
      valuationPrice,
    });
  }

  return {
    totalValuationCost,
    totalValuationPrice,
    items,
    count: items.length,
  };
}

/**
 * Calcula la valorización de stock según tipo solicitado
 * @param tenantId - ID del tenant
 * @param type - Tipo de valorización: 'cost' o 'price'
 * @param priceListId - ID de la lista de precios (solo si type='price')
 * @returns Valorización total y detalle por producto
 */
export async function calculateStockValuation(
  tenantId: string,
  type: "cost" | "price",
  priceListId?: number
): Promise<StockValuationResult> {
  if (type === "cost") {
    return calculateStockValuationByCost(tenantId);
  } else if (type === "price") {
    if (!priceListId) {
      throw new Error("priceListId es requerido cuando type='price'");
    }
    return calculateStockValuationByPrice(tenantId, priceListId);
  } else {
    throw new Error("type debe ser 'cost' o 'price'");
  }
}
