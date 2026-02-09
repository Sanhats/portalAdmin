/**
 * Endpoint para listar vendedores (alias de /api/sellers)
 * GET /api/users/sellers - Listar vendedores
 */

import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// GET /api/users/sellers - Listar vendedores
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
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido (query param o header x-tenant-id)", 400);
    }

    const { data, error } = await supabase
      .from("sellers")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/users/sellers] Error:", error);
      return errorResponse("Error al obtener vendedores", 500, error.message, error.code);
    }

    return jsonResponse(data || []);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/users/sellers");
  }
}
