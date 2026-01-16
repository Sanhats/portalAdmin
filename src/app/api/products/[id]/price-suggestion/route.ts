import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getPriceSuggestion } from "@/lib/cost-history-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// SPRINT I: GET /api/products/:id/price-suggestion - Sugerencia de precio por margen objetivo
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

    // Obtener parámetro targetMargin (opcional, default: 20)
    const { searchParams } = new URL(req.url);
    const targetMarginParam = searchParams.get("targetMargin");
    
    let targetMargin = 20; // Default: 20%
    if (targetMarginParam) {
      const margin = parseFloat(targetMarginParam);
      if (isNaN(margin) || margin < 0 || margin >= 100) {
        return errorResponse("targetMargin debe ser un número entre 0 y 100", 400);
      }
      targetMargin = margin;
    }

    // Obtener sugerencia de precio
    try {
      const suggestion = await getPriceSuggestion(params.id, tenantId, targetMargin);
      return jsonResponse(suggestion, 200);
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
    return handleUnexpectedError(error, "GET /api/products/:id/price-suggestion");
  }
}
