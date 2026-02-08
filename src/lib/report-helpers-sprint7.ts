/**
 * SPRINT 7: Helpers para reportes, estadísticas y exportación
 * READ-ONLY: Solo lectura de datos, sin modificar nada
 */

import { supabase } from "@/lib/supabase";

export interface ReportFilters {
  tenantId: string;
  startDate?: string;
  endDate?: string;
  sellerId?: string;
  customerId?: string;
}

export interface SalesSummary {
  totalSales: number;
  totalTickets: number;
  averageTicket: number;
  totalDiscounts: number;
  totalAmount: number;
  confirmedSales: number;
  cancelledSales: number;
}

export interface SalesByVendor {
  sellerId: string;
  sellerName: string;
  totalSales: number;
  totalAmount: number;
  totalPaid: number;
  difference: number;
  ticketCount: number;
}

export interface SalesByCategory {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  productCount: number;
  percentage: number;
}

export interface ProfitReport {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
  dailyProfit?: number;
  monthlyProfit?: number;
}

/**
 * Normaliza fechas para queries
 */
function normalizeDate(date: string | undefined): string | null {
  if (!date) return null;
  // Si es solo fecha (YYYY-MM-DD), agregar hora 00:00:00
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date + "T00:00:00";
  }
  return date;
}

/**
 * Construye filtros de fecha para queries
 */
function buildDateFilter(filters: ReportFilters) {
  const startDate = normalizeDate(filters.startDate);
  const endDate = normalizeDate(filters.endDate);
  
  return { startDate, endDate };
}

/**
 * 1. Resumen General de Ventas
 */
export async function getSalesSummary(
  filters: ReportFilters
): Promise<SalesSummary> {
  const { startDate, endDate } = buildDateFilter(filters);

  // Query base
  let query = supabase
    .from("sales")
    .select("id, total, discount_amount, status")
    .eq("tenant_id", filters.tenantId)
    .in("status", ["confirmed", "cancelled"]);

  // Aplicar filtros de fecha
  if (startDate) {
    query = query.gte("date", startDate);
  }
  if (endDate) {
    query = query.lte("date", endDate);
  }

  // Filtros opcionales
  if (filters.sellerId) {
    query = query.eq("seller_id", filters.sellerId);
  }
  if (filters.customerId) {
    query = query.eq("customer_id", filters.customerId);
  }

  const { data: sales, error } = await query;

  if (error) {
    throw new Error(`Error al obtener ventas: ${error.message}`);
  }

  let totalSales = 0;
  let totalDiscounts = 0;
  let totalAmount = 0;
  let confirmedSales = 0;
  let cancelledSales = 0;

  if (sales) {
    for (const sale of sales) {
      const total = parseFloat(sale.total || "0");
      const discount = parseFloat(sale.discount_amount || "0");

      totalSales += total;
      totalDiscounts += discount;
      totalAmount += total;

      if (sale.status === "confirmed") {
        confirmedSales++;
      } else if (sale.status === "cancelled") {
        cancelledSales++;
      }
    }
  }

  const totalTickets = sales?.length || 0;
  const averageTicket = totalTickets > 0 ? totalSales / totalTickets : 0;

  return {
    totalSales,
    totalTickets,
    averageTicket: Math.round(averageTicket * 100) / 100,
    totalDiscounts,
    totalAmount,
    confirmedSales,
    cancelledSales,
  };
}

/**
 * 2. Ventas por Vendedor
 */
