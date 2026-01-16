import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { createPurchaseSchema } from "@/validations/purchase";
import { calculatePurchaseTotals, preparePurchaseItems } from "@/lib/purchase-helpers";

// GET /api/purchases - Listar compras
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
    let tenantId: string | null = searchParams.get("tenantId") || req.headers.get("x-tenant-id");
    
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

    // Asegurar que tenantId es string (TypeScript)
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Paginación
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Filtros
    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");

    // Construir query
    let query = supabase
      .from("purchases")
      .select(`
        *,
        suppliers (
          id,
          name,
          email,
          phone
        ),
        purchase_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_cost,
          total_cost,
          products (
            id,
            name_internal,
            sku
          ),
          variants (
            id,
            name,
            value
          )
        )
      `, { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar filtros
    if (status) {
      query = query.eq("status", status);
    }
    if (supplierId) {
      query = query.eq("supplier_id", supplierId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/purchases] Error al obtener compras:", error);
      return errorResponse("Error al obtener compras", 500, error.message, error.code);
    }

    return jsonResponse({
      purchases: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/purchases");
  }
}

// POST /api/purchases - Crear compra
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

    // Obtener tenant_id del body, header o usar default
    let tenantId: string | null = body.tenantId || req.headers.get("x-tenant-id");
    
    if (!tenantId) {
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

    // Validar datos
    const parsed = createPurchaseSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Verificar que el proveedor existe
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("id, tenant_id")
      .eq("id", parsed.data.supplierId)
      .is("deleted_at", null)
      .single();

    if (supplierError || !supplier) {
      return errorResponse("Proveedor no encontrado", 404);
    }

    if (supplier.tenant_id !== tenantId) {
      return errorResponse("El proveedor no pertenece al tenant", 403);
    }

    // Preparar items
    const preparedItems = await preparePurchaseItems(parsed.data.items);
    
    // Calcular totales
    const totals = await calculatePurchaseTotals(
      parsed.data.items,
      parsed.data.subtotal
    );

    // Crear compra
    const { data: purchase, error: createError } = await supabase
      .from("purchases")
      .insert({
        tenant_id: tenantId,
        supplier_id: parsed.data.supplierId,
        status: parsed.data.status || "draft",
        subtotal: totals.subtotal.toString(),
        total_cost: totals.totalCost.toString(),
        notes: parsed.data.notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("[POST /api/purchases] Error al crear compra:", createError);
      return errorResponse("Error al crear compra", 500, createError.message, createError.code);
    }

    // Crear items de compra
    const purchaseItems = preparedItems.map(item => ({
      purchase_id: purchase.id,
      product_id: item.productId,
      variant_id: item.variantId || null,
      quantity: item.quantity,
      unit_cost: typeof item.unitCost === "string" ? item.unitCost : item.unitCost.toString(),
      total_cost: item.totalCost.toString(),
    }));

    const { error: itemsError } = await supabase
      .from("purchase_items")
      .insert(purchaseItems);

    if (itemsError) {
      console.error("[POST /api/purchases] Error al crear items de compra:", itemsError);
      // Intentar eliminar la compra creada
      await supabase.from("purchases").delete().eq("id", purchase.id);
      return errorResponse("Error al crear items de compra", 500, itemsError.message, itemsError.code);
    }

    // Obtener compra completa con relaciones
    const { data: purchaseWithRelations } = await supabase
      .from("purchases")
      .select(`
        *,
        suppliers (
          id,
          name,
          email,
          phone
        ),
        purchase_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_cost,
          total_cost,
          products (
            id,
            name_internal,
            sku
          ),
          variants (
            id,
            name,
            value
          )
        )
      `)
      .eq("id", purchase.id)
      .single();

    return jsonResponse(purchaseWithRelations, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/purchases");
  }
}
