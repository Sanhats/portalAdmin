import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { createPurchaseSchema } from "@/validations/purchase";
import { createPurchaseWithTransaction } from "@/lib/purchase-helpers-sprint3";

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

    // SPRINT 3: Construir query con nuevos campos
    let query = supabase
      .from("purchases")
      .select(`
        *,
        suppliers (
          id,
          name,
          contact_name,
          email,
          phone
        ),
        purchase_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_cost,
          subtotal,
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
      .order("purchase_date", { ascending: false }) // SPRINT 3: Ordenar por purchase_date
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
      
      if (!defaultStore || !defaultStore.id) {
        return errorResponse("No se encontró store por defecto. Proporciona tenantId", 400);
      }
      
      tenantId = defaultStore.id;
    }

    // Validar que tenantId no sea null
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Validar datos
    const parsed = createPurchaseSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // SPRINT 3: Crear compra con transacción completa usando helper
    try {
      const result = await createPurchaseWithTransaction(
        tenantId,
        parsed.data.supplierId,
        parsed.data.purchaseDate,
        parsed.data.invoiceNumber || null,
        parsed.data.notes || null,
        parsed.data.items
      );

      const purchase = result.purchase;

      // Obtener compra completa con relaciones
      const { data: purchaseWithRelations } = await supabase
        .from("purchases")
        .select(`
          *,
          suppliers (
            id,
            name,
            contact_name,
            email,
            phone
          ),
          purchase_items (
            id,
            product_id,
            variant_id,
            quantity,
            unit_cost,
            subtotal,
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
    } catch (error: any) {
      console.error("[POST /api/purchases] Error:", error);
      return errorResponse(
        error.message || "Error al crear compra",
        500,
        error.message
      );
    }
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/purchases");
  }
}