export async function getSalesByVendor(
  filters: ReportFilters
): Promise<SalesByVendor[]> {
  const { startDate, endDate } = buildDateFilter(filters);

  // Obtener ventas con vendedores
  let salesQuery = supabase
    .from("sales")
    .select(`
      id,
      total,
      seller_id,
      sellers:seller_id (
        id,
        name
      )
    `)
    .eq("tenant_id", filters.tenantId)
    .eq("status", "confirmed");

  if (startDate) {
    salesQuery = salesQuery.gte("date", startDate);
  }
  if (endDate) {
    salesQuery = salesQuery.lte("date", endDate);
  }
  if (filters.sellerId) {
    salesQuery = salesQuery.eq("seller_id", filters.sellerId);
  }

  const { data: sales, error: salesError } = await salesQuery;

  if (salesError) {
    throw new Error(`Error al obtener ventas: ${salesError.message}`);
  }

  // Obtener pagos por vendedor
  let paymentsQuery = supabase
    .from("payments_sprint5")
    .select("amount, seller_id")
    .eq("tenant_id", filters.tenantId);

  if (filters.sellerId) {
    paymentsQuery = paymentsQuery.eq("seller_id", filters.sellerId);
  }

  const { data: payments, error: paymentsError } = await paymentsQuery;

  if (paymentsError) {
    throw new Error(`Error al obtener pagos: ${paymentsError.message}`);
  }

  // Agrupar por vendedor
  const vendorMap = new Map<string, SalesByVendor>();

  if (sales) {
    for (const sale of sales) {
      const sellerId = sale.seller_id;
      if (!sellerId) continue;

      const seller = sale.sellers as any;
      const sellerName = seller?.name || "Sin vendedor";

      if (!vendorMap.has(sellerId)) {
        vendorMap.set(sellerId, {
          sellerId,
          sellerName,
          totalSales: 0,
          totalAmount: 0,
          totalPaid: 0,
          difference: 0,
          ticketCount: 0,
        });
      }

      const vendor = vendorMap.get(sellerId)!;
      const total = parseFloat(sale.total || "0");
      vendor.totalSales += total;
      vendor.totalAmount += total;
      vendor.ticketCount++;
    }
  }

  // Agregar pagos
  if (payments) {
    for (const payment of payments) {
      const sellerId = payment.seller_id;
      if (!sellerId) continue;

      if (vendorMap.has(sellerId)) {
        const vendor = vendorMap.get(sellerId)!;
        const amount = parseFloat(payment.amount || "0");
        vendor.totalPaid += amount;
      }
    }
  }

  // Calcular diferencias
  const vendors = Array.from(vendorMap.values());
  for (const vendor of vendors) {
    vendor.difference = vendor.totalAmount - vendor.totalPaid;
  }

  // Ordenar por total vendido (descendente)
  return vendors.sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * 3. Ventas por Rubro
 */
export async function getSalesByCategory(
  filters: ReportFilters
): Promise<SalesByCategory[]> {
  const { startDate, endDate } = buildDateFilter(filters);

  // Primero obtener ventas confirmadas en el rango de fechas
  let salesQuery = supabase
    .from("sales")
    .select("id, date")
    .eq("tenant_id", filters.tenantId)
    .eq("status", "confirmed");

  if (startDate) {
    salesQuery = salesQuery.gte("date", startDate);
  }
  if (endDate) {
    salesQuery = salesQuery.lte("date", endDate);
  }

  const { data: sales, error: salesError } = await salesQuery;

  if (salesError) {
    throw new Error(`Error al obtener ventas: ${salesError.message}`);
  }

  const saleIds = sales?.map((s) => s.id) || [];

  if (saleIds.length === 0) {
    return [];
  }

  // Obtener items de venta con productos y categorías
  const { data: items, error } = await supabase
    .from("sale_items")
    .select(`
      total_price,
      product_id,
      products:product_id (
        id,
        category_id,
        categories:category_id (
          id,
          name
        )
      )
    `)
    .in("sale_id", saleIds);

  if (error) {
    throw new Error(`Error al obtener items: ${error.message}`);
  }

  // Agrupar por categoría
  const categoryMap = new Map<string, SalesByCategory>();
  const productSet = new Set<string>();

  if (items) {
    for (const item of items) {
      const product = item.products as any;
      const category = product?.categories as any;
      const categoryId = category?.id || "sin-categoria";
      const categoryName = category?.name || "Sin categoría";
      const totalPrice = parseFloat(item.total_price || "0");

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          categoryId,
          categoryName,
          totalAmount: 0,
          productCount: 0,
          percentage: 0,
        });
      }

      const cat = categoryMap.get(categoryId)!;
      cat.totalAmount += totalPrice;

      // Contar productos únicos
      const productId = product?.id;
      if (productId && !productSet.has(`${categoryId}-${productId}`)) {
        productSet.add(`${categoryId}-${productId}`);
        cat.productCount++;
      }
    }
  }

  // Calcular total y porcentajes
  const total = Array.from(categoryMap.values()).reduce(
    (sum, cat) => sum + cat.totalAmount,
    0
  );

  const categories = Array.from(categoryMap.values());
  for (const cat of categories) {
    cat.percentage = total > 0 ? (cat.totalAmount / total) * 100 : 0;
    cat.percentage = Math.round(cat.percentage * 100) / 100;
  }

  // Ordenar por total (descendente)
  return categories.sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * 4. Ticket por Ticket (Ventas completas)
 */
