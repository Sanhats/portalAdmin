/**
 * SPRINT 13: Helpers para alertas de stock y sugerencias de reposición
 * Gestión inteligente de stock con detección automática de alertas
 */

import { supabase } from "@/lib/supabase";

export interface StockAlert {
  id: string;
  tenantId: string;
  branchId: string;
  productId: string;
  currentStock: number;
  minStock: number;
  alertType: "LOW_STOCK" | "OUT_OF_STOCK";
  status: "ACTIVE" | "RESOLVED";
  createdAt: string;
  resolvedAt?: string;
  // Relaciones
  product?: {
    id: string;
    nameInternal: string;
    sku: string;
  };
  branch?: {
    id: string;
    name: string;
  };
}

export interface StockAlertSummary {
  total: number;
  active: number;
  resolved: number;
  byType: {
    LOW_STOCK: number;
    OUT_OF_STOCK: number;
  };
  byStatus: {
    ACTIVE: number;
    RESOLVED: number;
  };
}

export interface StockConfig {
  minStock?: number | null;
  idealStock?: number | null;
  reorderEnabled: boolean;
}

export interface ReplenishmentSuggestion {
  productId: string;
  branchId: string;
  product: {
    id: string;
    nameInternal: string;
    sku: string;
  };
  branch: {
    id: string;
    name: string;
  };
  currentStock: number;
  idealStock: number;
  minStock: number;
  suggestedQuantity: number;
  supplier?: {
    id: string;
    name: string;
  };
}

/**
 * Obtiene alertas de stock con filtros
 */
export async function getStockAlerts(
  tenantId: string,
  filters?: {
    branchId?: string;
    productId?: string;
    alertType?: "LOW_STOCK" | "OUT_OF_STOCK";
    status?: "ACTIVE" | "RESOLVED";
  }
): Promise<StockAlert[]> {
  let query = supabase
    .from("stock_alerts")
    .select(`
      *,
      products:product_id (
        id,
        name_internal,
        sku
      ),
      branches:branch_id (
        id,
        name
      )
    `)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (filters?.branchId) {
    query = query.eq("branch_id", filters.branchId);
  }

  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters?.alertType) {
    query = query.eq("alert_type", filters.alertType);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error al obtener alertas: ${error.message}`);
  }

  return (data || []).map((alert: any) => ({
    id: alert.id,
    tenantId: alert.tenant_id,
    branchId: alert.branch_id,
    productId: alert.product_id,
    currentStock: alert.current_stock,
    minStock: alert.min_stock,
    alertType: alert.alert_type,
    status: alert.status,
    createdAt: alert.created_at,
    resolvedAt: alert.resolved_at,
    product: alert.products ? {
      id: alert.products.id,
      nameInternal: alert.products.name_internal,
      sku: alert.products.sku,
    } : undefined,
    branch: alert.branches ? {
      id: alert.branches.id,
      name: alert.branches.name,
    } : undefined,
  }));
}

/**
 * Obtiene resumen de alertas de stock
 */
export async function getStockAlertsSummary(
  tenantId: string,
  branchId?: string
): Promise<StockAlertSummary> {
  let query = supabase
    .from("stock_alerts")
    .select("alert_type, status")
    .eq("tenant_id", tenantId);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Error al obtener resumen de alertas: ${error.message}`);
  }

  const alerts = data || [];

  const summary: StockAlertSummary = {
    total: alerts.length,
    active: alerts.filter((a) => a.status === "ACTIVE").length,
    resolved: alerts.filter((a) => a.status === "RESOLVED").length,
    byType: {
      LOW_STOCK: alerts.filter((a) => a.alert_type === "LOW_STOCK").length,
      OUT_OF_STOCK: alerts.filter((a) => a.alert_type === "OUT_OF_STOCK").length,
    },
    byStatus: {
      ACTIVE: alerts.filter((a) => a.status === "ACTIVE").length,
      RESOLVED: alerts.filter((a) => a.status === "RESOLVED").length,
    },
  };

  return summary;
}

/**
 * Obtiene o crea configuración de stock para un producto en una sucursal
 */
export async function getStockConfig(
  tenantId: string,
  branchId: string,
  productId: string
): Promise<StockConfig | null> {
  const { data, error } = await supabase
    .from("product_stock_branches")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("product_id", productId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No existe configuración, retornar null
      return null;
    }
    throw new Error(`Error al obtener configuración: ${error.message}`);
  }

  return {
    minStock: data.min_stock,
    idealStock: data.ideal_stock,
    reorderEnabled: data.reorder_enabled,
  };
}

/**
 * Actualiza o crea configuración de stock para un producto en una sucursal
 */
