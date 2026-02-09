/**
 * SPRINT 13: Endpoint para resumen de alertas de stock
 * GET /api/stock/alerts/summary - Resumen de alertas
 */

import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getStockAlertsSummary } from "@/lib/stock-alerts-helpers-sprint13";

// GET /api/stock/alerts/summary - Resumen de alertas
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
    const branchId = searchParams.get("branchId") || undefined;

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Obtener resumen
    const summary = await getStockAlertsSummary(tenantId, branchId);

    return jsonResponse(summary);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/stock/alerts/summary");
  }
}
