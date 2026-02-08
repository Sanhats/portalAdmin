import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { cancelSale } from "@/lib/sale-helpers-sprint4";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// POST /api/sales/:id/cancel - Cancelar venta y revertir stock (si estaba confirmada)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }
    
    // Obtener tenant_id
    const { searchParams } = new URL(req.url);
    let tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");
    
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
    
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }
    
    // SPRINT 4: Usar helper para cancelar venta
    const result = await cancelSale(params.id, tenantId);
    
    if (!result.success) {
      return errorResponse(result.error || "Error al cancelar la venta", 400);
    }
    
    // Obtener la venta completa con items y customer
    const { data: saleWithItems, error: fetchError } = await supabase
      .from("sales")
      .select(`
        *,
        customers:customer_id (
          id,
          name,
          document,
          email,
          phone
        ),
        sale_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          total_price,
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
      .eq("id", params.id)
      .single();
    
    if (fetchError || !saleWithItems) {
      console.error("[POST /api/sales/:id/cancel] Error al obtener venta completa:", fetchError);
      return errorResponse("Error al obtener la venta cancelada", 500, fetchError?.message);
    }
    
    return jsonResponse(saleWithItems);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/sales/:id/cancel");
  }
}

