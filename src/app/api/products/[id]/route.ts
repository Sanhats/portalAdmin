import { supabase } from "@/lib/supabase";
import { productUpdateSchema } from "@/validations/product";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";

// Validar UUID
const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

/**
 * Normaliza un producto de la BD a la estructura esperada por el frontend
 * Incluye is_active, is_visible y status calculado
 */
function normalizeProductDetail(product: any) {
  // Determinar status basado en is_active e is_visible
  let status = "draft";
  if (product.is_active && product.is_visible) {
    status = "active";
  } else if (product.is_active && !product.is_visible) {
    status = "draft";
  } else {
    status = "hidden"; // Producto inactivo o oculto
  }

  return {
    ...product,
    is_active: product.is_active ?? true,
    is_visible: product.is_visible ?? false,
    status,
  };
}

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
      .is("deleted_at", null) // SPRINT 6: Excluir eliminados (soft delete)
      .single();
    
    if (error) {
      if (error.code === "PGRST116") {
        return errorResponse("Producto no encontrado", 404);
      }
      console.error("[GET /api/products/[id]] Error de Supabase:", error);
      return errorResponse("Error al obtener el producto", 500, error.message, error.code);
    }
    
    if (!data) {
      return errorResponse("Producto no encontrado", 404);
    }
    
    // Normalizar producto para incluir status calculado
    const normalizedProduct = normalizeProductDetail(data);
    
    return jsonResponse(normalizedProduct);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/products/[id]");
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
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }
    
    const body = await req.json();
    console.log("[PUT /api/products/[id]] Body recibido:", body);

    // Normalizar categoría: aceptar tanto categoryId (camelCase) como category_id (snake_case)
    const normalizedBody = {
      ...body,
      categoryId:
        body.categoryId !== undefined
          ? body.categoryId
          : body.category_id !== undefined
            ? body.category_id
            : body.categoryId,
    };

    const parsed = productUpdateSchema.safeParse(normalizedBody);
    
    if (!parsed.success) {
      console.error("[PUT /api/products/[id]] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    // Verificar que el producto existe y no está eliminado (SPRINT 6: soft delete)
    const { data: existingProduct, error: checkError } = await supabase
      .from("products")
      .select("id")
      .eq("id", params.id)
      .is("deleted_at", null) // SPRINT 6: Excluir eliminados
      .single();
    
    if (checkError || !existingProduct) {
      return errorResponse("Producto no encontrado", 404);
    }
    
    const { variants, images, product_images, status, ...productData } = parsed.data;
    
    // Normalizar: usar product_images si images está vacío o no está definido
    const normalizedImages = (images !== undefined) ? images : product_images;
    
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
    // Campos de estado / visibilidad
    if (productData.isActive !== undefined) productUpdate.is_active = productData.isActive;
    if (productData.isVisible !== undefined) productUpdate.is_visible = productData.isVisible;
    // Si viene status directamente, mapear a is_active / is_visible
    if (status !== undefined) {
      if (status === "draft") {
        productUpdate.is_active = true;
        productUpdate.is_visible = false;
      } else if (status === "active") {
        productUpdate.is_active = true;
        productUpdate.is_visible = true;
      } else if (status === "hidden") {
        // Interpretamos hidden como is_active=false, is_visible=false
        // (el frontend igual puede derivar el estado desde is_active/is_visible)
        productUpdate.is_active = false;
        productUpdate.is_visible = false;
      }
    }
    if (productData.categoryId !== undefined) {
      productUpdate.category_id = productData.categoryId || null;
    }

    console.log("[PUT /api/products/[id]] Campos de producto a actualizar:", productUpdate);
    
    // Actualizar producto solo si hay campos para actualizar
    if (Object.keys(productUpdate).length > 0) {
      const { error: updateError } = await supabase
        .from("products")
        .update(productUpdate)
        .eq("id", params.id);
      
      if (updateError) {
        console.error("[PUT /api/products/[id]] Error al actualizar producto:", updateError);
        return errorResponse("Error al actualizar el producto", 500, updateError.message, updateError.code);
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
        console.error("[PUT /api/products/[id]] Error al eliminar variantes:", deleteVariantsError);
        return errorResponse("Error al eliminar variantes", 500, deleteVariantsError.message, deleteVariantsError.code);
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
          console.error("[PUT /api/products/[id]] Error al insertar variantes:", insertVariantsError);
          return errorResponse("Error al insertar variantes", 500, insertVariantsError.message, insertVariantsError.code);
        }
      }
    }
    
    // Actualizar imágenes si se proporcionan
    if (normalizedImages !== undefined) {
      // Eliminar imágenes existentes
      const { error: deleteImagesError } = await supabase
        .from("product_images")
        .delete()
        .eq("product_id", params.id);
      
      if (deleteImagesError) {
        console.error("[PUT /api/products/[id]] Error al eliminar imágenes existentes:", deleteImagesError);
        return errorResponse(
          "Error al eliminar imágenes existentes",
          500,
          deleteImagesError.message,
          deleteImagesError.code
        );
      }
      
      // Insertar nuevas imágenes si hay alguna
      if (normalizedImages.length > 0) {
        const imagesToInsert = normalizedImages.map((image) => {
          // Aceptar tanto imageUrl como image_url para compatibilidad
          const imageUrl = image.imageUrl || (image as any).image_url;
          if (!imageUrl) {
            throw new Error("Cada imagen debe tener 'imageUrl' o 'image_url'");
          }
          return {
            product_id: params.id,
            image_url: imageUrl,
          };
        });
        
        console.log("Insertando imágenes actualizadas:", imagesToInsert);
        
        const { error: insertImagesError, data: insertedImages } = await supabase
          .from("product_images")
          .insert(imagesToInsert)
          .select();
        
        if (insertImagesError) {
          console.error("[PUT /api/products/[id]] Error al insertar imágenes:", insertImagesError);
          return errorResponse(
            "Error al insertar imágenes",
            500,
            insertImagesError.message,
            insertImagesError.code,
            insertImagesError.hint
          );
        }
        
        console.log("[PUT /api/products/[id]] Imágenes actualizadas correctamente:", insertedImages?.length || 0);
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
      console.error("[PUT /api/products/[id]] Error al obtener producto actualizado:", fetchError);
      return errorResponse("Error al obtener el producto actualizado", 500, fetchError.message, fetchError.code);
    }
    
    // Normalizar producto para incluir status calculado
    const normalizedProduct = normalizeProductDetail(updatedProduct);
    
    return jsonResponse(normalizedProduct);
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/products/[id]");
  }
}

