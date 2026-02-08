/**
 * SPRINT 1: Endpoint para ajustar stock
 * POST /api/stock/adjustment - Ajustar stock de un producto
 */

import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// Schema para ajuste de stock
const stockAdjustmentSchema = z.object({
  productId: z.string().uuid("El productId debe ser un UUID válido"),
  quantity: z.number().int("La cantidad debe ser un número entero"),
  type: z.enum(["adjustment", "purchase", "sale", "cancelation"]).default("adjustment"),
  referenceId: z.string().uuid("El referenceId debe ser un UUID válido").optional().nullable(),
});

// POST /api/stock/adjustment - Ajustar stock de un producto
export async function POST(req: Request) {
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

    const body = await req.json();
    const parsed = stockAdjustmentSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    const { productId, quantity, type, referenceId } = parsed.data;

    // Obtener tenant_id del header o del producto
    const tenantId = req.headers.get("x-tenant-id");

    // Verificar que el producto existe y obtener tenant_id
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, store_id, sku, name_internal")
      .eq("id", productId)
      .is("deleted_at", null)
      .single();

    if (productError || !product) {
      return errorResponse("Producto no encontrado", 404);
    }

    const finalTenantId = tenantId || product.store_id;

    if (!finalTenantId) {
      return errorResponse("No se pudo determinar el tenant_id", 400);
    }

    // Obtener stock actual
    const { data: currentStock, error: stockError } = await supabase
      .from("product_stock")
      .select("stock_current")
      .eq("product_id", productId)
      .single();

    const currentStockValue = currentStock?.stock_current || 0;
    const newStockValue = currentStockValue + quantity;

    // Validar que el stock resultante no sea negativo (excepto para cancelation)
    if (newStockValue < 0 && type !== "cancelation") {
      return errorResponse(
        `El stock no puede ser negativo. Stock actual: ${currentStockValue}, cantidad solicitada: ${quantity}`,
        400
      );
    }

    // Crear movimiento de stock
    const { error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        tenant_id: finalTenantId,
        product_id: productId,
        type: type,
        quantity: quantity,
        reference_id: referenceId || null,
      });

    if (movementError) {
      console.error("[POST /api/stock/adjustment] Error al crear movimiento:", movementError);
      return errorResponse("Error al crear movimiento de stock", 500, movementError.message, movementError.code);
    }

    // El trigger debería actualizar product_stock automáticamente
    // Pero verificamos que se haya actualizado correctamente
    const { data: updatedStock, error: fetchError } = await supabase
      .from("product_stock")
      .select("stock_current, stock_min, updated_at")
      .eq("product_id", productId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // Si no existe, crearlo manualmente
      const { error: createError } = await supabase
        .from("product_stock")
        .insert({
          product_id: productId,
          stock_current: newStockValue,
          stock_min: 0,
        });

      if (createError) {
        console.error("[POST /api/stock/adjustment] Error al crear registro de stock:", createError);
      }
    }

    return jsonResponse({
      productId: productId,
      sku: product.sku,
      name: product.name_internal,
      adjustment: {
        type: type,
        quantity: quantity,
        previousStock: currentStockValue,
        newStock: newStockValue,
        referenceId: referenceId || null,
      },
      stock: {
        stockCurrent: updatedStock?.stock_current || newStockValue,
        stockMin: updatedStock?.stock_min || 0,
        updatedAt: updatedStock?.updated_at || new Date().toISOString(),
      },
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/stock/adjustment");
  }
}
