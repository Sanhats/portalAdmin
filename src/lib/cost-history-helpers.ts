/**
 * SPRINT I: Helpers para historial de costos y sugerencias
 */

import { supabase } from "./supabase";

export interface CostHistoryEntry {
  date: string; // YYYY-MM-DD
  purchaseId: string;
  purchaseDate: string; // ISO string completa
  quantity: number;
  unitCost: number;
  avgCostAfter: number; // Costo promedio después de esta compra
  supplierName?: string;
}

export interface PriceSuggestion {
  currentCost: number | null;
  currentPrice: number;
  currentMarginPercent: number;
  targetMarginPercent: number;
  suggestedPrice: number;
  difference: number; // Diferencia entre precio sugerido y actual
}

export type AlertReason = 
  | "COST_INCREASE"
  | "PRICE_NOT_UPDATED"
  | "MISSING_COST"
  | "NEGATIVE_MARGIN"
  | "UNKNOWN";

export interface AlertContext {
  productId: string;
  productName: string;
  alertType: "LOW_MARGIN" | "NEGATIVE_MARGIN";
  reason: AlertReason;
  details: {
    previousCost?: number;
    currentCost?: number;
    variationPercent?: number;
    lastPurchaseDate?: string;
    currentPrice?: number;
    suggestedPrice?: number;
  };
}

/**
 * Obtiene el historial de costos de un producto basado en compras recibidas
 * @param productId - ID del producto
 * @param tenantId - ID del tenant (para validación)
 * @returns Array de entradas de historial de costos
 */
