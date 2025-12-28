import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { isConfirmableStatus } from "@/lib/sale-constants";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// POST /api/sales/:id/confirm - Confirmar venta y descontar stock
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
      console.error("[POST /api/sales/:id/confirm] Error al obtener venta:", saleError);
      return errorResponse("Error al obtener la venta", 500, saleError?.message, saleError?.code);
    }
    
    // SPRINT A: Validar que el estado permita confirmación
    if (!isConfirmableStatus(sale.status as any)) {
      console.error(`[POST /api/sales/:id/confirm] Estado no confirmable: ${sale.status}`);
      return errorResponse(`No se puede confirmar una venta en estado ${sale.status}. Solo se pueden confirmar ventas en estado draft o in_progress`, 400);
    }
    
    // Validar que tenga items
    if (!sale.sale_items || sale.sale_items.length === 0) {
      console.error(`[POST /api/sales/:id/confirm] Venta ${params.id} no tiene items`);
      return errorResponse("La venta no tiene items", 400);
    }
    
    console.log(`[POST /api/sales/:id/confirm] Venta ${params.id} tiene ${sale.sale_items.length} items`);
    
    // Obtener todos los productos de la venta
    const productIds = sale.sale_items.map((item: any) => item.product_id);
    console.log(`[POST /api/sales/:id/confirm] Obteniendo productos: ${productIds.join(', ')}`);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, stock, is_active, sku, name_internal")
      .in("id", productIds)
      .is("deleted_at", null);
    
    if (productsError) {
      console.error("[POST /api/sales/:id/confirm] Error al obtener productos:", productsError);
      return errorResponse("Error al validar productos", 500, productsError.message);
    }
    
    if (!products || products.length !== productIds.length) {
      console.error(`[POST /api/sales/:id/confirm] Productos no encontrados. Esperados: ${productIds.length}, Encontrados: ${products?.length || 0}`);
      return errorResponse("Uno o más productos no existen o fueron eliminados", 400);
    }
    
    // Validar que todos los productos estén activos
    const inactiveProducts = products.filter(p => !p.is_active);
    if (inactiveProducts.length > 0) {
      console.error(`[POST /api/sales/:id/confirm] Productos inactivos: ${inactiveProducts.map(p => p.sku || p.id).join(', ')}`);
      return errorResponse("Uno o más productos están inactivos", 400);
    }
    
    console.log(`[POST /api/sales/:id/confirm] Productos validados. Stock de productos:`, products.map(p => ({ id: p.id, stock: p.stock, sku: p.sku })));
    
    // Validar stock disponible para cada item
    const stockIssues: string[] = [];
    const stockUpdates: Array<{ productId: string; oldStock: number; newStock: number; quantity: number }> = [];
    
    for (const item of sale.sale_items) {
      const product = products.find(p => p.id === item.product_id);
      if (!product) continue;
      
      const currentStock = product.stock || 0;
      const requestedQuantity = item.quantity;
      
      if (currentStock < requestedQuantity) {
        stockIssues.push(
          `Producto ${product.sku || product.name_internal}: stock disponible ${currentStock}, solicitado ${requestedQuantity}`
        );
      } else {
        stockUpdates.push({
          productId: product.id,
          oldStock: currentStock,
          newStock: currentStock - requestedQuantity,
          quantity: requestedQuantity,
        });
      }
    }
    
    if (stockIssues.length > 0) {
      console.error(`[POST /api/sales/:id/confirm] Stock insuficiente para venta ${params.id}:`, stockIssues);
      return errorResponse("Stock insuficiente", 400, {
        issues: stockIssues,
        message: "No hay stock suficiente para confirmar la venta",
      });
    }
    
    // SPRINT A: Actualizar stock, registrar movimientos y guardar stock_impacted
    // Nota: Supabase no tiene transacciones reales, pero podemos hacerlo de forma segura
    // verificando stock antes de cada actualización
    
    const stockImpactedUpdates: Array<{ itemId: string; stockImpacted: number }> = [];
    
    for (const update of stockUpdates) {
      // Actualizar stock del producto
      const { error: updateStockError } = await supabase
        .from("products")
        .update({ stock: update.newStock })
        .eq("id", update.productId);
      
      if (updateStockError) {
        console.error(`[POST /api/sales/:id/confirm] Error al actualizar stock del producto ${update.productId}:`, updateStockError);
        // Intentar revertir los cambios anteriores
        // Por simplicidad, aquí solo reportamos el error
        // En producción, podrías implementar un rollback más sofisticado
        return errorResponse("Error al actualizar stock", 500, updateStockError.message);
      }
      
      // Registrar movimiento de stock
      try {
        await supabase
          .from("stock_movements")
          .insert({
            product_id: update.productId,
            previous_stock: update.oldStock,
            new_stock: update.newStock,
            difference: -update.quantity, // Negativo porque es salida
            reason: `Venta confirmada: ${params.id}`,
          });
      } catch (movementError) {
        // No fallar si no se puede registrar el movimiento, solo loguear
        console.warn(`[POST /api/sales/:id/confirm] No se pudo registrar movimiento de stock para producto ${update.productId}:`, movementError);
      }
      
      // SPRINT A: Guardar stock_impacted en sale_items
      const item = sale.sale_items.find((si: any) => si.product_id === update.productId);
      if (item) {
        stockImpactedUpdates.push({
          itemId: item.id,
          stockImpacted: update.quantity,
        });
      }
    }
    
    // SPRINT A: Actualizar stock_impacted en todos los items
    for (const update of stockImpactedUpdates) {
      await supabase
        .from("sale_items")
        .update({ stock_impacted: update.stockImpacted })
        .eq("id", update.itemId);
    }
    
    // Actualizar estado de la venta a "confirmed"
    const { data: updatedSale, error: updateSaleError } = await supabase
      .from("sales")
      .update({ status: "confirmed" })
      .eq("id", params.id)
      .select()
      .single();
    
    if (updateSaleError || !updatedSale) {
      console.error("[POST /api/sales/:id/confirm] Error al actualizar estado de la venta:", updateSaleError);
      // Aquí deberíamos revertir los cambios de stock, pero por simplicidad solo reportamos
      // En producción, implementar rollback completo
      return errorResponse("Error al confirmar la venta", 500, updateSaleError?.message, updateSaleError?.code);
    }
    
    // SPRINT A: Obtener la venta completa con items y snapshot (incluyendo stock_impacted)
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
          product_name,
          product_sku,
          variant_name,
          variant_value,
          unit_cost,
          unit_tax,
          unit_discount,
          stock_impacted,
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
      console.error("[POST /api/sales/:id/confirm] Error al obtener venta completa:", fetchError);
      return jsonResponse(updatedSale);
    }
    
    return jsonResponse(saleWithItems);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/sales/:id/confirm");
  }
}

