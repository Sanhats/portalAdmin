/**
 * SPRINT 1: Endpoint para obtener stock
 * GET /api/stock - Listar stock de todos los productos
 */

import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// GET /api/stock - Listar stock de todos los productos
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

    // Obtener tenant_id del header o query
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido (query param o header x-tenant-id)", 400);
    }

    // Obtener productos con stock
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(`
        id,
        sku,
        name_internal,
        cost,
        store_id
      `)
      .eq("store_id", tenantId)
      .is("deleted_at", null);

    if (productsError) {
      console.error("[GET /api/stock] Error al obtener productos:", productsError);
      return errorResponse("Error al obtener productos", 500, productsError.message, productsError.code);
    }

    if (!products || products.length === 0) {
      return jsonResponse({
        data: [],
        total: 0,
      });
    }

    // Obtener stock de todos los productos
    const { data: stockData, error: stockError } = await supabase
      .from("product_stock")
      .select("product_id, stock_current, stock_min")
      .in(
        "product_id",
        products.map((p) => p.id)
      );

    if (stockError) {
      console.error("[GET /api/stock] Error al obtener stock:", stockError);
      return errorResponse("Error al obtener stock", 500, stockError.message, stockError.code);
    }

    const stockMap = new Map(
      (stockData || []).map((s) => [
        s.product_id,
        { stockCurrent: s.stock_current, stockMin: s.stock_min },
      ])
    );

    // Combinar productos con stock
    const stockList = products.map((product) => {
      const stock = stockMap.get(product.id) || { stockCurrent: 0, stockMin: 0 };
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name_internal,
        cost: product.cost ? parseFloat(product.cost) : null,
        stockCurrent: stock.stockCurrent,
        stockMin: stock.stockMin,
      };
    });

    return jsonResponse({
      data: stockList,
      total: stockList.length,
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/stock");
  }
}
