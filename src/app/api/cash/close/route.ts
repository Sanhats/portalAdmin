/**
 * SPRINT 2: Endpoint para cerrar caja
 * POST /api/cash/close
 */

import { supabase } from "@/lib/supabase";
import { closeCashSessionSchema } from "@/validations/cash-session";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getCashSessionSummary } from "@/lib/cash-session-helpers";

export async function POST(req: Request) {
  try {
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
    const parsed = closeCashSessionSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    const sellerId = body.sellerId || req.headers.get("x-seller-id");

    if (!sellerId) {
      return errorResponse("sellerId es requerido", 400);
    }

    // Obtener caja abierta del vendedor
    const { data: cashSession, error: sessionError } = await supabase
      .from("cash_sessions")
      .select("*")
      .eq("seller_id", sellerId)
      .eq("status", "open")
      .single();

    if (sessionError || !cashSession) {
      return errorResponse("No hay caja abierta para este vendedor", 404);
    }

    // Obtener resumen
    const summary = await getCashSessionSummary(cashSession.id);

    // Usar closing_amount proporcionado o calcular
    const closingAmount = parsed.data.closingAmount
      ? (typeof parsed.data.closingAmount === "number"
          ? parsed.data.closingAmount.toString()
          : parsed.data.closingAmount)
      : summary.calculatedClosing.toString();

    // Cerrar caja
    const { data: updated, error: updateError } = await supabase
      .from("cash_sessions")
      .update({
        status: "closed",
        closing_amount: closingAmount,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", cashSession.id)
      .select()
      .single();

    if (updateError) {
      console.error("[POST /api/cash/close] Error:", updateError);
      return errorResponse("Error al cerrar caja", 500, updateError.message, updateError.code);
    }

    return jsonResponse({
      ...updated,
      summary: {
        ...summary,
        actualClosing: parseFloat(closingAmount),
        difference: parseFloat(closingAmount) - summary.calculatedClosing,
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/cash/close");
  }
}
