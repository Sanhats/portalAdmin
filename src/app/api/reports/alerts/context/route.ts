import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getAlertContext } from "@/lib/cost-history-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// SPRINT I: GET /api/reports/alerts/context - Contexto (causa raíz) de una alerta
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
    
    // Obtener parámetros requeridos
    const productId = searchParams.get("productId");
    const alertType = searchParams.get("alertType");

    // Validar parámetros
    if (!productId) {
      return errorResponse("productId es requerido", 400);
    }

    if (!alertType) {
      return errorResponse("alertType es requerido", 400);
    }

    const uuidValidation = uuidSchema.safeParse(productId);
    if (!uuidValidation.success) {
      return errorResponse("productId debe ser un UUID válido", 400);
    }

    if (alertType !== "LOW_MARGIN" && alertType !== "NEGATIVE_MARGIN") {
      return errorResponse("alertType debe ser 'LOW_MARGIN' o 'NEGATIVE_MARGIN'", 400);
    }

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

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Obtener contexto de la alerta
    try {
      const context = await getAlertContext(productId, tenantId, alertType as "LOW_MARGIN" | "NEGATIVE_MARGIN");
      return jsonResponse(context, 200);
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
    return handleUnexpectedError(error, "GET /api/reports/alerts/context");
  }
}
