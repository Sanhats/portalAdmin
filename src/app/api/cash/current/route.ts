/**
 * SPRINT 2: Endpoint para obtener caja actual
 * GET /api/cash/current
 */

import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getCashSessionSummary } from "@/lib/cash-session-helpers";

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId") || req.headers.get("x-seller-id");

    if (!sellerId) {
      return errorResponse("sellerId es requerido (query param o header x-seller-id)", 400);
    }

    // Obtener caja abierta
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

    return jsonResponse({
      ...cashSession,
      summary,
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/cash/current");
  }
}
