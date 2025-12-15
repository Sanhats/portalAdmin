import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";

const BUCKET_NAME = "product-images";

// DELETE /api/upload/[id] - Eliminar imagen de Supabase Storage
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // El id es el filePath (ej: "products/1234567890-abc123.jpg")
    const filePath = params.id;

    if (!filePath) {
      return errorResponse("ID del archivo no proporcionado", 400);
    }

    // Verificar que el archivo existe
    const { data: fileData, error: checkError } = await supabase.storage
      .from(BUCKET_NAME)
      .list("products", {
        search: filePath.split("/").pop(),
      });

    if (checkError) {
      console.error("[DELETE /api/upload/[id]] Error al verificar archivo:", checkError);
      return errorResponse("Error al verificar el archivo", 500, checkError.message);
    }

    // Eliminar el archivo
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (deleteError) {
      console.error("[DELETE /api/upload/[id]] Error al eliminar archivo:", deleteError);
      return errorResponse("Error al eliminar el archivo", 500, deleteError.message);
    }

    console.log("[DELETE /api/upload/[id]] Archivo eliminado exitosamente:", filePath);
    return jsonResponse(
      {
        success: true,
        message: "Archivo eliminado correctamente",
        filePath: filePath,
      },
      200
    );
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/upload/[id]");
  }
}

