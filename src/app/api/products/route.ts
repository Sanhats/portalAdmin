import { supabase } from "@/lib/supabase";
import { createProductSchema, productUpdateSchema } from "@/validations/product";
import { createProductSprint1Schema } from "@/validations/product-sprint1";
import { createProductSprint3Schema } from "@/validations/product-sprint3";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError, validatePagination } from "@/lib/api-response";

// GET /api/products - Listar productos con filtros, paginación e includes
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Validar y normalizar parámetros de paginación
    const { page, limit, offset } = validatePagination(
      searchParams.get("page"),
      searchParams.get("limit")
    );
    
    // Filtros
    const storeId = searchParams.get("storeId"); // SPRINT 6: Multi-tenant
    const categoryId = searchParams.get("categoryId");
    const categorySlug = searchParams.get("categorySlug");
    const isFeatured = searchParams.get("isFeatured");
    const search = searchParams.get("search");
    const includeDeleted = searchParams.get("includeDeleted") === "true"; // SPRINT 6: Opcional incluir eliminados
    
    // Si se proporciona categorySlug, obtener el categoryId primero
    let finalCategoryId = categoryId;
    if (categorySlug && !categoryId) {
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .single();
      
      if (category) {
        finalCategoryId = category.id;
      } else {
        // Si no se encuentra la categoría por slug, retornar array vacío
        return jsonResponse({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }
    }
    
    // Construir query base
    let query = supabase
      .from("products")
      .select(`
        *,
        categories:category_id (
          id,
          name,
          slug
        ),
        product_images (
          id,
          image_url
        ),
        variants (
          id,
          name,
          value
        )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    
    // SPRINT 6: Filtrar por store_id (multi-tenant)
    if (storeId) {
      query = query.eq("store_id", storeId);
    }
    
    // SPRINT 6: Excluir eliminados (soft delete) a menos que se solicite incluirlos
    if (!includeDeleted) {
      query = query.is("deleted_at", null);
    }
    
    // Aplicar filtros
    if (finalCategoryId) {
      query = query.eq("category_id", finalCategoryId);
    }
    
    if (isFeatured === "true") {
      query = query.eq("is_featured", true);
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,name_internal.ilike.%${search}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[GET /api/products] Error de Supabase:", error);
      return errorResponse("Error al obtener productos", 500, error.message, error.code);
    }
    
    // Obtener total para paginación
    let countQuery = supabase.from("products").select("*", { count: "exact", head: true });
    
    // SPRINT 6: Aplicar mismos filtros al count
    if (storeId) {
      countQuery = countQuery.eq("store_id", storeId);
    }
    
    if (!includeDeleted) {
      countQuery = countQuery.is("deleted_at", null);
    }
    
    if (finalCategoryId) {
      countQuery = countQuery.eq("category_id", finalCategoryId);
    }
    
    if (isFeatured === "true") {
      countQuery = countQuery.eq("is_featured", true);
    }
    
    if (search) {
      countQuery = countQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%,name_internal.ilike.%${search}%`);
    }
    
    const { count: total, error: countError } = await countQuery;
    
    if (countError) {
      console.error("[GET /api/products] Error al contar productos:", countError);
      return errorResponse("Error al contar productos", 500, countError.message, countError.code);
    }
    
    return jsonResponse({
      data: data || [],
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/products");
  }
}

// POST /api/products - Crear nuevo producto
// Soporta dos modos:
// - SPRINT 2: Carga rápida (campos planos)
// - SPRINT 3: Carga completa (estructura anidada con internal/public)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Log para debugging
    console.log("[POST /api/products] Body recibido:", JSON.stringify(body, null, 2));
    
    // SPRINT 6: Obtener store_id del body o header (multi-tenant)
    let storeId = body.storeId || req.headers.get("x-store-id");
    
    if (!storeId) {
      // Si no se proporciona store_id, usar store por defecto
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (!defaultStore) {
        return errorResponse("No se encontró store por defecto. Proporciona storeId en el body o header x-store-id", 400);
      }
      
      // Usar store por defecto
      storeId = defaultStore.id;
      console.log("[POST /api/products] Usando store por defecto:", storeId);
    }
    
    // Detectar si es SPRINT 3 (estructura anidada) o SPRINT 2 (campos planos)
    const isSprint3 = body.internal && body.public;
    
    let productToInsert: any;
    let variants: any[] = [];
    let images: any[] = [];
    let publicData: any = null;
    
    if (isSprint3) {
      // SPRINT 3: Carga completa con estructura anidada
      console.log("[POST /api/products] Modo: SPRINT 3 (Carga completa)");
      
      const parsed = createProductSprint3Schema.safeParse(body);
      
      if (!parsed.success) {
        console.error("[POST /api/products] Error de validación SPRINT 3:", parsed.error.errors);
        return errorResponse("Datos inválidos", 400, parsed.error.errors);
      }
      
      const data = parsed.data;
      
      // Datos internos del producto
      productToInsert = {
        store_id: storeId, // SPRINT 6: Multi-tenant
        sku: data.sku,
        name_internal: data.internal.nameInternal,
        price: typeof data.internal.price === "number" 
          ? data.internal.price.toString() 
          : data.internal.price,
        stock: data.internal.stock,
        category_id: data.internal.categoryId || null,
        is_active: data.internal.isActive,
        is_visible: data.internal.isVisible,
      };
      
      // Datos públicos (se insertarán en product_public_data)
      publicData = {
        name: data.public.name,
        slug: data.public.slug,
        description: data.public.description || null,
        is_featured: data.public.isFeatured ?? false,
      };
      
      // Variantes e imágenes
      variants = data.variants || [];
      images = data.images || [];
      
    } else {
      // SPRINT 2: Carga rápida (campos planos)
      console.log("[POST /api/products] Modo: SPRINT 2 (Carga rápida)");
      
      const parsed = createProductSprint1Schema.safeParse(body);
      
      if (!parsed.success) {
        console.error("[POST /api/products] Error de validación SPRINT 2:", parsed.error.errors);
        return errorResponse("Datos inválidos", 400, parsed.error.errors);
      }
      
      const productData = parsed.data;
      
      productToInsert = {
        store_id: storeId, // SPRINT 6: Multi-tenant
        sku: productData.sku,
        name_internal: productData.nameInternal,
        price: typeof productData.price === "number" 
          ? productData.price.toString() 
          : productData.price,
        stock: productData.stock ?? 0,
        category_id: productData.categoryId || null,
        description: productData.description || null,
        is_active: productData.isActive ?? true,
        is_visible: productData.isVisible ?? false,
      };
    }
    
    console.log("[POST /api/products] Producto a insertar:", JSON.stringify(productToInsert, null, 2));
    
    // Crear el producto
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert(productToInsert)
      .select()
      .single();
    
    if (productError) {
      console.error("[POST /api/products] Error al crear producto:", productError);
      return errorResponse(
        "Error al crear el producto",
        500,
        productError.message,
        productError.code,
        productError.hint
      );
    }
    
    if (!product) {
      console.error("[POST /api/products] Producto no retornado después de insertar");
      return errorResponse("Error al crear el producto", 500);
    }
    
    console.log("[POST /api/products] Producto creado exitosamente:", product.id);
    
    // SPRINT 3: Insertar datos públicos
    if (isSprint3 && publicData) {
      const { error: publicDataError } = await supabase
        .from("product_public_data")
        .insert({
          product_id: product.id,
          ...publicData,
        });
      
      if (publicDataError) {
        console.error("[POST /api/products] Error al crear datos públicos:", publicDataError);
        // Rollback: eliminar producto creado
        await supabase.from("products").delete().eq("id", product.id);
        return errorResponse(
          "Error al crear datos públicos del producto",
          500,
          publicDataError.message,
          publicDataError.code
        );
      }
    }
    
    // Insertar variantes si existen
    if (variants.length > 0) {
      const variantsToInsert = variants.map((variant) => ({
        product_id: product.id,
        name: variant.name,
        value: variant.value,
      }));
      
      const { error: variantsError } = await supabase
        .from("variants")
        .insert(variantsToInsert);
      
      if (variantsError) {
        console.error("[POST /api/products] Error al insertar variantes:", variantsError);
        // Rollback: eliminar producto y datos públicos
        await supabase.from("products").delete().eq("id", product.id);
        if (isSprint3) {
          await supabase.from("product_public_data").delete().eq("product_id", product.id);
        }
        return errorResponse(
          "Error al insertar variantes",
          500,
          variantsError.message,
          variantsError.code
        );
      }
    }
    
    // Insertar imágenes si existen
    if (images.length > 0) {
      const imagesToInsert = images.map((image) => ({
        product_id: product.id,
        image_url: image.imageUrl,
      }));
      
      const { error: imagesError } = await supabase
        .from("product_images")
        .insert(imagesToInsert);
      
      if (imagesError) {
        console.error("[POST /api/products] Error al insertar imágenes:", imagesError);
        // Rollback: eliminar producto, datos públicos y variantes
        await supabase.from("products").delete().eq("id", product.id);
        if (isSprint3) {
          await supabase.from("product_public_data").delete().eq("product_id", product.id);
        }
        await supabase.from("variants").delete().eq("product_id", product.id);
        return errorResponse(
          "Error al insertar imágenes",
          500,
          imagesError.message,
          imagesError.code
        );
      }
    }
    
    // Obtener el producto completo con relaciones
    let selectQuery = `
      *,
      categories:category_id (
        id,
        name,
        slug
      ),
      product_images (
        id,
        image_url
      ),
      variants (
        id,
        name,
        value
      )
    `;
    
    if (isSprint3) {
      selectQuery += `,
      product_public_data (
        id,
        name,
        slug,
        description,
        is_featured
      )`;
    }
    
    const { data: completeProduct, error: fetchError } = await supabase
      .from("products")
      .select(selectQuery)
      .eq("id", product.id)
      .single();
    
    if (fetchError) {
      console.error("[POST /api/products] Error al obtener producto completo:", fetchError);
      return errorResponse(
        "Error al obtener el producto completo",
        500,
        fetchError.message,
        fetchError.code
      );
    }
    
    return jsonResponse(completeProduct, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/products");
  }
}

