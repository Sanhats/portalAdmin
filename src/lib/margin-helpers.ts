/**
 * SPRINT G: Helpers para cálculo de margen y rentabilidad
 */

import { supabase } from "./supabase";

export interface ProductMarginReport {
  productId: string;
  productName: string;
  productSku: string;
  totalSold: number; // Cantidad total vendida
  revenue: number; // Ingresos totales (suma de subtotales)
  cost: number; // Costo total (suma de costos)
  margin: number; // Margen bruto (revenue - cost)
  marginPercent: number; // Porcentaje de margen
}

/**
 * Calcula el margen por producto en un período
 * @param tenantId - ID del tenant
 * @param startDate - Fecha de inicio (ISO string, opcional)
 * @param endDate - Fecha de fin (ISO string, opcional)
 * @returns Array de reportes de margen por producto
 */
export async function getProductMargins(
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<ProductMarginReport[]> {
  // Construir query base para ventas confirmadas/paid
  let salesQuery = supabase
    .from("sales")
    .select(`
      id,
      total_amount,
      cost_amount,
      sale_items (
        id,
        product_id,
        quantity,
        unit_price,
        unit_cost,
        subtotal,
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
    // Agregar 1 día para incluir todo el día final
    const endDatePlusOne = new Date(endDate);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
    salesQuery = salesQuery.lt("created_at", endDatePlusOne.toISOString());
  }

  const { data: sales, error } = await salesQuery;

  if (error) {
    console.error("[getProductMargins] Error al obtener ventas:", error);
    throw error;
  }

  // Agrupar por producto
  const productMap = new Map<string, {
    productId: string;
    productName: string;
    productSku: string;
    totalSold: number;
    revenue: number;
    cost: number;
  }>();

  if (sales) {
    for (const sale of sales) {
      const saleItems = sale.sale_items || [];
      
      for (const item of saleItems) {
        const productId = item.product_id;
        const productName = item.product_name || "Sin nombre";
        const productSku = item.product_sku || "Sin SKU";
        const quantity = item.quantity || 0;
        const unitPrice = parseFloat(item.unit_price || "0");
        const unitCost = item.unit_cost ? parseFloat(item.unit_cost) : 0;
        
        // Calcular ingresos y costos del item
        const itemRevenue = unitPrice * quantity;
        const itemCost = unitCost * quantity;

        if (!productMap.has(productId)) {
          productMap.set(productId, {
            productId,
            productName,
            productSku,
            totalSold: 0,
            revenue: 0,
            cost: 0,
          });
        }

        const product = productMap.get(productId)!;
        product.totalSold += quantity;
        product.revenue += itemRevenue;
        product.cost += itemCost;
      }
    }
  }

  // Convertir a array y calcular márgenes
  const reports: ProductMarginReport[] = Array.from(productMap.values()).map(product => {
    const margin = product.revenue - product.cost;
    const marginPercent = product.revenue > 0 ? ((margin / product.revenue) * 100) : 0;

    return {
      productId: product.productId,
      productName: product.productName,
      productSku: product.productSku,
      totalSold: product.totalSold,
      revenue: Math.round(product.revenue * 100) / 100,
      cost: Math.round(product.cost * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      marginPercent: Math.round(marginPercent * 100) / 100,
    };
  });

  // Ordenar por margen descendente (productos más rentables primero)
  reports.sort((a, b) => b.margin - a.margin);

  return reports;
}
