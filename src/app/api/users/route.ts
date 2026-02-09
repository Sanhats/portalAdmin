/**
 * Endpoints para gestionar vendedores (alias de /api/sellers)
 * POST /api/users - Crear vendedor
 */

import { supabase } from "@/lib/supabase";
import { createSellerSchema } from "@/validations/seller";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// POST /api/users - Crear vendedor
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
    const parsed = createSellerSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Obtener tenant_id
    const tenantId = body.tenantId || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido (body o header x-tenant-id)", 400);
    }

    const { data, error } = await supabase
      .from("sellers")
      .insert({
        tenant_id: tenantId,
        name: parsed.data.name,
        active: parsed.data.active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/users] Error:", error);
      return errorResponse("Error al crear vendedor", 500, error.message, error.code);
    }

    return jsonResponse(data, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/users");
  }
}
