import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";

// Validar UUID
const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

/**
 * Normaliza un movimiento de stock a la estructura esperada por el frontend
 */
function normalizeStockMovement(movement: any) {
  return {
    id: movement.id,
    quantity: movement.difference, // La diferencia es la cantidad (positiva o negativa)
    stockBefore: movement.previous_stock,
    stockAfter: movement.new_stock, // Stock resultante después del movimiento
    reason: movement.reason || null,
    purchaseId: movement.purchase_id || null, // SPRINT ERP: FK a purchases
    saleId: movement.sale_id || null, // FK a sales
    createdAt: movement.created_at,
    // Nota: user no está en la BD actualmente, pero se puede agregar en el futuro
    // Por ahora, si se necesita, se puede obtener de los headers de la request
  };
}

// GET /api/products/[id]/stock/history - Obtener historial de movimientos de stock
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }
    
    // Verificar que el producto existe (SPRINT 6: excluir eliminados)
    const { data: existingProduct, error: checkError } = await supabase
      .from("products")
      .select("id")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();
    
    if (checkError || !existingProduct) {
      return errorResponse("Producto no encontrado", 404);
    }
    
    // Obtener historial de movimientos de stock
    const { data: movements, error: movementsError } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("product_id", params.id)
      .order("created_at", { ascending: false }); // Más recientes primero
    
    if (movementsError) {
      console.error("[GET /api/products/[id]/stock/history] Error al obtener movimientos:", movementsError);
      return errorResponse("Error al obtener el historial de stock", 500, movementsError.message, movementsError.code);
    }
    
    // Normalizar movimientos
    const normalizedMovements = (movements || []).map(normalizeStockMovement);
    
    return jsonResponse(normalizedMovements, 200);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/products/[id]/stock/history");
  }
}

