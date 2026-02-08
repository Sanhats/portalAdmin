import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// GET /api/cash-closures/:cashRegisterId - Obtener cierre de caja
export async function GET(
  req: Request,
  { params }: { params: { cashRegisterId: string } }
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

    // Obtener cierre
    const { data: closure, error } = await supabase
      .from("cash_closures")
      .select(`
        *,
        cash_registers:cash_register_id (
          id,
          seller_id,
          opened_at,
          closed_at,
          opening_amount,
          closing_amount,
          status,
          sellers:seller_id (
            id,
            name
          )
        )
      `)
      .eq("cash_register_id", params.cashRegisterId)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !closure) {
      return errorResponse("Cierre no encontrado", 404);
    }

    return jsonResponse(closure);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/cash-closures/:cashRegisterId");
  }
}
