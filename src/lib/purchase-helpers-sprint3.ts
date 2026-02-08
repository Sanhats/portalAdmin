/**
 * SPRINT 3: Helpers para compras del módulo de Compras
 * Incluye: crear compra con transacción, validar proveedor, generar movimientos de stock
 */

import { supabase } from "@/lib/supabase";

export interface PurchaseItemInput {
  productId: string;
  quantity: number | string;
  unitCost: number | string;
}

export interface PurchaseTotals {
  totalAmount: number;
}

/**
 * Valida que un proveedor exista y esté activo
 */
export async function validateSupplier(
  supplierId: string,
  tenantId: string
): Promise<{ valid: boolean; error?: string }> {
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .select("id, tenant_id, is_active")
    .eq("id", supplierId)
    .eq("is_active", true) // SPRINT 3: Solo proveedores activos
    .single();

  if (error || !supplier) {
    return { valid: false, error: `Proveedor ${supplierId} no encontrado` };
  }

  if (supplier.tenant_id !== tenantId) {
    return { valid: false, error: "El proveedor no pertenece al tenant" };
  }

  if (!supplier.is_active) {
    return { valid: false, error: "El proveedor está inactivo" };
  }

  return { valid: true };
}

/**
 * Valida que todos los productos existan
 */
export async function validateProducts(
  productIds: string[],
  tenantId: string
): Promise<{ valid: boolean; error?: string; products?: any[] }> {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, store_id")
    .in("id", productIds)
    .is("deleted_at", null);

  if (error) {
    return { valid: false, error: `Error al validar productos: ${error.message}` };
  }

  if (!products || products.length !== productIds.length) {
    return { valid: false, error: "Uno o más productos no existen" };
  }

  // Validar que todos pertenezcan al tenant
  const invalidProducts = products.filter((p) => p.store_id !== tenantId);
  if (invalidProducts.length > 0) {
    return { valid: false, error: "Uno o más productos no pertenecen al tenant" };
  }

  return { valid: true, products };
}

/**
 * Calcula el total de una compra desde los items
 */
export function calculatePurchaseTotal(
  items: Array<{ quantity: number; unitCost: number }>
): PurchaseTotals {
  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );

  return {
    totalAmount: Math.max(0, totalAmount),
  };
}

/**
 * Normaliza la fecha de compra a inicio del día (00:00:00)
 */
export function normalizePurchaseDate(date: string | Date): string {
  let dateObj: Date;
  
  if (typeof date === "string") {
    // Si es solo fecha (YYYY-MM-DD), agregar hora 00:00:00
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      dateObj = new Date(date + "T00:00:00");
    } else {
      dateObj = new Date(date);
    }
  } else {
    dateObj = date;
  }

  // Asegurar que sea inicio del día
  dateObj.setHours(0, 0, 0, 0);
  
  return dateObj.toISOString();
}

/**
 * Crea movimientos de stock para una compra
 */
export async function createStockMovementsForPurchase(
  tenantId: string,
  purchaseId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<void> {
  const movements = items.map((item) => ({
    tenant_id: tenantId,
    product_id: item.productId,
    type: "purchase",
    quantity: Math.abs(item.quantity), // Positivo para entrada
    reference_id: purchaseId,
  }));

  const { error } = await supabase
    .from("stock_movements")
    .insert(movements);

  if (error) {
    throw new Error(`Error al crear movimientos de stock: ${error.message}`);
  }
}

/**
 * Crea una compra completa con transacción
 * Incluye: validaciones, creación de purchase, purchase_items, stock_movements
 */
export async function createPurchaseWithTransaction(
  tenantId: string,
  supplierId: string,
  purchaseDate: string | Date,
  invoiceNumber: string | null,
  notes: string | null,
  items: PurchaseItemInput[]
): Promise<{
  purchase: any;
  purchaseItems: any[];
  stockMovements: number;
}> {
  // 1. Validar proveedor
  const supplierValidation = await validateSupplier(supplierId, tenantId);
  if (!supplierValidation.valid) {
    throw new Error(supplierValidation.error || "Error al validar proveedor");
  }

  // 2. Validar productos
  const productIds = items.map((item) => item.productId);
  const productsValidation = await validateProducts(productIds, tenantId);
  if (!productsValidation.valid) {
    throw new Error(productsValidation.error || "Error al validar productos");
  }

  // 3. Normalizar items (convertir strings a números)
  const normalizedItems = items.map((item) => ({
    productId: item.productId,
    quantity: typeof item.quantity === "string" ? parseFloat(item.quantity) : item.quantity,
    unitCost: typeof item.unitCost === "string" ? parseFloat(item.unitCost) : item.unitCost,
  }));

  // 4. Validar que quantity > 0
  for (const item of normalizedItems) {
    if (item.quantity <= 0) {
      throw new Error(`La cantidad debe ser mayor a 0 para el producto ${item.productId}`);
    }
  }

  // 5. Calcular totales
  const totals = calculatePurchaseTotal(normalizedItems);

  // 6. Normalizar fecha
  const normalizedDate = normalizePurchaseDate(purchaseDate);

  // 7. Crear purchase
  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      invoice_number: invoiceNumber || null,
      purchase_date: normalizedDate,
      total_amount: totals.totalAmount.toString(),
      notes: notes || null,
    })
    .select()
    .single();

  if (purchaseError || !purchase) {
    throw new Error(`Error al crear compra: ${purchaseError?.message || "Error desconocido"}`);
  }

  // 8. Crear purchase_items
  const purchaseItemsData = normalizedItems.map((item) => ({
    purchase_id: purchase.id,
    product_id: item.productId,
    quantity: item.quantity.toString(),
    unit_cost: item.unitCost.toString(),
    subtotal: (item.quantity * item.unitCost).toString(),
  }));

  const { data: purchaseItems, error: itemsError } = await supabase
    .from("purchase_items")
    .insert(purchaseItemsData)
    .select();

  if (itemsError || !purchaseItems) {
    // Rollback: eliminar purchase creada
    await supabase.from("purchases").delete().eq("id", purchase.id);
    throw new Error(`Error al crear items de compra: ${itemsError?.message || "Error desconocido"}`);
  }

  // 9. Crear movimientos de stock
  try {
    await createStockMovementsForPurchase(
      tenantId,
      purchase.id,
      normalizedItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }))
    );
  } catch (stockError: any) {
    // Rollback: eliminar purchase e items
    await supabase.from("purchase_items").delete().eq("purchase_id", purchase.id);
    await supabase.from("purchases").delete().eq("id", purchase.id);
    throw new Error(`Error al crear movimientos de stock: ${stockError.message}`);
  }

  return {
    purchase,
    purchaseItems,
    stockMovements: normalizedItems.length,
  };
}
