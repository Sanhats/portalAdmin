/**
 * SPRINT H: Helpers para alertas e inteligencia comercial
 */

import { supabase } from "./supabase";
import { getProductMargins } from "./margin-helpers";

export type ProductAlertType = "LOW_MARGIN" | "NEGATIVE_MARGIN";

export interface ProductAlert {
  productId: string;
  productName: string;
  sku: string;
  avgMarginPercent: number;
  avgMarginAmount: number;
  totalSold: number;
  revenue: number;
  cost: number;
  alertType: ProductAlertType;
}

export interface SaleWithoutCost {
  saleId: string;
  saleDate: string;
  saleStatus: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  productCost: number | null; // Costo del producto en la BD
}

export interface AlertsSummary {
  productsWithLowMargin: number;
  productsWithNegativeMargin: number;
  salesWithoutCost: number;
}

export interface AlertsReport {
  summary: AlertsSummary;
  products: ProductAlert[];
  salesWithoutCost: SaleWithoutCost[];
}

/**
 * Obtiene alertas de productos por margen
 * @param tenantId - ID del tenant
 * @param lowMarginThreshold - Umbral de margen bajo (default: 20%)
 * @param startDate - Fecha de inicio (opcional)
 * @param endDate - Fecha de fin (opcional)
 * @returns Array de alertas de productos
 */
export async function getProductAlerts(
  tenantId: string,
  lowMarginThreshold: number = 20,
  startDate?: string,
  endDate?: string
): Promise<ProductAlert[]> {
  // Obtener márgenes de productos usando el helper existente
  const productMargins = await getProductMargins(tenantId, startDate, endDate);

  // Filtrar productos con problemas de margen
  const alerts: ProductAlert[] = [];

  for (const product of productMargins) {
    // Productos con margen negativo
    if (product.margin < 0) {
      alerts.push({
        productId: product.productId,
        productName: product.productName,
        sku: product.productSku,
        avgMarginPercent: product.marginPercent,
        avgMarginAmount: product.margin / product.totalSold, // Margen promedio por unidad
        totalSold: product.totalSold,
        revenue: product.revenue,
        cost: product.cost,
        alertType: "NEGATIVE_MARGIN",
      });
    }
    // Productos con margen bajo (pero positivo)
    else if (product.marginPercent < lowMarginThreshold && product.totalSold > 0) {
      alerts.push({
        productId: product.productId,
        productName: product.productName,
        sku: product.productSku,
        avgMarginPercent: product.marginPercent,
        avgMarginAmount: product.margin / product.totalSold,
        totalSold: product.totalSold,
        revenue: product.revenue,
        cost: product.cost,
        alertType: "LOW_MARGIN",
      });
    }
  }

  // Ordenar por margen ascendente (peores primero)
  alerts.sort((a, b) => a.avgMarginPercent - b.avgMarginPercent);

  return alerts;
}

/**
 * Obtiene ventas con items sin costo
 * @param tenantId - ID del tenant
 * @param startDate - Fecha de inicio (opcional)
 * @param endDate - Fecha de fin (opcional)
 * @returns Array de items de ventas sin costo
 */
export async function getSalesWithoutCost(
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<SaleWithoutCost[]> {
  // Construir query base para ventas
  let salesQuery = supabase
    .from("sales")
    .select(`
      id,
      status,
      created_at,
      sale_items (
        id,
        product_id,
        quantity,
        unit_price,
        unit_cost,
        product_name,
        product_sku
      )
    `)
    .eq("tenant_id", tenantId)
    .in("status", ["confirmed", "paid"]); // Solo ventas confirmadas o pagadas

  // Aplicar filtros de fecha si se proporcionan
  if (startDate) {
    salesQuery = salesQuery.gte("created_at", startDate);
  }
  if (endDate) {
    const endDatePlusOne = new Date(endDate);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
    salesQuery = salesQuery.lt("created_at", endDatePlusOne.toISOString());
  }

  const { data: sales, error } = await salesQuery;

  if (error) {
    console.error("[getSalesWithoutCost] Error al obtener ventas:", error);
    throw error;
  }

  const salesWithoutCost: SaleWithoutCost[] = [];

  if (sales) {
    for (const sale of sales) {
      const saleItems = sale.sale_items || [];
      
      for (const item of saleItems) {
        const unitCost = item.unit_cost ? parseFloat(item.unit_cost) : null;
        
        // Si el item no tiene costo, verificar si el producto tiene costo en la BD
        if (!unitCost || unitCost === 0) {
          // Obtener costo del producto actual
          const { data: product } = await supabase
            .from("products")
            .select("cost")
            .eq("id", item.product_id)
            .single();
          
          const productCost = product?.cost ? parseFloat(product.cost) : null;
          
          // Si ni el item ni el producto tienen costo, es una alerta
          if (!productCost || productCost === 0) {
            const saleDate = new Date(sale.created_at).toISOString().split("T")[0];
            
            salesWithoutCost.push({
              saleId: sale.id,
              saleDate: saleDate,
              saleStatus: sale.status,
              productId: item.product_id,
              productName: item.product_name || "Sin nombre",
              productSku: item.product_sku || "Sin SKU",
              quantity: item.quantity || 0,
              unitPrice: parseFloat(item.unit_price || "0"),
              unitCost: unitCost,
              productCost: productCost,
            });
          }
        }
      }
    }
  }

  // Ordenar por fecha descendente (más recientes primero)
  salesWithoutCost.sort((a, b) => {
    const dateA = new Date(a.saleDate).getTime();
    const dateB = new Date(b.saleDate).getTime();
    return dateB - dateA;
  });

  return salesWithoutCost;
}

/**
 * Obtiene resumen completo de alertas
 * @param tenantId - ID del tenant
 * @param lowMarginThreshold - Umbral de margen bajo (default: 20%)
 * @param startDate - Fecha de inicio (opcional)
 * @param endDate - Fecha de fin (opcional)
 * @returns Reporte completo de alertas
 */
export async function getAllAlerts(
  tenantId: string,
  lowMarginThreshold: number = 20,
  startDate?: string,
  endDate?: string
): Promise<AlertsReport> {
  // Obtener alertas de productos
  const productAlerts = await getProductAlerts(
    tenantId,
    lowMarginThreshold,
    startDate,
    endDate
  );

  // Obtener ventas sin costo
  const salesWithoutCost = await getSalesWithoutCost(tenantId, startDate, endDate);

  // Calcular resumen
  const summary: AlertsSummary = {
    productsWithLowMargin: productAlerts.filter(a => a.alertType === "LOW_MARGIN").length,
    productsWithNegativeMargin: productAlerts.filter(a => a.alertType === "NEGATIVE_MARGIN").length,
    salesWithoutCost: salesWithoutCost.length,
  };

  return {
    summary,
    products: productAlerts,
    salesWithoutCost,
  };
}
