/**
 * SPRINT 2: Endpoint para abrir caja
 * POST /api/cash/open
 */

import { supabase } from "@/lib/supabase";
import { openCashSessionSchema } from "@/validations/cash-session";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { validateNoOpenCashSession } from "@/lib/cash-session-helpers";

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
    const parsed = openCashSessionSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    const tenantId = body.tenantId || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Validar que no haya caja abierta
    const validation = await validateNoOpenCashSession(parsed.data.sellerId);
    if (!validation.valid) {
      return errorResponse(validation.error || "Error de validación", 400);
    }

    // Verificar que el vendedor existe y está activo
    const { data: seller, error: sellerError } = await supabase
      .from("sellers")
      .select("id, active")
      .eq("id", parsed.data.sellerId)
      .single();

    if (sellerError || !seller) {
      return errorResponse("Vendedor no encontrado", 404);
    }

    if (!seller.active) {
      return errorResponse("El vendedor está inactivo", 400);
    }

    const openingAmount = typeof parsed.data.openingAmount === "number"
      ? parsed.data.openingAmount.toString()
      : parsed.data.openingAmount || "0";

    const { data, error } = await supabase
      .from("cash_sessions")
      .insert({
        tenant_id: tenantId,
        seller_id: parsed.data.sellerId,
        opening_amount: openingAmount,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /api/cash/open] Error:", error);
      return errorResponse("Error al abrir caja", 500, error.message, error.code);
    }

    return jsonResponse(data, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/cash/open");
  }
}
