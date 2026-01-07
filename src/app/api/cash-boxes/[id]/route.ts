/**
 * SPRINT B2: Endpoints para gestión de cajas diarias por ID
 * GET /api/cash-boxes/:id - Obtener caja específica
 */

import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { calculateCashBoxTotals } from "@/lib/cash-box-helpers";

// GET /api/cash-boxes/:id - Obtener caja específica con sus movimientos y totales
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

    // Obtener la caja
    const { data: cashBox, error: cashBoxError } = await supabase
      .from("cash_boxes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (cashBoxError || !cashBox) {
      return errorResponse("Caja no encontrada", 404);
    }

    // Obtener movimientos de la caja
    const { data: movements, error: movementsError } = await supabase
      .from("cash_movements")
      .select("*")
      .eq("cash_box_id", params.id)
      .order("created_at", { ascending: false });

    if (movementsError) {
      console.error("[GET /api/cash-boxes/:id] Error al obtener movimientos:", movementsError);
    }

    // Calcular totales
    let totals;
    try {
      totals = await calculateCashBoxTotals(params.id);
    } catch (error) {
      console.error("[GET /api/cash-boxes/:id] Error al calcular totales:", error);
      totals = {
        totalIncome: 0,
        totalExpense: 0,
        finalBalance: parseFloat(cashBox.opening_balance || "0"),
        incomeCash: 0,
        incomeTransfer: 0,
        expenseCash: 0,
        expenseTransfer: 0,
      };
    }

    return jsonResponse({
      ...cashBox,
      movements: movements || [],
      totals,
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/cash-boxes/:id");
  }
}