export async function getSalesTickets(
  filters: ReportFilters
): Promise<any[]> {
  const { startDate, endDate } = buildDateFilter(filters);

  let query = supabase
    .from("sales")
    .select(`
      *,
      customers:customer_id (
        id,
        name,
        document
      ),
      sellers:seller_id (
        id,
        name
      ),
      sale_items (
        id,
        product_id,
        quantity,
        unit_price,
        total_price,
        products:product_id (
          id,
          name_internal,
          sku
        )
      )
    `)
    .eq("tenant_id", filters.tenantId)
    .in("status", ["confirmed", "cancelled"]);

  if (startDate) {
    query = query.gte("date", startDate);
  }
  if (endDate) {
    query = query.lte("date", endDate);
  }
  if (filters.sellerId) {
    query = query.eq("seller_id", filters.sellerId);
  }
  if (filters.customerId) {
    query = query.eq("customer_id", filters.customerId);
  }

  query = query.order("date", { ascending: false });

  const { data: sales, error } = await query;

  if (error) {
    throw new Error(`Error al obtener ventas: ${error.message}`);
  }

  return sales || [];
}

/**
 * 5. Reporte de Ganancias
 */
export async function getProfitReport(
  filters: ReportFilters
): Promise<ProfitReport> {
  const { startDate, endDate } = buildDateFilter(filters);

  // Primero obtener ventas confirmadas en el rango de fechas
  let salesQuery = supabase
    .from("sales")
    .select("id, date")
    .eq("tenant_id", filters.tenantId)
    .eq("status", "confirmed");

  if (startDate) {
    salesQuery = salesQuery.gte("date", startDate);
  }
  if (endDate) {
    salesQuery = salesQuery.lte("date", endDate);
  }

  const { data: sales, error: salesError } = await salesQuery;

  if (salesError) {
    throw new Error(`Error al obtener ventas: ${salesError.message}`);
  }

  const saleIds = sales?.map((s) => s.id) || [];

  if (saleIds.length === 0) {
    return {
      totalRevenue: 0,
      totalCost: 0,
      grossProfit: 0,
      grossMargin: 0,
    };
  }

  // Obtener items de venta con costos
  const { data: items, error } = await supabase
    .from("sale_items")
    .select(`
      total_price,
      unit_cost,
      quantity
    `)
    .in("sale_id", saleIds);

  if (error) {
    throw new Error(`Error al obtener items: ${error.message}`);
  }

  let totalRevenue = 0;
  let totalCost = 0;

  if (items) {
    for (const item of items) {
      const revenue = parseFloat(item.total_price || "0");
      const cost = parseFloat(item.unit_cost || "0");
      const quantity = parseFloat(item.quantity || "0");

      totalRevenue += revenue;
      totalCost += cost * quantity;
    }
  }

  const grossProfit = totalRevenue - totalCost;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
  };
}

/**
 * 6. Auditoría de Stock
 */
export async function getStockAudit(
  filters: ReportFilters
): Promise<any[]> {
  const { startDate, endDate } = buildDateFilter(filters);

  let query = supabase
    .from("stock_movements")
    .select(`
      *,
      products:product_id (
        id,
        name_internal,
        sku
      )
    `)
    .eq("tenant_id", filters.tenantId);

  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  query = query.order("created_at", { ascending: false });

  const { data: movements, error } = await query;

  if (error) {
    throw new Error(`Error al obtener movimientos: ${error.message}`);
  }

  return movements || [];
}

