import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";

// Validar UUID
const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// DELETE /api/categories/[id] - Eliminar categoría
// Regla de negocio:
// - Si hay productos asociados a esta categoría, NO se eliminan.
// - En su lugar, se les deja sin categoría (category_id = null).
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

    const categoryId = params.id;

    // Verificar que la categoría existe
    const { data: existingCategory, error: checkError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .single();

    if (checkError || !existingCategory) {
      return errorResponse("Categoría no encontrada", 404);
    }

    // Desasociar productos: poner category_id = null en todos los productos de esta categoría
    const { error: detachError, count } = await supabase
      .from("products")
      .update({ category_id: null })
      .eq("category_id", categoryId)
      .select("id", { count: "exact" });

    if (detachError) {
      console.error("[DELETE /api/categories/[id]] Error al desasociar productos:", detachError);
      return errorResponse(
        "Error al desasociar productos de la categoría",
        500,
        detachError.message,
        detachError.code
      );
    }

    console.log(
      "[DELETE /api/categories/[id]] Productos desasociados de la categoría:",
      count ?? 0
    );

    // Eliminar categoría
    const { error: deleteError } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId);

    if (deleteError) {
      console.error("[DELETE /api/categories/[id]] Error al eliminar categoría:", deleteError);
      return errorResponse("Error al eliminar la categoría", 500, deleteError.message, deleteError.code);
    }

    console.log("[DELETE /api/categories/[id]] Categoría eliminada exitosamente:", categoryId);

    return jsonResponse(
      {
        message: "Categoría eliminada correctamente. Los productos asociados quedaron sin categoría.",
        detachedProductsCount: count ?? 0,
      },
      200
    );
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/categories/[id]");
  }
}


