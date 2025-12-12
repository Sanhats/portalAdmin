import { supabase } from "@/lib/supabase";
import { updateProductSchema } from "@/validations/product";
import { z } from "zod";

// Validar UUID
const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// GET /api/products/[id] - Obtener producto por ID
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return Response.json(
        { error: "ID inválido", details: uuidValidation.error.errors },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase
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
      .eq("id", params.id)
      .single();
    
    if (error) {
      if (error.code === "PGRST116") {
        return Response.json({ error: "Producto no encontrado" }, { status: 404 });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - Actualizar producto
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return Response.json(
        { error: "ID inválido", details: uuidValidation.error.errors },
        { status: 400 }
      );
    }
    
    const body = await req.json();
    const parsed = updateProductSchema.safeParse(body);
    
    if (!parsed.success) {
      return Response.json(
        { error: "Datos inválidos", details: parsed.error.errors },
        { status: 400 }
      );
    }
    
    // Verificar que el producto existe
    const { data: existingProduct, error: checkError } = await supabase
      .from("products")
      .select("id")
      .eq("id", params.id)
      .single();
    
    if (checkError || !existingProduct) {
      return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    
    const { variants, images, ...productData } = parsed.data;
    
    // Preparar datos del producto para actualizar (mapear a nombres de BD)
    const productUpdate: any = {};
    
    if (productData.name !== undefined) productUpdate.name = productData.name;
    if (productData.slug !== undefined) productUpdate.slug = productData.slug;
    if (productData.description !== undefined) productUpdate.description = productData.description;
    if (productData.price !== undefined) {
      productUpdate.price = typeof productData.price === "number" 
        ? productData.price.toString() 
        : productData.price;
    }
    if (productData.stock !== undefined) productUpdate.stock = productData.stock;
    if (productData.isFeatured !== undefined) productUpdate.is_featured = productData.isFeatured;
    if (productData.categoryId !== undefined) {
      productUpdate.category_id = productData.categoryId || null;
    }
    
    // Actualizar producto solo si hay campos para actualizar
    if (Object.keys(productUpdate).length > 0) {
      const { error: updateError } = await supabase
        .from("products")
        .update(productUpdate)
        .eq("id", params.id);
      
      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 });
      }
    }
    
    // Actualizar variantes si se proporcionan
    if (variants !== undefined) {
      // Eliminar variantes existentes
      const { error: deleteVariantsError } = await supabase
        .from("variants")
        .delete()
        .eq("product_id", params.id);
      
      if (deleteVariantsError) {
        return Response.json({ error: deleteVariantsError.message }, { status: 500 });
      }
      
      // Insertar nuevas variantes si hay alguna
      if (variants.length > 0) {
        const variantsToInsert = variants.map((variant) => ({
          product_id: params.id,
          name: variant.name,
          value: variant.value,
        }));
        
        const { error: insertVariantsError } = await supabase
          .from("variants")
          .insert(variantsToInsert);
        
        if (insertVariantsError) {
          return Response.json({ error: insertVariantsError.message }, { status: 500 });
        }
      }
    }
    
    // Actualizar imágenes si se proporcionan
    if (images !== undefined) {
      // Eliminar imágenes existentes
      const { error: deleteImagesError } = await supabase
        .from("product_images")
        .delete()
        .eq("product_id", params.id);
      
      if (deleteImagesError) {
        return Response.json({ error: deleteImagesError.message }, { status: 500 });
      }
      
      // Insertar nuevas imágenes si hay alguna
      if (images.length > 0) {
        const imagesToInsert = images.map((image) => ({
          product_id: params.id,
          image_url: image.imageUrl,
        }));
        
        const { error: insertImagesError } = await supabase
          .from("product_images")
          .insert(imagesToInsert);
        
        if (insertImagesError) {
          return Response.json({ error: insertImagesError.message }, { status: 500 });
        }
      }
    }
    
    // Obtener el producto actualizado con relaciones
    const { data: updatedProduct, error: fetchError } = await supabase
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
      .eq("id", params.id)
      .single();
    
    if (fetchError) {
      return Response.json({ error: fetchError.message }, { status: 500 });
    }
    
    return Response.json(updatedProduct);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Eliminar producto
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return Response.json(
        { error: "ID inválido", details: uuidValidation.error.errors },
        { status: 400 }
      );
    }
    
    // Verificar que el producto existe
    const { data: existingProduct, error: checkError } = await supabase
      .from("products")
      .select("id")
      .eq("id", params.id)
      .single();
    
    if (checkError || !existingProduct) {
      return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    
    // Eliminar producto (las imágenes y variantes se eliminan en cascada)
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", params.id);
    
    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 });
    }
    
    return Response.json(
      { message: "Producto eliminado correctamente" },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

