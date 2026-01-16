import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { canReceivePurchase, updateProductStockAndCost, createCashMovementFromPurchase } from "@/lib/purchase-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// POST /api/purchases/:id/receive - Recibir compra (pasa de confirmed a received)
// Esta es la operación crítica que actualiza stock, costos y caja
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

    // Obtener tenant_id del header o usar default
    let tenantId: string | null = req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (defaultStore) {
        tenantId = defaultStore.id;
      }
    }

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Validar que la compra puede ser recibida
    const canReceive = await canReceivePurchase(params.id);
    if (!canReceive.canReceive) {
      return errorResponse(canReceive.reason || "No se puede recibir la compra", 400);
    }

    // Obtener compra con items
    const { data: purchase, error: fetchError } = await supabase
      .from("purchases")
      .select(`
        *,
        purchase_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_cost,
          total_cost
        )
      `)
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError || !purchase) {
      return errorResponse("Compra no encontrada", 404);
    }

    // Verificar que tiene items
    if (!purchase.purchase_items || purchase.purchase_items.length === 0) {
      return errorResponse("La compra no tiene items", 400);
    }

    // Procesar cada item: actualizar stock y costo
    const stockUpdates: Array<{
      productId: string;
      quantity: number;
      unitCost: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const item of purchase.purchase_items) {
      try {
        const unitCost = typeof item.unit_cost === "string" 
          ? parseFloat(item.unit_cost) 
          : item.unit_cost;

        const result = await updateProductStockAndCost(
          item.product_id,
          item.quantity,
          unitCost,
          params.id
        );

        stockUpdates.push({
          productId: item.product_id,
          quantity: item.quantity,
          unitCost: unitCost,
          success: true,
        });

        console.log(`[POST /api/purchases/:id/receive] Producto ${item.product_id} actualizado: stock ${result.previousStock} → ${result.newStock}, costo ${result.previousCost || "N/A"} → ${result.newCost}`);
      } catch (error: any) {
        console.error(`[POST /api/purchases/:id/receive] Error al actualizar producto ${item.product_id}:`, error);
        stockUpdates.push({
          productId: item.product_id,
          quantity: item.quantity,
          unitCost: typeof item.unit_cost === "string" ? parseFloat(item.unit_cost) : item.unit_cost,
          success: false,
          error: error.message || "Error desconocido",
        });
      }
    }

    // Verificar si hubo errores
    const failedUpdates = stockUpdates.filter(u => !u.success);
    if (failedUpdates.length > 0) {
      // Si hubo errores, no actualizar el estado de la compra
      // El usuario puede intentar de nuevo
      return errorResponse(
        `Error al actualizar algunos productos: ${failedUpdates.map(u => u.error).join(", ")}`,
        500
      );
    }

    // Actualizar estado de la compra a received
    const totalCost = typeof purchase.total_cost === "string" 
      ? parseFloat(purchase.total_cost) 
      : purchase.total_cost;

    const { data: updatedPurchase, error: updateError } = await supabase
      .from("purchases")
      .update({
        status: "received",
        received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("[POST /api/purchases/:id/receive] Error al actualizar estado de compra:", updateError);
      // Aquí deberíamos revertir los cambios de stock, pero por simplicidad solo reportamos el error
      // En producción, implementar rollback completo
      return errorResponse("Error al actualizar estado de compra", 500, updateError.message, updateError.code);
    }

    // Crear movimiento de caja (opcional, solo si hay caja abierta)
    const body = await req.json().catch(() => ({}));
    const paymentMethod = body.paymentMethod || "transfer"; // 'cash' | 'transfer'
    
    await createCashMovementFromPurchase(
      params.id,
      tenantId,
      totalCost,
      paymentMethod
    );

    // Obtener compra completa con relaciones
    const { data: purchaseWithRelations } = await supabase
      .from("purchases")
      .select(`
        *,
        suppliers (
          id,
          name,
          email,
          phone
        ),
        purchase_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_cost,
          total_cost,
          products (
            id,
            name_internal,
            sku,
            stock,
            cost
          ),
          variants (
            id,
            name,
            value
          )
        )
      `)
      .eq("id", params.id)
      .single();

    return jsonResponse({
      ...purchaseWithRelations,
      stockUpdates: stockUpdates.map(u => ({
        productId: u.productId,
        quantity: u.quantity,
        unitCost: u.unitCost,
        success: u.success,
      })),
    });
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/purchases/:id/receive");
  }
}
