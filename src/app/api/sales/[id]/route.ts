import { supabase } from "@/lib/supabase";
import { updateSaleSchema } from "@/validations/sale";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { calculateSaleTotals, prepareSaleItems } from "@/lib/sale-helpers";
import { isEditableStatus } from "@/lib/sale-constants";
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
    
    // SPRINT A: Construir query con resumen financiero y snapshot
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
    
    // SPRINT A: Agregar resumen financiero completo
    const paidAmount = data.paid_amount ? parseFloat(data.paid_amount) : 0;
    const balanceAmount = data.balance_amount !== null && data.balance_amount !== undefined 
      ? parseFloat(data.balance_amount) 
      : (parseFloat(data.total_amount || "0") - paidAmount);
    const totalAmount = parseFloat(data.total_amount || "0");
    const subtotal = data.subtotal ? parseFloat(data.subtotal) : totalAmount;
    const taxes = data.taxes ? parseFloat(data.taxes) : 0;
    const discounts = data.discounts ? parseFloat(data.discounts) : 0;
    const costAmount = data.cost_amount ? parseFloat(data.cost_amount) : 0;
    
    // SPRINT G: Calcular margen total
    const marginAmount = totalAmount - costAmount;
    const marginPercent = totalAmount > 0 ? ((marginAmount / totalAmount) * 100) : 0;
    
    // SPRINT G: Calcular margen por item
    const itemsWithMargin = (data.sale_items || []).map((item: any) => {
      const unitPrice = parseFloat(item.unit_price || "0");
      const unitCost = item.unit_cost ? parseFloat(item.unit_cost) : 0;
      const quantity = item.quantity || 0;
      const itemRevenue = unitPrice * quantity;
      const itemCost = unitCost * quantity;
      const itemMargin = itemRevenue - itemCost;
      const itemMarginPercent = itemRevenue > 0 ? ((itemMargin / itemRevenue) * 100) : 0;
      
      return {
        ...item,
        itemMargin: Math.round(itemMargin * 100) / 100,
        itemMarginPercent: Math.round(itemMarginPercent * 100) / 100,
      };
    });
    
    const response = {
      ...data,
      sale_items: itemsWithMargin, // Items con margen calculado
      financial: {
        subtotal: subtotal,
        taxes: taxes,
        discounts: discounts,
        totalAmount: totalAmount,
        costAmount: costAmount,
        paidAmount: paidAmount,
        balanceAmount: balanceAmount,
        isPaid: balanceAmount <= 0,
        paymentCompletedAt: data.payment_completed_at || null,
        // SPRINT G: Nombres normalizados para frontend
        marginAmount: Math.round(marginAmount * 100) / 100,
        marginPercent: Math.round(marginPercent * 100) / 100,
        // Backward compatibility
        margin: Math.round(marginAmount * 100) / 100,
        marginPercentage: Math.round(marginPercent * 100) / 100,
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
      .select("id, status, tenant_id, paid_amount, balance_amount")
      .eq("id", params.id)
      .single();
    
    if (checkError || !existingSale) {
      return errorResponse("Venta no encontrada", 404);
    }
    
    // SPRINT A: Validar que el estado permita edición
    if (!isEditableStatus(existingSale.status as any)) {
      return errorResponse(`Solo se pueden editar ventas en estado draft. Estado actual: ${existingSale.status}`, 400);
    }
    
    // Obtener tenant_id del header si no está en la venta
    const tenantId = req.headers.get("x-tenant-id") || existingSale.tenant_id;
    
    // SPRINT A: Preparar datos de actualización
    let updateData: any = {
      payment_method: parsed.data.paymentMethod !== undefined ? parsed.data.paymentMethod : undefined,
      notes: parsed.data.notes !== undefined ? parsed.data.notes : undefined,
    };
    
    // Remover campos undefined
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
    
    // Si se actualizan los items, validar y recalcular con snapshot
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
      
      // SPRINT A: Preparar items con snapshot y calcular totales
      let preparedItems;
      try {
        preparedItems = await prepareSaleItems(items);
      } catch (snapshotError: any) {
        console.error("[PUT /api/sales/:id] Error al obtener snapshot:", snapshotError);
        return errorResponse("Error al obtener información de productos", 500, snapshotError.message);
      }
      
      // SPRINT A: Calcular totales
      const totals = await calculateSaleTotals(items);
      
      // Actualizar totales en la venta
      updateData.subtotal = totals.subtotal.toString();
      updateData.taxes = totals.taxes.toString();
      updateData.discounts = totals.discounts.toString();
      updateData.total_amount = totals.totalAmount.toString();
      updateData.cost_amount = totals.costAmount.toString();
      // Recalcular balance_amount si ya hay pagos
      const currentPaidAmount = existingSale.paid_amount ? parseFloat(existingSale.paid_amount) : 0;
      updateData.balance_amount = (totals.totalAmount - currentPaidAmount).toString();
      
      // Eliminar items antiguos
      const { error: deleteItemsError } = await supabase
        .from("sale_items")
        .delete()
        .eq("sale_id", params.id);
      
      if (deleteItemsError) {
        console.error("[PUT /api/sales/:id] Error al eliminar items antiguos:", deleteItemsError);
        return errorResponse("Error al actualizar los items de la venta", 500, deleteItemsError.message);
      }
      
      // SPRINT A: Crear nuevos items con snapshot
      const saleItemsWithSaleId = preparedItems.map(item => ({
        sale_id: params.id,
        product_id: item.productId,
        variant_id: item.variantId || null,
        quantity: item.quantity,
        product_name: item.productName,
        product_sku: item.productSku,
        variant_name: item.variantName || null,
        variant_value: item.variantValue || null,
        unit_price: (typeof item.unitPrice === "string" ? item.unitPrice : item.unitPrice.toString()),
        unit_cost: item.unitCost ? (typeof item.unitCost === "string" ? item.unitCost : item.unitCost.toString()) : null,
        unit_tax: item.unitTax || "0",
        unit_discount: item.unitDiscount || "0",
        subtotal: item.subtotal.toString(),
        stock_impacted: 0, // Se actualizará cuando se confirme
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
    
    // SPRINT A: Obtener la venta completa con items y snapshot
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

