import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getProductCostHistory } from "@/lib/cost-history-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// SPRINT I: GET /api/products/:id/cost-history - Historial de costos del producto
export async function GET(
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

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Obtener historial de costos
    try {
      const history = await getProductCostHistory(params.id, tenantId);
      return jsonResponse(history, 200);
    } catch (error: any) {
      if (error.message.includes("no encontrado")) {
        return errorResponse("Producto no encontrado", 404);
      }
      if (error.message.includes("no pertenece")) {
        return errorResponse("El producto no pertenece al tenant", 403);
      }
      throw error;
    }
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/products/:id/cost-history");
  }
}
