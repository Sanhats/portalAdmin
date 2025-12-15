import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";

// Validar UUID
const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// Schema para actualizar stock
const stockUpdateSchema = z.object({
  stock: z.number()
    .int("El stock debe ser un número entero")
    .min(0, "El stock no puede ser negativo"),
  reason: z.string()
    .max(255, "La razón no puede exceder 255 caracteres")
    .optional(),
});

// PATCH /api/products/[id]/stock - Actualizar solo el stock del producto (SPRINT 5)
export async function PATCH(
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
    console.log("[PATCH /api/products/[id]/stock] Body recibido:", body);

    // Validar datos
    const parsed = stockUpdateSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[PATCH /api/products/[id]/stock] Error de validación:", parsed.error.errors);
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
    
    const newStock = parsed.data.stock;
    const oldStock = existingProduct.stock;
    
    // SPRINT 5: Validar que stock no sea negativo (ya validado en schema, pero doble verificación)
    if (newStock < 0) {
      return errorResponse("El stock no puede ser negativo", 400);
    }
    
    // Actualizar stock
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", params.id);
    
    if (updateError) {
      console.error("[PATCH /api/products/[id]/stock] Error al actualizar stock:", updateError);
      return errorResponse("Error al actualizar el stock", 500, updateError.message, updateError.code);
    }
    
    const difference = newStock - oldStock;
    console.log(`[PATCH /api/products/[id]/stock] Stock actualizado: ${oldStock} -> ${newStock} (diferencia: ${difference})`);
    
    // SPRINT 5: Registrar movimiento de stock (opcional, para ventas futuras)
    try {
      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          product_id: params.id,
          previous_stock: oldStock,
          new_stock: newStock,
          difference: difference,
          reason: parsed.data.reason || "Actualización manual",
        });
      
      if (movementError) {
        // No fallar si no se puede registrar el movimiento, solo loguear
        console.warn("[PATCH /api/products/[id]/stock] No se pudo registrar movimiento de stock:", movementError);
      } else {
        console.log("[PATCH /api/products/[id]/stock] Movimiento de stock registrado");
      }
    } catch (error) {
      // No fallar si la tabla no existe aún, solo loguear
      console.warn("[PATCH /api/products/[id]/stock] Error al registrar movimiento (tabla puede no existir):", error);
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
      console.error("[PATCH /api/products/[id]/stock] Error al obtener producto actualizado:", fetchError);
      return errorResponse("Error al obtener el producto actualizado", 500, fetchError.message, fetchError.code);
    }
    
    return jsonResponse({
      ...updatedProduct,
      stockChange: {
        previous: oldStock,
        current: newStock,
        difference: newStock - oldStock,
      },
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "PATCH /api/products/[id]/stock");
  }
}

