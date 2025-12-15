import { supabase } from "@/lib/supabase";
import { createProductSchema, productUpdateSchema } from "@/validations/product";
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
    const categoryId = searchParams.get("categoryId");
    const categorySlug = searchParams.get("categorySlug");
    const isFeatured = searchParams.get("isFeatured");
    const search = searchParams.get("search");
    
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
    
    // Aplicar filtros
    if (finalCategoryId) {
      query = query.eq("category_id", finalCategoryId);
    }
    
    if (isFeatured === "true") {
      query = query.eq("is_featured", true);
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[GET /api/products] Error de Supabase:", error);
      return errorResponse("Error al obtener productos", 500, error.message, error.code);
    }
    
    // Obtener total para paginación
    let countQuery = supabase.from("products").select("*", { count: "exact", head: true });
    
    if (finalCategoryId) {
      countQuery = countQuery.eq("category_id", finalCategoryId);
    }
    
    if (isFeatured === "true") {
      countQuery = countQuery.eq("is_featured", true);
    }
    
    if (search) {
      countQuery = countQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
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
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Log para debugging
    console.log("Body recibido:", JSON.stringify(body, null, 2));
    
    const parsed = createProductSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[POST /api/products] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    const { variants, images, product_images, ...productData } = parsed.data;
    
    // Normalizar: usar product_images si images está vacío
    const normalizedImages = (images && images.length > 0) ? images : (product_images || []);
    
    // Convertir price a string si es number y mapear campos a nombres de BD
    const productToInsert: any = {
      name: productData.name,
      slug: productData.slug,
      description: productData.description || null,
      price: productData.price.toString(),
      stock: productData.stock ?? 0,
      is_featured: productData.isFeatured ?? false,
      category_id: productData.categoryId || null,
    };
    
    console.log("Producto a insertar:", JSON.stringify(productToInsert, null, 2));
    
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
    
    // Insertar variantes si existen
    if (variants && variants.length > 0) {
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
        // Si falla la inserción de variantes, eliminar el producto creado
        await supabase.from("products").delete().eq("id", product.id);
        return errorResponse(
          "Error al insertar variantes",
          500,
          variantsError.message,
          variantsError.code
        );
      }
    }
    
    // Insertar imágenes si existen
    if (normalizedImages && normalizedImages.length > 0) {
      console.log("Insertando imágenes:", normalizedImages);
      const imagesToInsert = normalizedImages.map((image) => {
        // Aceptar tanto imageUrl como image_url para compatibilidad
        const imageUrl = image.imageUrl || (image as any).image_url;
        if (!imageUrl) {
          throw new Error("Cada imagen debe tener 'imageUrl' o 'image_url'");
        }
        return {
          product_id: product.id,
          image_url: imageUrl,
        };
      });
      
      console.log("Imágenes a insertar:", JSON.stringify(imagesToInsert, null, 2));
      
      const { error: imagesError, data: insertedImages } = await supabase
        .from("product_images")
        .insert(imagesToInsert)
        .select();
      
      if (imagesError) {
        console.error("[POST /api/products] Error al insertar imágenes:", imagesError);
        // Si falla la inserción de imágenes, eliminar el producto y variantes
        await supabase.from("products").delete().eq("id", product.id);
        return errorResponse(
          "Error al insertar imágenes",
          500,
          imagesError.message,
          imagesError.code,
          imagesError.hint
        );
      }
      
      console.log("[POST /api/products] Imágenes insertadas correctamente:", insertedImages?.length || 0);
    }
    
    // Obtener el producto completo con relaciones
    const { data: completeProduct, error: fetchError } = await supabase
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

