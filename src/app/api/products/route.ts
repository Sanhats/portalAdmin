import { supabase } from "@/lib/supabase";
import { createProductSchema, productUpdateSchema } from "@/validations/product";
import { createProductSprint1Schema } from "@/validations/product-sprint1";
import { createProductSprint3Schema } from "@/validations/product-sprint3";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError, validatePagination } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken, isAdmin } from "@/lib/auth";

/**
 * Normaliza un producto de la BD a la estructura esperada por el frontend
 */
function normalizeProduct(product: any) {
  // Determinar status basado en is_active e is_visible
  let status = "draft";
  if (product.is_active && product.is_visible) {
    status = "active";
  } else if (product.is_active && !product.is_visible) {
    status = "draft";
  } else {
    status = "hidden"; // Producto inactivo o oculto
  }

  // Obtener datos públicos (puede venir como array o objeto en Supabase)
  const publicData = Array.isArray(product.product_public_data)
    ? product.product_public_data[0]
    : product.product_public_data;

  // Obtener nombre: preferir name de product_public_data, luego name_internal
  const name = publicData?.name || product.name_internal || product.name || "";

  // Obtener categoría normalizada (puede venir como objeto o array)
  const categoryData = Array.isArray(product.categories)
    ? product.categories[0]
    : product.categories;
  
  const category = categoryData
    ? {
        id: categoryData.id,
        name: categoryData.name,
      }
    : null;

  // Obtener imagen principal (primera imagen)
  const product_images = product.product_images && product.product_images.length > 0
    ? [{ image_url: product.product_images[0].image_url }]
    : [];

  return {
    id: product.id,
    name,
    price: parseFloat(product.price) || 0,
    stock: product.stock || 0,
    // Devolver tanto los flags crudos como el status derivado
    is_active: product.is_active,
    is_visible: product.is_visible,
    status,
    category,
    product_images,
  };
}

// GET /api/products - Listar productos con filtros, paginación e includes
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Verificar autenticación para limit=all
    const limitParam = searchParams.get("limit");
    const isAllMode = limitParam?.toLowerCase() === "all";
    
    let user = null;
    let userIsAdmin = false;
    
    if (isAllMode) {
      // Si se solicita limit=all, verificar autenticación y rol admin
      const authHeader = req.headers.get("authorization");
      const token = extractBearerToken(authHeader);
      
      if (!token) {
        return errorResponse("No autorizado. Token Bearer requerido para limit=all", 401);
      }
      
      user = await validateBearerToken(token);
      if (!user) {
        return errorResponse("No autorizado. Token inválido o expirado", 401);
      }
      
      userIsAdmin = isAdmin(user);
      if (!userIsAdmin) {
        return errorResponse("No autorizado. limit=all solo está disponible para administradores", 403);
      }
    }
    
    // Validar y normalizar parámetros de paginación
    let pagination;
    try {
      pagination = validatePagination(
        searchParams.get("page"),
        searchParams.get("limit"),
        userIsAdmin
      );
    } catch (error: any) {
      // Si validatePagination lanza error (p.ej. limit=all sin admin), retornar 403
      if (error.message.includes("limit=all")) {
        return errorResponse(error.message, 403);
      }
      // Otros errores de validación
      return errorResponse(`Parámetros de paginación inválidos: ${error.message}`, 400);
    }
    
    const { page, limit, offset, isAllMode: isAll } = pagination;
    
    // Filtros
    const storeId = searchParams.get("storeId"); // SPRINT 6: Multi-tenant
    const categoryId = searchParams.get("categoryId");
    const categorySlug = searchParams.get("categorySlug");
    const isFeatured = searchParams.get("isFeatured");
    const statusFilter = searchParams.get("status"); // "active", "draft", "hidden"
    const search = searchParams.get("search");
    const includeDeleted = searchParams.get("includeDeleted") === "true"; // SPRINT 6: Opcional incluir eliminados
    
    // Si se proporciona categorySlug, obtener el categoryId primero
    let finalCategoryId = categoryId;
    if (categorySlug && !categoryId) {
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .is("deleted_at", null)
        .single();
      
      if (category) {
        finalCategoryId = category.id;
      } else {
        // Si no se encuentra la categoría por slug, retornar array vacío
        return jsonResponse({
          data: [],
          total: 0,
          page: isAll ? 1 : page,
          limit: isAll ? "all" : limit,
          totalPages: isAll ? 1 : 0,
        });
      }
    }
    
    // Función auxiliar para construir filtros comunes
    const applyFilters = (query: any) => {
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
      
      // Filtro de status
      if (statusFilter) {
        if (statusFilter === "active") {
          query = query.eq("is_active", true).eq("is_visible", true);
        } else if (statusFilter === "draft") {
          query = query.eq("is_active", true).eq("is_visible", false);
        } else if (statusFilter === "hidden") {
          query = query.eq("is_active", false);
        }
      }
      
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,name_internal.ilike.%${search}%`);
      }
      
      return query;
    };
    
    // Obtener total primero (siempre usar count query separado para evitar problemas con joins)
    let countQuery = supabase.from("products").select("*", { count: "exact", head: true });
    countQuery = applyFilters(countQuery);
    
    const { count: total, error: countError } = await countQuery;
    
    if (countError) {
      console.error("[GET /api/products] Error al contar productos:", countError);
      return errorResponse("Error al contar productos", 500, countError.message, countError.code);
    }
    
    // Construir query base con joins para evitar N+1
    let query = supabase
      .from("products")
      .select(`
        id,
        name_internal,
        name,
        price,
        stock,
        is_active,
        is_visible,
        is_featured,
        category_id,
        categories:category_id (
          id,
          name,
          slug
        ),
        product_images (
          id,
          image_url
        ),
        product_public_data (
          id,
          name,
          slug,
          description,
          is_featured
        )
      `)
      .order("created_at", { ascending: false });
    
    // Aplicar filtros
    query = applyFilters(query);
    
    // Aplicar paginación solo si no es modo "all"
    if (!isAll && typeof limit === "number") {
      query = query.range(offset, offset + limit - 1);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[GET /api/products] Error de Supabase:", error);
      return errorResponse("Error al obtener productos", 500, error.message, error.code);
    }
    
    // Normalizar productos
    const normalizedProducts = (data || []).map(normalizeProduct);
    
    // Asegurar que total sea un número válido
    const totalCount = total || 0;
    
    // Calcular totalPages
    const totalPages = isAll ? 1 : (typeof limit === "number" ? Math.ceil(totalCount / limit) : 1);
    
    return jsonResponse({
      data: normalizedProducts,
      total: totalCount,
      page: isAll ? 1 : page,
      limit: isAll ? "all" : limit,
      totalPages,
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

