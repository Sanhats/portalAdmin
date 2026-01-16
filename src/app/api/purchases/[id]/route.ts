import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { updatePurchaseSchema } from "@/validations/purchase";
import { calculatePurchaseTotals, preparePurchaseItems } from "@/lib/purchase-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// GET /api/purchases/:id - Obtener compra por ID
export async function GET(
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

    // Obtener compra
    let query = supabase
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
            cost
          ),
          variants (
            id,
            name,
            value
          )
        )
      `)
      .eq("id", params.id);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: purchase, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return errorResponse("Compra no encontrada", 404);
      }
      console.error("[GET /api/purchases/:id] Error al obtener compra:", error);
      return errorResponse("Error al obtener compra", 500, error.message, error.code);
    }

    return jsonResponse(purchase);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/purchases/:id");
  }
}

// PUT /api/purchases/:id - Actualizar compra (solo si está en draft)
export async function PUT(
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

    const body = await req.json();

    // Validar datos
    const parsed = updatePurchaseSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
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

    // Obtener compra actual
    let query = supabase
      .from("purchases")
      .select("*")
      .eq("id", params.id);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: existingPurchase, error: fetchError } = await query.single();

    if (fetchError || !existingPurchase) {
      return errorResponse("Compra no encontrada", 404);
    }

    // Solo se puede editar si está en draft
    if (existingPurchase.status !== "draft") {
      return errorResponse("Solo se pueden editar compras en estado draft", 400);
    }

    // Preparar datos de actualización
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Si se actualiza el proveedor, validar que existe
    if (parsed.data.supplierId !== undefined) {
      const { data: supplier } = await supabase
        .from("suppliers")
        .select("id, tenant_id")
        .eq("id", parsed.data.supplierId)
        .is("deleted_at", null)
        .single();

      if (!supplier) {
        return errorResponse("Proveedor no encontrado", 404);
      }

      if (supplier.tenant_id !== existingPurchase.tenant_id) {
        return errorResponse("El proveedor no pertenece al tenant", 403);
      }

      updateData.supplier_id = parsed.data.supplierId;
    }

    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes;
    }

    // Si se actualizan los items, recalcular totales
    if (parsed.data.items && parsed.data.items.length > 0) {
      const preparedItems = await preparePurchaseItems(parsed.data.items);
      const totals = await calculatePurchaseTotals(parsed.data.items);

      updateData.subtotal = totals.subtotal.toString();
      updateData.total_cost = totals.totalCost.toString();

      // Eliminar items antiguos y crear nuevos
      await supabase
        .from("purchase_items")
        .delete()
        .eq("purchase_id", params.id);

      const purchaseItems = preparedItems.map(item => ({
        purchase_id: params.id,
        product_id: item.productId,
        variant_id: item.variantId || null,
        quantity: item.quantity,
        unit_cost: typeof item.unitCost === "string" ? item.unitCost : item.unitCost.toString(),
        total_cost: item.totalCost.toString(),
      }));

      const { error: itemsError } = await supabase
        .from("purchase_items")
        .insert(purchaseItems);

      if (itemsError) {
        console.error("[PUT /api/purchases/:id] Error al actualizar items:", itemsError);
        return errorResponse("Error al actualizar items de compra", 500, itemsError.message, itemsError.code);
      }
    }

    // Actualizar compra
    const { data: purchase, error: updateError } = await supabase
      .from("purchases")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("[PUT /api/purchases/:id] Error al actualizar compra:", updateError);
      return errorResponse("Error al actualizar compra", 500, updateError.message, updateError.code);
    }

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
            sku
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

    return jsonResponse(purchaseWithRelations);
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/purchases/:id");
  }
}

// DELETE /api/purchases/:id - Cancelar compra (solo si está en draft)
export async function DELETE(
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

    // Obtener compra actual
    let query = supabase
      .from("purchases")
      .select("*")
      .eq("id", params.id);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: existingPurchase, error: fetchError } = await query.single();

    if (fetchError || !existingPurchase) {
      return errorResponse("Compra no encontrada", 404);
    }

    // Solo se puede cancelar si está en draft o confirmed (no si ya fue recibida)
    if (existingPurchase.status === "received") {
      return errorResponse("No se puede cancelar una compra que ya fue recibida", 400);
    }

    // Actualizar estado a cancelled
    const { error: updateError } = await supabase
      .from("purchases")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (updateError) {
      console.error("[DELETE /api/purchases/:id] Error al cancelar compra:", updateError);
      return errorResponse("Error al cancelar compra", 500, updateError.message, updateError.code);
    }

    return jsonResponse({ message: "Compra cancelada correctamente" });
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/purchases/:id");
  }
}
