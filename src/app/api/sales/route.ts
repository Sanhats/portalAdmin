import { supabase } from "@/lib/supabase";
import { createSaleSchema } from "@/validations/sale";
import { jsonResponse, errorResponse, handleUnexpectedError, validatePagination } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { calculateSaleTotals, prepareSaleItems } from "@/lib/sale-helpers";
import { SALE_STATUSES } from "@/lib/sale-constants";
import { z } from "zod";

// GET /api/sales - Listar ventas con filtros y paginación
export async function GET(req: Request) {
  try {
    // Verificar autenticación
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      return errorResponse("No autorizado. Token Bearer requerido", 401);
    }
    
    const user = await validateBearerToken(token);
    if (!user) {
      return errorResponse("No autorizado. Token inválido o expirado", 401);
    }

    const { searchParams } = new URL(req.url);
    
    // Obtener tenant_id del query param o header
    let tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      // Usar store por defecto
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (!defaultStore) {
        return errorResponse("No se encontró store por defecto. Proporciona tenantId", 400);
      }
      
      tenantId = defaultStore.id;
    }

    // Validar paginación
    let pagination;
    try {
      pagination = validatePagination(
        searchParams.get("page"),
        searchParams.get("limit"),
        false
      );
    } catch (error: any) {
      return errorResponse(`Parámetros de paginación inválidos: ${error.message}`, 400);
    }
    
    const { page, limit, offset } = pagination;
    
    // Filtros
    const status = searchParams.get("status");
    
    // Construir query
    let query = supabase
      .from("sales")
      .select(`
        *,
        sale_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          subtotal,
          products:product_id (
            id,
            sku,
            name_internal,
            price
          ),
          variants:variant_id (
            id,
            name,
            value
          )
        )
      `, { count: "exact" })
      .eq("tenant_id", tenantId);
    
    // Aplicar filtro de status
    if (status) {
      query = query.eq("status", status);
    }
    
    // Aplicar paginación
    if (limit !== "all") {
      query = query.range(offset, offset + limit - 1);
    }
    
    // Ordenar por fecha de creación (más recientes primero)
    query = query.order("created_at", { ascending: false });
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error("[GET /api/sales] Error de Supabase:", error);
      return errorResponse("Error al obtener las ventas", 500, error.message, error.code);
    }
    
    const total = count || 0;
    const totalPages = limit === "all" ? 1 : Math.ceil(total / (limit as number));
    
    return jsonResponse({
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/sales");
  }
}

