import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// GET /api/cash-registers/:id - Obtener caja por ID
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

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Obtener caja
    const { data: cashRegister, error } = await supabase
      .from("cash_registers")
      .select(`
        *,
        sellers:seller_id (
          id,
          name
        )
      `)
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !cashRegister) {
      return errorResponse("Caja no encontrada", 404);
    }

    return jsonResponse(cashRegister);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/cash-registers/:id");
  }
}
