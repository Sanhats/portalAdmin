/**
 * SPRINT 1: Endpoints para gestionar precios por lista
 * GET /api/products/:id/prices - Obtener precios del producto
 * PUT /api/products/:id/prices - Actualizar precios del producto
 */

import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// Validar UUID
const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// Schema para actualizar precios
const updatePricesSchema = z.object({
  priceList1: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El precio debe ser un número válido"),
    z.number().nonnegative("El precio debe ser un número no negativo")
  ]).optional().nullable(),
  priceList2: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El precio debe ser un número válido"),
    z.number().nonnegative("El precio debe ser un número no negativo")
  ]).optional().nullable(),
  priceList3: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El precio debe ser un número válido"),
    z.number().nonnegative("El precio debe ser un número no negativo")
  ]).optional().nullable(),
  priceList4: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "El precio debe ser un número válido"),
    z.number().nonnegative("El precio debe ser un número no negativo")
  ]).optional().nullable(),
});

// GET /api/products/:id/prices - Obtener precios del producto
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }

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

    // Verificar que el producto existe
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, store_id")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (productError || !product) {
      return errorResponse("Producto no encontrado", 404);
    }

    // Obtener precios del producto
    const { data: prices, error: pricesError } = await supabase
      .from("product_prices")
      .select("price_list_id, price, updated_at")
      .eq("product_id", params.id)
      .order("price_list_id", { ascending: true });

    if (pricesError) {
      console.error("[GET /api/products/:id/prices] Error:", pricesError);
      return errorResponse("Error al obtener precios", 500, pricesError.message, pricesError.code);
    }

    // Formatear respuesta
    const pricesMap: Record<number, { price: number; updatedAt: string }> = {};
    for (const price of prices || []) {
      pricesMap[price.price_list_id] = {
        price: parseFloat(price.price),
        updatedAt: price.updated_at,
      };
    }

    return jsonResponse({
      productId: params.id,
      prices: {
        priceList1: pricesMap[1] || null,
        priceList2: pricesMap[2] || null,
        priceList3: pricesMap[3] || null,
        priceList4: pricesMap[4] || null,
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/products/:id/prices");
  }
}

// PUT /api/products/:id/prices - Actualizar precios del producto
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }

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

    const body = await req.json();
    const parsed = updatePricesSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Verificar que el producto existe
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, store_id")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (productError || !product) {
      return errorResponse("Producto no encontrado", 404);
    }

    // Preparar precios para insertar/actualizar
    const pricesToUpsert: Array<{
      product_id: string;
      price_list_id: number;
      price: string;
    }> = [];

    if (parsed.data.priceList1 !== undefined && parsed.data.priceList1 !== null) {
      pricesToUpsert.push({
        product_id: params.id,
        price_list_id: 1,
        price: typeof parsed.data.priceList1 === "number" 
          ? parsed.data.priceList1.toString() 
          : parsed.data.priceList1,
      });
    }

    if (parsed.data.priceList2 !== undefined && parsed.data.priceList2 !== null) {
      pricesToUpsert.push({
        product_id: params.id,
        price_list_id: 2,
        price: typeof parsed.data.priceList2 === "number" 
          ? parsed.data.priceList2.toString() 
          : parsed.data.priceList2,
      });
    }

    if (parsed.data.priceList3 !== undefined && parsed.data.priceList3 !== null) {
      pricesToUpsert.push({
        product_id: params.id,
        price_list_id: 3,
        price: typeof parsed.data.priceList3 === "number" 
          ? parsed.data.priceList3.toString() 
          : parsed.data.priceList3,
      });
    }

    if (parsed.data.priceList4 !== undefined && parsed.data.priceList4 !== null) {
      pricesToUpsert.push({
        product_id: params.id,
        price_list_id: 4,
        price: typeof parsed.data.priceList4 === "number" 
          ? parsed.data.priceList4.toString() 
          : parsed.data.priceList4,
      });
    }

    if (pricesToUpsert.length === 0) {
      return errorResponse("Debe proporcionar al menos un precio", 400);
    }

    // Insertar o actualizar precios (upsert)
    const { error: upsertError } = await supabase
      .from("product_prices")
      .upsert(pricesToUpsert, {
        onConflict: "product_id,price_list_id",
      });

    if (upsertError) {
      console.error("[PUT /api/products/:id/prices] Error:", upsertError);
      return errorResponse("Error al actualizar precios", 500, upsertError.message, upsertError.code);
    }

    // Obtener precios actualizados
    const { data: updatedPrices, error: fetchError } = await supabase
      .from("product_prices")
      .select("price_list_id, price, updated_at")
      .eq("product_id", params.id)
      .order("price_list_id", { ascending: true });

    if (fetchError) {
      console.error("[PUT /api/products/:id/prices] Error al obtener precios actualizados:", fetchError);
      return errorResponse("Error al obtener precios actualizados", 500, fetchError.message, fetchError.code);
    }

    // Formatear respuesta
    const pricesMap: Record<number, { price: number; updatedAt: string }> = {};
    for (const price of updatedPrices || []) {
      pricesMap[price.price_list_id] = {
        price: parseFloat(price.price),
        updatedAt: price.updated_at,
      };
    }

    return jsonResponse({
      productId: params.id,
      prices: {
        priceList1: pricesMap[1] || null,
        priceList2: pricesMap[2] || null,
        priceList3: pricesMap[3] || null,
        priceList4: pricesMap[4] || null,
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/products/:id/prices");
  }
}
