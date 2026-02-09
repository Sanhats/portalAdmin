/**
 * SPRINT 13: Endpoints para alertas de stock
 * GET /api/stock/alerts - Listar alertas de stock
 */

import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getStockAlerts } from "@/lib/stock-alerts-helpers-sprint13";

// GET /api/stock/alerts - Listar alertas de stock
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
    const branchId = searchParams.get("branchId");
    const productId = searchParams.get("productId");
    const alertType = searchParams.get("alertType") as "LOW_STOCK" | "OUT_OF_STOCK" | null;
    const status = searchParams.get("status") as "ACTIVE" | "RESOLVED" | null;

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Construir filtros
    const filters: {
      branchId?: string;
      productId?: string;
      alertType?: "LOW_STOCK" | "OUT_OF_STOCK";
      status?: "ACTIVE" | "RESOLVED";
    } = {};

    if (branchId) filters.branchId = branchId;
    if (productId) filters.productId = productId;
    if (alertType && (alertType === "LOW_STOCK" || alertType === "OUT_OF_STOCK")) {
      filters.alertType = alertType;
    }
    if (status && (status === "ACTIVE" || status === "RESOLVED")) {
      filters.status = status;
    }

    // Obtener alertas
    const alerts = await getStockAlerts(tenantId, filters);

    return jsonResponse(alerts);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/stock/alerts");
  }
}
