/**
 * SPRINT 1: Endpoint para obtener stock de un producto específico
 * GET /api/stock/:productId - Obtener stock de un producto
 */

import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// Validar UUID
const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// GET /api/stock/:productId - Obtener stock de un producto
export async function GET(
  req: Request,
  { params }: { params: { productId: string } }
) {
  try {
    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.productId);
    if (!uuidValidation.success) {
      return errorResponse("ID de producto inválido", 400, uuidValidation.error.errors);
    }

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

    // Verificar que el producto existe
    const { data: product, error: productError } = await supabase
      .from("products")
      .select(`
        id,
        sku,
        name_internal,
        cost,
        store_id
      `)
      .eq("id", params.productId)
      .is("deleted_at", null)
      .single();

    if (productError || !product) {
      return errorResponse("Producto no encontrado", 404);
    }

    // Obtener stock del producto
    const { data: stock, error: stockError } = await supabase
      .from("product_stock")
      .select("stock_current, stock_min, updated_at")
      .eq("product_id", params.productId)
      .single();

    if (stockError && stockError.code !== "PGRST116") {
      // PGRST116 = no encontrado, que es válido si no hay stock registrado aún
      console.error("[GET /api/stock/:productId] Error al obtener stock:", stockError);
      return errorResponse("Error al obtener stock", 500, stockError.message, stockError.code);
    }

    return jsonResponse({
      productId: product.id,
      sku: product.sku,
      name: product.name_internal,
      cost: product.cost ? parseFloat(product.cost) : null,
      stockCurrent: stock?.stock_current || 0,
      stockMin: stock?.stock_min || 0,
      updatedAt: stock?.updated_at || null,
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/stock/:productId");
  }
}
