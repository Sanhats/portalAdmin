/**
 * SPRINT 1: Endpoint para valorización de stock
 * GET /api/stock/valuation?type=cost|price&priceList=1
 */

import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { calculateStockValuation } from "@/lib/stock-valuation-helpers";

// GET /api/stock/valuation - Calcular valorización de stock
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
    
    // Obtener tenant_id del header o query
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      return errorResponse("tenantId es requerido (query param o header x-tenant-id)", 400);
    }

    // Obtener tipo de valorización
    const type = searchParams.get("type");
    
    if (!type || (type !== "cost" && type !== "price")) {
      return errorResponse("type es requerido y debe ser 'cost' o 'price'", 400);
    }

    // Si es tipo price, obtener priceList
    let priceListId: number | undefined;
    if (type === "price") {
      const priceListParam = searchParams.get("priceList");
      if (!priceListParam) {
        return errorResponse("priceList es requerido cuando type='price'", 400);
      }
      
      priceListId = parseInt(priceListParam, 10);
      if (![1, 2, 3, 4].includes(priceListId)) {
        return errorResponse("priceList debe ser 1, 2, 3 o 4", 400);
      }
    }

    // Calcular valorización
    const valuation = await calculateStockValuation(
      tenantId,
      type as "cost" | "price",
      priceListId
    );

    return jsonResponse({
      type: type,
      priceListId: priceListId || null,
      tenantId: tenantId,
      totalValuationCost: valuation.totalValuationCost,
      totalValuationPrice: valuation.totalValuationPrice,
      count: valuation.count,
      items: valuation.items,
    });
  } catch (error: any) {
    console.error("[GET /api/stock/valuation] Error:", error);
    return errorResponse(
      error.message || "Error al calcular valorización",
      500,
      error.message
    );
  }
}
