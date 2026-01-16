import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// POST /api/purchases/:id/confirm - Confirmar compra (pasa de draft a confirmed)
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

    // Obtener tenant_id del header o usar default
    let tenantId: string | null = req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (defaultStore) {
        tenantId = defaultStore.id;
      }
    }

    // Obtener compra actual
    let query = supabase
      .from("purchases")
      .select("*")
      .eq("id", params.id);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: purchase, error: fetchError } = await query.single();

    if (fetchError || !purchase) {
      return errorResponse("Compra no encontrada", 404);
    }

    // Solo se puede confirmar si está en draft
    if (purchase.status !== "draft") {
      return errorResponse("Solo se pueden confirmar compras en estado draft", 400);
    }

    // Actualizar estado a confirmed
    const { data: updatedPurchase, error: updateError } = await supabase
      .from("purchases")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("[POST /api/purchases/:id/confirm] Error al confirmar compra:", updateError);
      return errorResponse("Error al confirmar compra", 500, updateError.message, updateError.code);
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
      .eq("id", params.id)
      .single();

    return jsonResponse(purchaseWithRelations);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/purchases/:id/confirm");
  }
}