/**
 * 7. Reposición por Proveedor
 */
export async function getReplenishmentReport(
  filters: ReportFilters
): Promise<any[]> {
  // Obtener productos con stock bajo
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(`
      id,
      name_internal,
      sku,
      store_id,
      product_stock:product_stock (
        stock_current,
        stock_min
      )
    `)
    .eq("store_id", filters.tenantId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (productsError) {
    throw new Error(`Error al obtener productos: ${productsError.message}`);
  }

  // Obtener compras recientes para determinar proveedor
  const { data: purchases, error: purchasesError } = await supabase
    .from("purchases")
    .select(`
      id,
      supplier_id,
      suppliers:supplier_id (
        id,
        name
      ),
      purchase_items (
        product_id
      )
    `)
    .eq("tenant_id", filters.tenantId)
    .order("purchase_date", { ascending: false })
    .limit(1000); // Últimas 1000 compras

  if (purchasesError) {
    throw new Error(`Error al obtener compras: ${purchasesError.message}`);
  }

  // Mapear productos a proveedores
  const productSupplierMap = new Map<string, string>();
  const productSupplierNameMap = new Map<string, string>();

  if (purchases) {
    for (const purchase of purchases) {
      const supplier = purchase.suppliers as any;
      const items = purchase.purchase_items as any[];
      if (items && supplier) {
        for (const item of items) {
          const productId = item.product_id;
          if (productId) {
            if (!productSupplierMap.has(productId)) {
              productSupplierMap.set(productId, supplier.id);
              productSupplierNameMap.set(productId, supplier.name);
            }
          }
        }
      }
    }
  }

  // Filtrar productos con stock bajo
  const replenishment: any[] = [];

  if (products) {
    for (const product of products) {
      const stock = product.product_stock as any;
      const stockCurrent = stock ? parseFloat(stock.stock_current || "0") : 0;
      const stockMin = stock ? parseFloat(stock.stock_min || "0") : 0;

      if (stockCurrent < stockMin) {
        const supplierId = productSupplierMap.get(product.id);
        const supplierName = productSupplierNameMap.get(product.id) || "Sin proveedor";

        replenishment.push({
          productId: product.id,
          productName: product.name_internal,
          productSku: product.sku,
          stockCurrent,
          stockMin,
          suggestedQuantity: stockMin * 2, // Sugerencia: 2x el mínimo
          supplierId: supplierId || null,
          supplierName,
        });
      }
    }
  }

  return replenishment;
}

/**
 * 8. Ventas Canceladas
 */
export async function getCancelledSales(
  filters: ReportFilters
): Promise<any[]> {
  const { startDate, endDate } = buildDateFilter(filters);

  let query = supabase
    .from("sales")
    .select(`
      *,
      customers:customer_id (
        id,
        name,
        document
      ),
      sellers:seller_id (
        id,
        name
      ),
      sale_items (
        id,
        product_id,
        quantity,
        unit_price,
        total_price,
        products:product_id (
          id,
          name_internal,
          sku
        )
      )
    `)
    .eq("tenant_id", filters.tenantId)
    .eq("status", "cancelled");

  if (startDate) {
    query = query.gte("date", startDate);
  }
  if (endDate) {
    query = query.lte("date", endDate);
  }
  if (filters.sellerId) {
    query = query.eq("seller_id", filters.sellerId);
  }
  if (filters.customerId) {
    query = query.eq("customer_id", filters.customerId);
  }

  query = query.order("updated_at", { ascending: false });

  const { data: sales, error } = await query;

  if (error) {
    throw new Error(`Error al obtener ventas canceladas: ${error.message}`);
  }

  // Calcular impacto económico
  const salesWithImpact = (sales || []).map((sale) => {
    const total = parseFloat(sale.total || "0");
    return {
      ...sale,
      economicImpact: total,
    };
  });

  return salesWithImpact;
}
