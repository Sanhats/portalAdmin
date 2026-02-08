import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { closeCashRegisterSchema } from "@/validations/cash-register";
import { closeCashRegister } from "@/lib/cash-helpers-sprint6";

// POST /api/cash-registers/:id/close - Cerrar caja
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

    const body = await req.json();
    const { searchParams } = new URL(req.url);
    let tenantId: string | null = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Validar datos
    const parsed = closeCashRegisterSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Normalizar closingAmount
    const closingAmount = typeof parsed.data.closingAmount === "string"
      ? parseFloat(parsed.data.closingAmount)
      : parsed.data.closingAmount;

    // Cerrar caja (tenantId ya validado, no puede ser null)
    const result = await closeCashRegister(params.id, tenantId, closingAmount);
    
    if (!result.success) {
      return errorResponse(result.error || "Error al cerrar caja", 400);
    }

    // Obtener caja cerrada con cierre
    const { data: cashRegister, error: fetchError } = await supabase
      .from("cash_registers")
      .select(`
        *,
        sellers:seller_id (
          id,
          name
        )
      `)
      .eq("id", params.id)
      .single();

    if (fetchError || !cashRegister) {
      return errorResponse("Error al obtener caja", 500, fetchError?.message);
    }

    // Obtener cierre
    const { data: closure, error: closureError } = await supabase
      .from("cash_closures")
      .select("*")
      .eq("cash_register_id", params.id)
      .single();

    return jsonResponse({
      cashRegister,
      closure: closure || result.closure,
    });
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/cash-registers/:id/close");
  }
}
