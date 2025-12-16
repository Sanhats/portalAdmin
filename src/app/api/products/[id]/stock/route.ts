import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";

// Validar UUID
const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// Schema para ajustar stock (quantity puede ser positivo o negativo)
const stockAdjustSchema = z.object({
  quantity: z.number()
    .int("La cantidad debe ser un número entero"),
  reason: z.string()
    .max(255, "La razón no puede exceder 255 caracteres")
    .optional(),
});

// POST /api/products/[id]/stock - Ajustar stock del producto (quantity puede ser positivo o negativo)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }
    
    const body = await req.json();
    console.log("[POST /api/products/[id]/stock] Body recibido:", body);

    // Validar datos
    const parsed = stockAdjustSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[POST /api/products/[id]/stock] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    // Verificar que el producto existe y obtener stock actual (SPRINT 6: excluir eliminados)
    const { data: existingProduct, error: checkError } = await supabase
      .from("products")
      .select("id, stock, sku, name_internal")
      .eq("id", params.id)
      .is("deleted_at", null) // SPRINT 6: Excluir eliminados
      .single();
    
    if (checkError || !existingProduct) {
      return errorResponse("Producto no encontrado", 404);
    }
    
    const oldStock = existingProduct.stock || 0;
    const quantity = parsed.data.quantity;
    const newStock = oldStock + quantity;
    
    // Validar que el stock resultante no sea negativo
    if (newStock < 0) {
      return errorResponse(
        `El stock no puede ser negativo. Stock actual: ${oldStock}, cantidad solicitada: ${quantity}`,
        400
      );
    }
    
    // Actualizar stock
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", params.id);
    
    if (updateError) {
      console.error("[POST /api/products/[id]/stock] Error al actualizar stock:", updateError);
      return errorResponse("Error al actualizar el stock", 500, updateError.message, updateError.code);
    }
    
    console.log(`[POST /api/products/[id]/stock] Stock ajustado: ${oldStock} -> ${newStock} (cantidad: ${quantity})`);
    
    // Registrar movimiento de stock
    try {
      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: params.id,
          previous_stock: oldStock,
          new_stock: newStock,
          difference: quantity, // La diferencia es la cantidad ajustada
          reason: parsed.data.reason || "Ajuste manual",
        });
      
      if (movementError) {
        // No fallar si no se puede registrar el movimiento, solo loguear
        console.warn("[POST /api/products/[id]/stock] No se pudo registrar movimiento de stock:", movementError);
      } else {
        console.log("[POST /api/products/[id]/stock] Movimiento de stock registrado");
      }
    } catch (error) {
      // No fallar si la tabla no existe aún, solo loguear
      console.warn("[POST /api/products/[id]/stock] Error al registrar movimiento (tabla puede no existir):", error);
    }
    
    // Obtener el producto actualizado
    const { data: updatedProduct, error: fetchError } = await supabase
      .from("products")
      .select(`
        id,
        sku,
        name_internal,
        stock,
        price,
        is_active,
        is_visible
      `)
      .eq("id", params.id)
      .single();
    
    if (fetchError) {
      console.error("[POST /api/products/[id]/stock] Error al obtener producto actualizado:", fetchError);
      return errorResponse("Error al obtener el producto actualizado", 500, fetchError.message, fetchError.code);
    }
    
    return jsonResponse({
      ...updatedProduct,
      stockChange: {
        previous: oldStock,
        current: newStock,
        quantity: quantity,
      },
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/products/[id]/stock");
  }
}