export async function getProductCostHistory(
  productId: string,
  tenantId: string
): Promise<CostHistoryEntry[]> {
  // Verificar que el producto existe y pertenece al tenant
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, store_id")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    throw new Error(`Producto ${productId} no encontrado`);
  }

  if (product.store_id !== tenantId) {
    throw new Error("El producto no pertenece al tenant");
  }

  // Obtener compras recibidas que incluyen este producto
  // Primero obtenemos todas las compras recibidas del tenant
  const { data: purchases, error: purchasesError } = await supabase
    .from("purchases")
    .select(`
      id,
      received_at,
      suppliers (
        name
      ),
      purchase_items (
        product_id,
        quantity,
        unit_cost
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("status", "received")
    .not("received_at", "is", null)
    .order("received_at", { ascending: true });

  if (purchasesError) {
    console.error("[getProductCostHistory] Error al obtener compras:", purchasesError);
    throw purchasesError;
  }

  const history: CostHistoryEntry[] = [];
  let currentAvgCost = 0;
  let currentStock = 0;

  if (purchases) {
    for (const purchase of purchases) {
      const purchaseItems = purchase.purchase_items || [];
      
      // Buscar el item de este producto en la compra
      const productItem = purchaseItems.find((item: any) => item.product_id === productId);
      
      if (productItem) {
        const quantity = productItem.quantity || 0;
        const unitCost = parseFloat(productItem.unit_cost || "0");
        const purchaseDate = purchase.received_at;
        
        if (purchaseDate && quantity > 0 && unitCost > 0) {
          // Calcular costo promedio después de esta compra
          // Fórmula: (stock_actual * costo_actual + cantidad_compra * costo_compra) / (stock_actual + cantidad_compra)
          const totalCurrentValue = currentStock * currentAvgCost;
          const totalPurchaseValue = quantity * unitCost;
          const totalStock = currentStock + quantity;
          
          const avgCostAfter = totalStock > 0 
            ? (totalCurrentValue + totalPurchaseValue) / totalStock
            : unitCost;
          
          const dateStr = new Date(purchaseDate).toISOString().split("T")[0];
          
          history.push({
            date: dateStr,
            purchaseId: purchase.id,
            purchaseDate: purchaseDate,
            quantity: quantity,
            unitCost: unitCost,
            avgCostAfter: Math.round(avgCostAfter * 100) / 100,
            supplierName: (purchase.suppliers as any)?.name,
          });
          
          // Actualizar para la siguiente iteración
          currentStock = totalStock;
          currentAvgCost = avgCostAfter;
        }
      }
    }
  }

  return history;
}

/**
 * Calcula sugerencia de precio basada en margen objetivo
 * @param productId - ID del producto
 * @param tenantId - ID del tenant
 * @param targetMarginPercent - Margen objetivo en porcentaje (default: 20)
 * @returns Sugerencia de precio
 */
export async function getPriceSuggestion(
  productId: string,
  tenantId: string,
  targetMarginPercent: number = 20
): Promise<PriceSuggestion> {
  // Obtener producto actual
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, price, cost, store_id")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    throw new Error(`Producto ${productId} no encontrado`);
  }

  if (product.store_id !== tenantId) {
    throw new Error("El producto no pertenece al tenant");
  }

  const currentPrice = parseFloat(product.price || "0");
  const currentCost = product.cost ? parseFloat(product.cost) : null;

  // Si no hay costo, no se puede calcular sugerencia
  if (!currentCost || currentCost === 0) {
    return {
      currentCost: null,
      currentPrice: currentPrice,
      currentMarginPercent: 0,
      targetMarginPercent: targetMarginPercent,
      suggestedPrice: currentPrice, // Mantener precio actual si no hay costo
      difference: 0,
    };
  }

  // Calcular margen actual
  const currentMarginPercent = currentPrice > 0 
    ? ((currentPrice - currentCost) / currentPrice) * 100 
    : 0;

  // Calcular precio sugerido
  // Fórmula: precio = costo / (1 - margen_objetivo / 100)
  // Ejemplo: costo = 1000, margen = 20% → precio = 1000 / (1 - 0.20) = 1000 / 0.80 = 1250
  const targetMarginDecimal = targetMarginPercent / 100;
  const suggestedPrice = currentCost / (1 - targetMarginDecimal);
  const difference = suggestedPrice - currentPrice;

  return {
    currentCost: currentCost,
    currentPrice: currentPrice,
    currentMarginPercent: Math.round(currentMarginPercent * 100) / 100,
    targetMarginPercent: targetMarginPercent,
    suggestedPrice: Math.round(suggestedPrice * 100) / 100,
    difference: Math.round(difference * 100) / 100,
  };
}

/**
 * Obtiene el contexto (causa raíz) de una alerta de producto
 * @param productId - ID del producto
 * @param tenantId - ID del tenant
 * @param alertType - Tipo de alerta
 * @returns Contexto de la alerta
 */
export async function getAlertContext(
  productId: string,
  tenantId: string,
  alertType: "LOW_MARGIN" | "NEGATIVE_MARGIN"
): Promise<AlertContext> {
  // Obtener producto actual
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name_internal, price, cost, store_id")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    throw new Error(`Producto ${productId} no encontrado`);
  }

  if (product.store_id !== tenantId) {
    throw new Error("El producto no pertenece al tenant");
  }

  const currentPrice = parseFloat(product.price || "0");
  const currentCost = product.cost ? parseFloat(product.cost) : null;

  // Obtener historial de costos
  const costHistory = await getProductCostHistory(productId, tenantId);

  // Determinar razón de la alerta
  let reason: AlertReason = "UNKNOWN";
  const details: AlertContext["details"] = {};

  if (!currentCost || currentCost === 0) {
    reason = "MISSING_COST";
    // No asignar currentCost si es null/0 (queda como undefined)
    details.currentPrice = currentPrice;
  } else if (alertType === "NEGATIVE_MARGIN") {
    reason = "NEGATIVE_MARGIN";
    details.currentCost = currentCost;
    details.currentPrice = currentPrice;
    
    // Calcular precio sugerido para margen del 20%
    const suggestedPrice = currentCost / 0.8; // 20% de margen
    details.suggestedPrice = Math.round(suggestedPrice * 100) / 100;
  } else {
    // LOW_MARGIN - analizar si es por aumento de costo o precio no actualizado
    if (costHistory.length >= 2) {
      // Comparar costo actual con costo anterior
      const previousEntry = costHistory[costHistory.length - 2];
      const previousCost = previousEntry.avgCostAfter;
      const variationPercent = ((currentCost - previousCost) / previousCost) * 100;
      
      if (variationPercent > 5) {
        // Aumento significativo de costo (>5%)
        reason = "COST_INCREASE";
        details.previousCost = previousCost;
        details.currentCost = currentCost;
        details.variationPercent = Math.round(variationPercent * 100) / 100;
        details.lastPurchaseDate = previousEntry.date;
        
        // Calcular precio sugerido
        const suggestedPrice = currentCost / 0.8; // 20% de margen
        details.suggestedPrice = Math.round(suggestedPrice * 100) / 100;
      } else {
        // El costo no aumentó mucho, probablemente el precio no se actualizó
        reason = "PRICE_NOT_UPDATED";
        details.currentCost = currentCost;
        details.currentPrice = currentPrice;
        
        // Calcular precio sugerido
        const suggestedPrice = currentCost / 0.8; // 20% de margen
        details.suggestedPrice = Math.round(suggestedPrice * 100) / 100;
      }
    } else if (costHistory.length === 1) {
      // Solo una compra, el precio probablemente no se actualizó
      reason = "PRICE_NOT_UPDATED";
      details.currentCost = currentCost;
      details.currentPrice = currentPrice;
      details.lastPurchaseDate = costHistory[0].date;
      
      // Calcular precio sugerido
      const suggestedPrice = currentCost / 0.8; // 20% de margen
      details.suggestedPrice = Math.round(suggestedPrice * 100) / 100;
    } else {
      // No hay historial, usar razón genérica
      reason = "PRICE_NOT_UPDATED";
      details.currentCost = currentCost;
      details.currentPrice = currentPrice;
    }
  }

  return {
    productId: product.id,
    productName: product.name_internal || "Sin nombre",
    alertType: alertType,
    reason: reason,
    details: details,
  };
}