// PATCH /api/products/[id] - Actualizar producto parcialmente (SPRINT 5)
// Similar a PUT pero más enfocado en actualización parcial
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }
    
    const body = await req.json();
    console.log("[PATCH /api/products/[id]] Body recibido:", body);

    // Normalizar categoría: aceptar tanto categoryId (camelCase) como category_id (snake_case)
    const normalizedBody = {
      ...body,
      categoryId:
        body.categoryId !== undefined
          ? body.categoryId
          : body.category_id !== undefined
            ? body.category_id
            : body.categoryId,
    };

    const parsed = productUpdateSchema.safeParse(normalizedBody);
    
    if (!parsed.success) {
      console.error("[PATCH /api/products/[id]] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    // Verificar que el producto existe y no está eliminado (SPRINT 6: soft delete)
    const { data: existingProduct, error: checkError } = await supabase
      .from("products")
      .select("id, stock")
      .eq("id", params.id)
      .is("deleted_at", null) // SPRINT 6: Excluir eliminados
      .single();
    
    if (checkError || !existingProduct) {
      return errorResponse("Producto no encontrado", 404);
    }
    
    const { variants, images, product_images, status, ...productData } = parsed.data;
    
    // Normalizar: usar product_images si images está vacío o no está definido
    const normalizedImages = (images !== undefined) ? images : (product_images || []);
    
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
    
    // SPRINT 5: Validar que stock no sea negativo
    if (productData.stock !== undefined) {
      const stockValue = typeof productData.stock === "number" ? productData.stock : parseInt(productData.stock);
      if (isNaN(stockValue) || stockValue < 0) {
        return errorResponse("El stock debe ser un número entero no negativo", 400);
      }
      productUpdate.stock = stockValue;
    }
    
    if (productData.isFeatured !== undefined) productUpdate.is_featured = productData.isFeatured;
    if (productData.categoryId !== undefined) {
      productUpdate.category_id = productData.categoryId || null;
    }
    
    // SPRINT 5: Validar campos del SPRINT 1/2
    if (productData.nameInternal !== undefined) productUpdate.name_internal = productData.nameInternal;
    if (productData.isActive !== undefined) productUpdate.is_active = productData.isActive;
    if (productData.isVisible !== undefined) productUpdate.is_visible = productData.isVisible;
    // Si viene status directamente, mapear a is_active / is_visible
    if (status !== undefined) {
      if (status === "draft") {
        productUpdate.is_active = true;
        productUpdate.is_visible = false;
      } else if (status === "active") {
        productUpdate.is_active = true;
        productUpdate.is_visible = true;
      } else if (status === "hidden") {
        productUpdate.is_active = false;
        productUpdate.is_visible = false;
      }
    }

    console.log("[PATCH /api/products/[id]] Campos de producto a actualizar:", productUpdate);
    
    // Actualizar producto solo si hay campos para actualizar
    if (Object.keys(productUpdate).length > 0) {
      const { error: updateError } = await supabase
        .from("products")
        .update(productUpdate)
        .eq("id", params.id);
      
      if (updateError) {
        console.error("[PATCH /api/products/[id]] Error al actualizar producto:", updateError);
        return errorResponse("Error al actualizar el producto", 500, updateError.message, updateError.code);
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
        console.error("[PATCH /api/products/[id]] Error al eliminar variantes:", deleteVariantsError);
        return errorResponse("Error al eliminar variantes", 500, deleteVariantsError.message, deleteVariantsError.code);
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
          console.error("[PATCH /api/products/[id]] Error al insertar variantes:", insertVariantsError);
          return errorResponse("Error al insertar variantes", 500, insertVariantsError.message, insertVariantsError.code);
        }
      }
    }
    
    // Actualizar imágenes si se proporcionan
    if (normalizedImages !== undefined) {
      // Eliminar imágenes existentes
      const { error: deleteImagesError } = await supabase
        .from("product_images")
        .delete()
        .eq("product_id", params.id);
      
      if (deleteImagesError) {
        console.error("[PATCH /api/products/[id]] Error al eliminar imágenes existentes:", deleteImagesError);
        return errorResponse(
          "Error al eliminar imágenes existentes",
          500,
          deleteImagesError.message,
          deleteImagesError.code
        );
      }
      
      // Insertar nuevas imágenes si hay alguna
      if (normalizedImages.length > 0) {
        const imagesToInsert = normalizedImages.map((image) => {
          // Aceptar tanto imageUrl como image_url para compatibilidad
          const imageUrl = image.imageUrl || (image as any).image_url;
          if (!imageUrl) {
            throw new Error("Cada imagen debe tener 'imageUrl' o 'image_url'");
          }
          return {
            product_id: params.id,
            image_url: imageUrl,
          };
        });
        
        console.log("Insertando imágenes actualizadas:", imagesToInsert);
        
        const { error: insertImagesError, data: insertedImages } = await supabase
          .from("product_images")
          .insert(imagesToInsert)
          .select();
        
        if (insertImagesError) {
          console.error("[PATCH /api/products/[id]] Error al insertar imágenes:", insertImagesError);
          return errorResponse(
            "Error al insertar imágenes",
            500,
            insertImagesError.message,
            insertImagesError.code,
            insertImagesError.hint
          );
        }
        
        console.log("[PATCH /api/products/[id]] Imágenes actualizadas correctamente:", insertedImages?.length || 0);
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
      console.error("[PATCH /api/products/[id]] Error al obtener producto actualizado:", fetchError);
      return errorResponse("Error al obtener el producto actualizado", 500, fetchError.message, fetchError.code);
    }
    
    // Normalizar producto para incluir status calculado
    const normalizedProduct = normalizeProductDetail(updatedProduct);
    
    return jsonResponse(normalizedProduct);
  } catch (error) {
    return handleUnexpectedError(error, "PATCH /api/products/[id]");
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
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }
    
    // Verificar que el producto existe y no está eliminado (SPRINT 6: soft delete)
    const { data: existingProduct, error: checkError } = await supabase
      .from("products")
      .select("id")
      .eq("id", params.id)
      .is("deleted_at", null) // SPRINT 6: Solo productos no eliminados
      .single();
    
    if (checkError || !existingProduct) {
      return errorResponse("Producto no encontrado", 404);
    }
    
    // SPRINT 6: Soft delete - marcar como eliminado en lugar de borrar físicamente
    const { error: deleteError } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id);
    
    if (deleteError) {
      console.error("[DELETE /api/products/[id]] Error al eliminar producto:", deleteError);
      return errorResponse("Error al eliminar el producto", 500, deleteError.message, deleteError.code);
    }
    
    console.log("[DELETE /api/products/[id]] Producto eliminado exitosamente (soft delete):", params.id);
    return jsonResponse({ 
      message: "Producto eliminado correctamente",
      deletedAt: new Date().toISOString()
    }, 200);
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/products/[id]");
  }
}