// POST /api/sales - Crear venta (draft)
export async function POST(req: Request) {
  try {
    // Verificar autenticación
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      return errorResponse("No autorizado. Token Bearer requerido", 401);
    }
    
    const user = await validateBearerToken(token);
    if (!user) {
      return errorResponse("No autorizado. Token inválido o expirado", 401);
    }

    const body = await req.json();
    console.log("[POST /api/sales] Body recibido:", JSON.stringify(body, null, 2));
    
    // Obtener tenant_id del body o header
    let tenantId = body.tenantId || req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      // Usar store por defecto
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (!defaultStore) {
        return errorResponse("No se encontró store por defecto. Proporciona tenantId en el body o header x-tenant-id", 400);
      }
      
      tenantId = defaultStore.id;
    }
    
    // Validar datos
    const parsed = createSaleSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[POST /api/sales] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    const { items, paymentMethod, notes, status, subtotal, taxes, discounts } = parsed.data;
    
    // Validar que todos los productos existan y estén activos
    const productIds = items.map(item => item.productId);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, stock, is_active, price")
      .in("id", productIds)
      .is("deleted_at", null);
    
    if (productsError) {
      console.error("[POST /api/sales] Error al validar productos:", productsError);
      return errorResponse("Error al validar productos", 500, productsError.message);
    }
    
    if (!products || products.length !== productIds.length) {
      return errorResponse("Uno o más productos no existen o fueron eliminados", 400);
    }
    
    // Validar que todos los productos estén activos
    const inactiveProducts = products.filter(p => !p.is_active);
    if (inactiveProducts.length > 0) {
      return errorResponse("Uno o más productos están inactivos", 400);
    }
    
    // Validar variantes si se proporcionan
    const variantIds = items
      .map(item => item.variantId)
      .filter((id): id is string => id !== null && id !== undefined);
    
    if (variantIds.length > 0) {
      const { data: variants, error: variantsError } = await supabase
        .from("variants")
        .select("id, product_id")
        .in("id", variantIds);
      
      if (variantsError) {
        console.error("[POST /api/sales] Error al validar variantes:", variantsError);
        return errorResponse("Error al validar variantes", 500, variantsError.message);
      }
      
      if (!variants || variants.length !== variantIds.length) {
        return errorResponse("Uno o más variantes no existen", 400);
      }
      
      // Validar que las variantes pertenezcan a los productos correctos
      for (const item of items) {
        if (item.variantId) {
          const variant = variants.find(v => v.id === item.variantId);
          const product = products.find(p => p.id === item.productId);
          if (variant && product && variant.product_id !== product.id) {
            return errorResponse(`La variante ${item.variantId} no pertenece al producto ${item.productId}`, 400);
          }
        }
      }
    }
    
    // SPRINT A: Preparar items con snapshot y calcular totales
    let preparedItems;
    try {
      preparedItems = await prepareSaleItems(items);
    } catch (snapshotError: any) {
      console.error("[POST /api/sales] Error al obtener snapshot:", snapshotError);
      return errorResponse("Error al obtener información de productos", 500, snapshotError.message);
    }
    
    // SPRINT A: Calcular totales
    const totals = await calculateSaleTotals(items, subtotal, taxes, discounts);
    
    // Crear la venta con totales persistidos
    const saleStatus = status || SALE_STATUSES.DRAFT;
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        tenant_id: tenantId,
        status: saleStatus,
        subtotal: totals.subtotal.toString(),
        taxes: totals.taxes.toString(),
        discounts: totals.discounts.toString(),
        total_amount: totals.totalAmount.toString(),
        cost_amount: totals.costAmount.toString(),
        payment_method: paymentMethod || null,
        notes: notes || null,
        created_by: user.id,
        payment_status: null,
        external_reference: null,
        paid_amount: "0",
        balance_amount: totals.totalAmount.toString(),
      })
      .select()
      .single();
    
    if (saleError || !sale) {
      console.error("[POST /api/sales] Error al crear venta:", saleError);
      return errorResponse("Error al crear la venta", 500, saleError?.message, saleError?.code);
    }
    
    // SPRINT A: Crear los items de la venta con snapshot
    const saleItemsWithSaleId = preparedItems.map(item => ({
      sale_id: sale.id,
      product_id: item.productId,
      variant_id: item.variantId || null,
      quantity: item.quantity,
      product_name: item.productName,
      product_sku: item.productSku,
      variant_name: item.variantName || null,
      variant_value: item.variantValue || null,
      unit_price: (typeof item.unitPrice === "string" ? item.unitPrice : item.unitPrice.toString()),
      unit_cost: item.unitCost ? (typeof item.unitCost === "string" ? item.unitCost : item.unitCost.toString()) : null,
      unit_tax: item.unitTax || "0",
      unit_discount: item.unitDiscount || "0",
      subtotal: item.subtotal.toString(),
      stock_impacted: item.stockImpacted,
    }));
    
    const { error: itemsError } = await supabase
      .from("sale_items")
      .insert(saleItemsWithSaleId);
    
    if (itemsError) {
      // Si falla, eliminar la venta creada
      await supabase.from("sales").delete().eq("id", sale.id);
      console.error("[POST /api/sales] Error al crear items:", itemsError);
      return errorResponse("Error al crear los items de la venta", 500, itemsError.message, itemsError.code);
    }
    
    // SPRINT A: Obtener la venta completa con items y snapshot
    const { data: saleWithItems, error: fetchError } = await supabase
      .from("sales")
      .select(`
        *,
        sale_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          subtotal,
          product_name,
          product_sku,
          variant_name,
          variant_value,
          unit_cost,
          unit_tax,
          unit_discount,
          stock_impacted,
          products:product_id (
            id,
            sku,
            name_internal,
            price
          ),
          variants:variant_id (
            id,
            name,
            value
          )
        )
      `)
      .eq("id", sale.id)
      .single();
    
    if (fetchError || !saleWithItems) {
      console.error("[POST /api/sales] Error al obtener venta completa:", fetchError);
      // La venta se creó, pero no pudimos obtenerla completa, retornar la básica
      return jsonResponse(sale);
    }
    
    return jsonResponse(saleWithItems, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/sales");
  }
}

