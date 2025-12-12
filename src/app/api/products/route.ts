import { supabase } from "@/lib/supabase";
import { createProductSchema, productUpdateSchema } from "@/validations/product";
import { z } from "zod";

// GET /api/products - Listar productos con filtros, paginación e includes
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Parámetros de paginación
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    
    // Filtros
    const categoryId = searchParams.get("categoryId");
    const isFeatured = searchParams.get("isFeatured");
    const search = searchParams.get("search");
    
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
    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }
    
    if (isFeatured === "true") {
      query = query.eq("is_featured", true);
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    
    // Obtener total para paginación
    let countQuery = supabase.from("products").select("*", { count: "exact", head: true });
    
    if (categoryId) {
      countQuery = countQuery.eq("category_id", categoryId);
    }
    
    if (isFeatured === "true") {
      countQuery = countQuery.eq("is_featured", true);
    }
    
    if (search) {
      countQuery = countQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    const { count: total } = await countQuery;
    
    return Response.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
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
      console.error("Error de validación:", parsed.error.errors);
      return Response.json(
        { error: "Datos inválidos", details: parsed.error.errors },
        { status: 400 }
      );
    }
    
    const { variants, images, ...productData } = parsed.data;
    
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
      console.error("Error al crear producto:", productError);
      return Response.json(
        { 
          error: "Error al crear el producto",
          details: productError.message,
          code: productError.code,
          hint: productError.hint
        },
        { status: 500 }
      );
    }
    
    if (!product) {
      return Response.json({ error: "Error al crear el producto" }, { status: 500 });
    }
    
    console.log("Producto creado:", product.id);
    
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
        console.error("Error al insertar variantes:", variantsError);
        // Si falla la inserción de variantes, eliminar el producto creado
        await supabase.from("products").delete().eq("id", product.id);
        return Response.json(
          { 
            error: "Error al insertar variantes",
            details: variantsError.message,
            code: variantsError.code
          },
          { status: 500 }
        );
      }
    }
    
    // Insertar imágenes si existen
    if (images && images.length > 0) {
      console.log("Insertando imágenes:", images);
      const imagesToInsert = images.map((image) => ({
        product_id: product.id,
        image_url: image.imageUrl,
      }));
      
      console.log("Imágenes a insertar:", JSON.stringify(imagesToInsert, null, 2));
      
      const { error: imagesError } = await supabase
        .from("product_images")
        .insert(imagesToInsert);
      
      if (imagesError) {
        console.error("Error al insertar imágenes:", imagesError);
        // Si falla la inserción de imágenes, eliminar el producto y variantes
        await supabase.from("products").delete().eq("id", product.id);
        return Response.json(
          { 
            error: "Error al insertar imágenes",
            details: imagesError.message,
            code: imagesError.code,
            hint: imagesError.hint
          },
          { status: 500 }
        );
      }
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
      console.error("Error al obtener producto completo:", fetchError);
      return Response.json(
        { 
          error: "Error al obtener el producto completo",
          details: fetchError.message
        },
        { status: 500 }
      );
    }
    
    return Response.json(completeProduct, { status: 201 });
  } catch (error) {
    console.error("Error inesperado en POST /api/products:", error);
    return Response.json(
      { 
        error: error instanceof Error ? error.message : "Error desconocido",
        type: "unexpected_error",
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

