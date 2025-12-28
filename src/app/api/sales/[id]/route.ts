import { supabase } from "@/lib/supabase";
import { updateSaleSchema } from "@/validations/sale";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// GET /api/sales/:id - Obtener venta por ID
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
    
    // Obtener tenant_id del header (opcional, para validación)
    const tenantId = req.headers.get("x-tenant-id");
    
    // Construir query con resumen financiero
    let query = supabase
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
            price
          ),
          variants:variant_id (
            id,
            name,
            value
          )
        )
      `)
      .eq("id", params.id);
    
    // Si se proporciona tenant_id, filtrar por él
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }
    
    const { data, error } = await query.single();
    
    if (error) {
      if (error.code === "PGRST116") {
        return errorResponse("Venta no encontrada", 404);
      }
      console.error("[GET /api/sales/:id] Error de Supabase:", error);
      return errorResponse("Error al obtener la venta", 500, error.message, error.code);
    }
    
    if (!data) {
      return errorResponse("Venta no encontrada", 404);
    }
    
    // Agregar resumen financiero
    const paidAmount = data.paid_amount ? parseFloat(data.paid_amount) : 0;
    const balanceAmount = data.balance_amount !== null && data.balance_amount !== undefined 
      ? parseFloat(data.balance_amount) 
      : (parseFloat(data.total_amount || "0") - paidAmount);
    const totalAmount = parseFloat(data.total_amount || "0");
    
    const response = {
      ...data,
      financial: {
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        balanceAmount: balanceAmount,
        isPaid: balanceAmount <= 0,
        paymentCompletedAt: data.payment_completed_at || null,
      }
    };
    
    return jsonResponse(response);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/sales/:id");
  }
}

// PUT /api/sales/:id - Editar venta (solo si está en draft)
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
    console.log("[PUT /api/sales/:id] Body recibido:", JSON.stringify(body, null, 2));
    
    // Validar datos
    const parsed = updateSaleSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[PUT /api/sales/:id] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    // Verificar que la venta existe y está en estado draft
    const { data: existingSale, error: checkError } = await supabase
      .from("sales")
      .select("id, status, tenant_id")
      .eq("id", params.id)
      .single();
    
    if (checkError || !existingSale) {
      return errorResponse("Venta no encontrada", 404);
    }
    
    if (existingSale.status !== "draft") {
      return errorResponse("Solo se pueden editar ventas en estado draft", 400);
    }
    
    // Obtener tenant_id del header si no está en la venta
    const tenantId = req.headers.get("x-tenant-id") || existingSale.tenant_id;
    
    // Si se están actualizando los items, recalcular total y validar
    let updateData: any = {
      payment_method: parsed.data.paymentMethod !== undefined ? parsed.data.paymentMethod : undefined,
      notes: parsed.data.notes !== undefined ? parsed.data.notes : undefined,
    };
    
    // Remover campos undefined
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
    
    // Si se actualizan los items, validar y recalcular
    if (parsed.data.items) {
      const items = parsed.data.items;
      
      // Validar productos
      const productIds = items.map(item => item.productId);
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, stock, is_active, price")
        .in("id", productIds)
        .is("deleted_at", null);
      
      if (productsError) {
        console.error("[PUT /api/sales/:id] Error al validar productos:", productsError);
        return errorResponse("Error al validar productos", 500, productsError.message);
      }
      
      if (!products || products.length !== productIds.length) {
        return errorResponse("Uno o más productos no existen o fueron eliminados", 400);
      }
      
      // Validar que todos los productos estén activos
      const inactiveProducts = products.filter(p => !p.is_active);
      if (inactiveProducts.length > 0) {
        return errorResponse("Uno o más productos están inactivos", 400);
      }
      
      // Validar variantes si se proporcionan
      const variantIds = items
        .map(item => item.variantId)
        .filter((id): id is string => id !== null && id !== undefined);
      
      if (variantIds.length > 0) {
        const { data: variants, error: variantsError } = await supabase
          .from("variants")
          .select("id, product_id")
          .in("id", variantIds);
        
        if (variantsError) {
          console.error("[PUT /api/sales/:id] Error al validar variantes:", variantsError);
          return errorResponse("Error al validar variantes", 500, variantsError.message);
        }
        
        if (!variants || variants.length !== variantIds.length) {
          return errorResponse("Uno o más variantes no existen", 400);
        }
      }
      
      // Calcular nuevo total
      let totalAmount = 0;
      const saleItemsToInsert: any[] = [];
      
      for (const item of items) {
        const unitPrice = typeof item.unitPrice === "number" 
          ? item.unitPrice 
          : parseFloat(item.unitPrice);
        
        const subtotal = unitPrice * item.quantity;
        totalAmount += subtotal;
        
        saleItemsToInsert.push({
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity: item.quantity,
          unit_price: unitPrice.toString(),
          subtotal: subtotal.toString(),
        });
      }
      
      updateData.total_amount = totalAmount.toString();
      
      // Eliminar items antiguos y crear nuevos (en una transacción)
      // Primero eliminar items antiguos
      const { error: deleteItemsError } = await supabase
        .from("sale_items")
        .delete()
        .eq("sale_id", params.id);
      
      if (deleteItemsError) {
        console.error("[PUT /api/sales/:id] Error al eliminar items antiguos:", deleteItemsError);
        return errorResponse("Error al actualizar los items de la venta", 500, deleteItemsError.message);
      }
      
      // Crear nuevos items
      const saleItemsWithSaleId = saleItemsToInsert.map(item => ({
        ...item,
        sale_id: params.id,
      }));
      
      const { error: insertItemsError } = await supabase
        .from("sale_items")
        .insert(saleItemsWithSaleId);
      
      if (insertItemsError) {
        console.error("[PUT /api/sales/:id] Error al crear nuevos items:", insertItemsError);
        return errorResponse("Error al actualizar los items de la venta", 500, insertItemsError.message);
      }
    }
    
    // Actualizar la venta
    const { data: updatedSale, error: updateError } = await supabase
      .from("sales")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();
    
    if (updateError || !updatedSale) {
      console.error("[PUT /api/sales/:id] Error al actualizar venta:", updateError);
      return errorResponse("Error al actualizar la venta", 500, updateError?.message, updateError?.code);
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
            price
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
      console.error("[PUT /api/sales/:id] Error al obtener venta completa:", fetchError);
      return jsonResponse(updatedSale);
    }
    
    return jsonResponse(saleWithItems);
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/sales/:id");
  }
}

