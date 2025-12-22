import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// POST /api/sales/:id/cancel - Cancelar venta y revertir stock (si estaba confirmada)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }
    
    // Obtener la venta con sus items
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select(`
        *,
        sale_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          subtotal
        )
      `)
      .eq("id", params.id)
      .single();
    
    if (saleError || !sale) {
      if (saleError?.code === "PGRST116") {
        return errorResponse("Venta no encontrada", 404);
      }
      console.error("[POST /api/sales/:id/cancel] Error al obtener venta:", saleError);
      return errorResponse("Error al obtener la venta", 500, saleError?.message, saleError?.code);
    }
    
    // Validar que la venta se pueda cancelar
    if (sale.status === "cancelled") {
      return errorResponse("La venta ya está cancelada", 400);
    }
    
    if (sale.status === "paid") {
      return errorResponse("No se puede cancelar una venta pagada. Debe procesarse un reembolso primero", 400);
    }
    
    // Si la venta está confirmada, revertir el stock
    if (sale.status === "confirmed") {
      if (!sale.sale_items || sale.sale_items.length === 0) {
        // Si no tiene items, solo cambiar el estado
        const { data: updatedSale, error: updateError } = await supabase
          .from("sales")
          .update({ status: "cancelled" })
          .eq("id", params.id)
          .select()
          .single();
        
        if (updateError || !updatedSale) {
          console.error("[POST /api/sales/:id/cancel] Error al cancelar venta:", updateError);
          return errorResponse("Error al cancelar la venta", 500, updateError?.message, updateError?.code);
        }
        
        return jsonResponse(updatedSale);
      }
      
      // Obtener todos los productos de la venta
      const productIds = sale.sale_items.map((item: any) => item.product_id);
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, stock, sku, name_internal")
        .in("id", productIds)
        .is("deleted_at", null);
      
      if (productsError) {
        console.error("[POST /api/sales/:id/cancel] Error al obtener productos:", productsError);
        return errorResponse("Error al validar productos", 500, productsError.message);
      }
      
      if (!products || products.length !== productIds.length) {
        // Algunos productos pueden haber sido eliminados, pero continuamos
        console.warn("[POST /api/sales/:id/cancel] Algunos productos no se encontraron, continuando...");
      }
      
      // Revertir stock para cada item
      const stockUpdates: Array<{ productId: string; oldStock: number; newStock: number; quantity: number }> = [];
      
      for (const item of sale.sale_items) {
        const product = products?.find(p => p.id === item.product_id);
        if (!product) {
          console.warn(`[POST /api/sales/:id/cancel] Producto ${item.product_id} no encontrado, saltando...`);
          continue;
        }
        
        const currentStock = product.stock || 0;
        const quantityToRestore = item.quantity;
        const newStock = currentStock + quantityToRestore;
        
        stockUpdates.push({
          productId: product.id,
          oldStock: currentStock,
          newStock: newStock,
          quantity: quantityToRestore,
        });
      }
      
      // Actualizar stock y registrar movimientos
      for (const update of stockUpdates) {
        // Actualizar stock del producto
        const { error: updateStockError } = await supabase
          .from("products")
          .update({ stock: update.newStock })
          .eq("id", update.productId);
        
        if (updateStockError) {
          console.error(`[POST /api/sales/:id/cancel] Error al revertir stock del producto ${update.productId}:`, updateStockError);
          // Continuar con los demás productos
          continue;
        }
        
        // Registrar movimiento de stock
        try {
          await supabase
            .from("stock_movements")
            .insert({
              product_id: update.productId,
              previous_stock: update.oldStock,
              new_stock: update.newStock,
              difference: update.quantity, // Positivo porque es entrada (reversión)
              reason: `Venta cancelada: ${params.id}`,
            });
        } catch (movementError) {
          // No fallar si no se puede registrar el movimiento, solo loguear
          console.warn(`[POST /api/sales/:id/cancel] No se pudo registrar movimiento de stock para producto ${update.productId}:`, movementError);
        }
      }
    }
    
    // Actualizar estado de la venta a "cancelled"
    const { data: updatedSale, error: updateSaleError } = await supabase
      .from("sales")
      .update({ status: "cancelled" })
      .eq("id", params.id)
      .select()
      .single();
    
    if (updateSaleError || !updatedSale) {
      console.error("[POST /api/sales/:id/cancel] Error al actualizar estado de la venta:", updateSaleError);
      return errorResponse("Error al cancelar la venta", 500, updateSaleError?.message, updateSaleError?.code);
    }
    
    // Obtener la venta completa con items
    const { data: saleWithItems, error: fetchError } = await supabase
      .from("sales")
      .select(`
        *,
        sale_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          subtotal,
          products:product_id (
            id,
            sku,
            name_internal,
            price,
            stock
          ),
          variants:variant_id (
            id,
            name,
            value
          )
        )
      `)
      .eq("id", params.id)
      .single();
    
    if (fetchError || !saleWithItems) {
      console.error("[POST /api/sales/:id/cancel] Error al obtener venta completa:", fetchError);
      return jsonResponse(updatedSale);
    }
    
    return jsonResponse(saleWithItems);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/sales/:id/cancel");
  }
}