export async function updateStockConfig(
  tenantId: string,
  branchId: string,
  productId: string,
  config: StockConfig
): Promise<{ success: boolean; error?: string; config?: StockConfig }> {
  try {
    // Verificar que el producto existe
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("store_id", tenantId)
      .single();

    if (productError || !product) {
      return { success: false, error: "Producto no encontrado" };
    }

    // Verificar que la sucursal existe
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("id")
      .eq("id", branchId)
      .eq("tenant_id", tenantId)
      .single();

    if (branchError || !branch) {
      return { success: false, error: "Sucursal no encontrada" };
    }

    // Upsert configuración
    const { data, error } = await supabase
      .from("product_stock_branches")
      .upsert({
        tenant_id: tenantId,
        branch_id: branchId,
        product_id: productId,
        min_stock: config.minStock ?? null,
        ideal_stock: config.idealStock ?? null,
        reorder_enabled: config.reorderEnabled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "branch_id,product_id",
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: `Error al actualizar configuración: ${error.message}` };
    }

    // Disparar detección de alertas si se modificó min_stock
    if (config.minStock !== undefined) {
      // Llamar a la función SQL para detectar alertas
      const { error: alertError } = await supabase.rpc("detect_stock_alert", {
        p_tenant_id: tenantId,
        p_branch_id: branchId,
        p_product_id: productId,
      });

      if (alertError) {
        console.warn("[updateStockConfig] Error al detectar alertas:", alertError);
        // No fallar, solo loguear
      }
    }

    return {
      success: true,
      config: {
        minStock: data.min_stock,
        idealStock: data.ideal_stock,
        reorderEnabled: data.reorder_enabled,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al actualizar configuración" };
  }
}

/**
 * Calcula stock actual por sucursal
 */
export async function getStockByBranch(
  productId: string,
  branchId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("get_stock_by_branch", {
    p_product_id: productId,
    p_branch_id: branchId,
  });

  if (error) {
    throw new Error(`Error al calcular stock: ${error.message}`);
  }

  return data || 0;
}

/**
 * Obtiene sugerencias de reposición
 */
export async function getReplenishmentSuggestions(
  tenantId: string,
  branchId?: string
): Promise<ReplenishmentSuggestion[]> {
  // Obtener configuraciones con reorder_enabled = true
  let configQuery = supabase
    .from("product_stock_branches")
    .select(`
      *,
      products:product_id (
        id,
        name_internal,
        sku
      ),
      branches:branch_id (
        id,
        name
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("reorder_enabled", true)
    .not("ideal_stock", "is", null)
    .gt("ideal_stock", 0);

  if (branchId) {
    configQuery = configQuery.eq("branch_id", branchId);
  }

  const { data: configs, error: configError } = await configQuery;

  if (configError) {
    throw new Error(`Error al obtener configuraciones: ${configError.message}`);
  }

  if (!configs || configs.length === 0) {
    return [];
  }

  // Calcular stock actual y sugerencias para cada configuración
  const suggestions: ReplenishmentSuggestion[] = [];

  for (const config of configs) {
    const currentStock = await getStockByBranch(config.product_id, config.branch_id);
    const idealStock = config.ideal_stock || 0;

    // Solo sugerir si stock actual < ideal_stock
    if (currentStock < idealStock) {
      const suggestedQuantity = idealStock - currentStock;

      // Obtener proveedor sugerido (última compra del producto)
      const { data: purchaseItems } = await supabase
        .from("purchase_items")
        .select(`
          purchase_id,
          purchases:purchase_id (
            id,
            supplier_id,
            suppliers:supplier_id (
              id,
              name
            )
          )
        `)
        .eq("product_id", config.product_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastPurchase = purchaseItems?.purchases as any;

      const supplier = lastPurchase?.suppliers as any;

      suggestions.push({
        productId: config.product_id,
        branchId: config.branch_id,
        product: config.products ? {
          id: config.products.id,
          nameInternal: config.products.name_internal,
          sku: config.products.sku,
        } : {
          id: config.product_id,
          nameInternal: "Producto desconocido",
          sku: "",
        },
        branch: config.branches ? {
          id: config.branches.id,
          name: config.branches.name,
        } : {
          id: config.branch_id,
          name: "Sucursal desconocida",
        },
        currentStock,
        idealStock,
        minStock: config.min_stock || 0,
        suggestedQuantity,
        supplier: supplier ? {
          id: supplier.id,
          name: supplier.name,
        } : undefined,
      });
    }
  }

  // Ordenar por cantidad sugerida (mayor primero)
  return suggestions.sort((a, b) => b.suggestedQuantity - a.suggestedQuantity);
}
