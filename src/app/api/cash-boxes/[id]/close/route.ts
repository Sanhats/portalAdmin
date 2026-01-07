/**
 * SPRINT B2: Endpoint para cerrar una caja diaria
 * PATCH /api/cash-boxes/:id/close - Cerrar caja y calcular totales
 */

import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { calculateCashBoxTotals } from "@/lib/cash-box-helpers";

// PATCH /api/cash-boxes/:id/close - Cerrar caja
export async function PATCH(
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

    // Obtener la caja
    const { data: cashBox, error: cashBoxError } = await supabase
      .from("cash_boxes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (cashBoxError || !cashBox) {
      return errorResponse("Caja no encontrada", 404);
    }

    // Verificar que la caja esté abierta
    if (cashBox.status !== "open") {
      return errorResponse(`La caja ya está cerrada (estado: ${cashBox.status})`, 400);
    }

    // Calcular totales
    const totals = await calculateCashBoxTotals(params.id);

    // Actualizar la caja: cerrar y establecer saldo final
    const { data: updatedCashBox, error: updateError } = await supabase
      .from("cash_boxes")
      .update({
        status: "closed",
        closing_balance: totals.finalBalance.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/cash-boxes/:id/close] Error al cerrar caja:", updateError);
      return errorResponse("Error al cerrar caja", 500);
    }

    // Obtener movimientos para la respuesta
    const { data: movements } = await supabase
      .from("cash_movements")
      .select("*")
      .eq("cash_box_id", params.id)
      .order("created_at", { ascending: false });

    return jsonResponse({
      ...updatedCashBox,
      movements: movements || [],
      totals,
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "PATCH /api/cash-boxes/:id/close");
  }
}
