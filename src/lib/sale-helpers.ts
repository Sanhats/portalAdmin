/**
 * Helpers para el sistema de ventas
 * SPRINT A: Consolidación de Ventas Internas
 */

import { supabase } from "@/lib/supabase";

export interface SaleItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number | string;
  unitCost?: number | string;
  unitTax?: number | string;
  unitDiscount?: number | string;
}

export interface CalculatedSaleItem extends SaleItemInput {
  productName?: string;
  productSku?: string;
  variantName?: string;
  variantValue?: string;
  subtotal: number;
  stockImpacted: number;
}

export interface CalculatedTotals {
  subtotal: number;
  taxes: number;
  discounts: number;
  totalAmount: number;
  costAmount: number;
}

/**
 * Calcula los totales de una venta basándose en los items
 */
export async function calculateSaleTotals(
  items: SaleItemInput[],
  providedSubtotal?: number | string,
  providedTaxes?: number | string,
  providedDiscounts?: number | string
): Promise<CalculatedTotals> {
  let subtotal = 0;
  let taxes = 0;
  let discounts = 0;
  let costAmount = 0;

  // Calcular subtotal sumando todos los items
  for (const item of items) {
    const unitPrice = typeof item.unitPrice === "string" ? parseFloat(item.unitPrice) : item.unitPrice;
    const quantity = item.quantity;
    const itemSubtotal = unitPrice * quantity;
    subtotal += itemSubtotal;

    // Calcular impuestos del item
    const unitTax = item.unitTax 
      ? (typeof item.unitTax === "string" ? parseFloat(item.unitTax) : item.unitTax)
      : 0;
    taxes += unitTax * quantity;

    // Calcular descuentos del item
    const unitDiscount = item.unitDiscount
      ? (typeof item.unitDiscount === "string" ? parseFloat(item.unitDiscount) : item.unitDiscount)
      : 0;
    discounts += unitDiscount * quantity;

    // Calcular costo del item
    const unitCost = item.unitCost
      ? (typeof item.unitCost === "string" ? parseFloat(item.unitCost) : item.unitCost)
      : 0;
    costAmount += unitCost * quantity;
  }

  // Si se proporcionaron totales, usarlos (pero validar que sean consistentes)
  if (providedSubtotal !== undefined) {
    const providedSubtotalNum = typeof providedSubtotal === "string" 
      ? parseFloat(providedSubtotal) 
      : providedSubtotal;
    if (Math.abs(providedSubtotalNum - subtotal) > 0.01) {
      console.warn(`[calculateSaleTotals] Subtotal proporcionado (${providedSubtotalNum}) difiere del calculado (${subtotal})`);
    }
    subtotal = providedSubtotalNum;
  }

  if (providedTaxes !== undefined) {
    const providedTaxesNum = typeof providedTaxes === "string" 
      ? parseFloat(providedTaxes) 
      : providedTaxes;
    taxes = providedTaxesNum;
  }

  if (providedDiscounts !== undefined) {
    const providedDiscountsNum = typeof providedDiscounts === "string" 
      ? parseFloat(providedDiscounts) 
      : providedDiscounts;
    discounts = providedDiscountsNum;
  }

  // Total = subtotal + taxes - discounts
  const totalAmount = subtotal + taxes - discounts;

  return {
    subtotal,
    taxes,
    discounts,
    totalAmount,
    costAmount,
  };
}

/**
 * Obtiene el snapshot de productos y variantes para guardar en sale_items
 */
export async function getProductSnapshot(
  productId: string,
  variantId?: string | null
): Promise<{
  productName: string;
  productSku: string;
  variantName?: string;
  variantValue?: string;
}> {
  // Obtener producto
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("name_internal, sku")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    throw new Error(`Producto ${productId} no encontrado`);
  }

  const snapshot = {
    productName: product.name_internal,
    productSku: product.sku,
  };

  // Si hay variante, obtener sus datos
  if (variantId) {
    const { data: variant, error: variantError } = await supabase
      .from("variants")
      .select("name, value")
      .eq("id", variantId)
      .single();

    if (!variantError && variant) {
      return {
        ...snapshot,
        variantName: variant.name,
        variantValue: variant.value,
      };
    }
  }

  return snapshot;
}

/**
 * Prepara los items de venta con snapshot y cálculos
 */
export async function prepareSaleItems(
  items: SaleItemInput[]
): Promise<CalculatedSaleItem[]> {
  const preparedItems: CalculatedSaleItem[] = [];

  for (const item of items) {
    // Obtener snapshot del producto
    const snapshot = await getProductSnapshot(item.productId, item.variantId);

    // Calcular subtotal del item
    const unitPrice = typeof item.unitPrice === "string" 
      ? parseFloat(item.unitPrice) 
      : item.unitPrice;
    const quantity = item.quantity;
    const subtotal = unitPrice * quantity;

    // Calcular impuestos y descuentos
    const unitTax = item.unitTax 
      ? (typeof item.unitTax === "string" ? parseFloat(item.unitTax) : item.unitTax)
      : 0;
    const unitDiscount = item.unitDiscount
      ? (typeof item.unitDiscount === "string" ? parseFloat(item.unitDiscount) : item.unitDiscount)
      : 0;

    preparedItems.push({
      ...item,
      ...snapshot,
      subtotal,
      stockImpacted: 0, // Se actualizará cuando se confirme la venta
      unitTax: unitTax.toString(),
      unitDiscount: unitDiscount.toString(),
    });
  }

  return preparedItems;
}

