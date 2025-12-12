import { supabase } from "@/lib/supabase";

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
      return Response.json(
        { error: "ID del archivo no proporcionado" },
        { status: 400 }
      );
    }

    // Verificar que el archivo existe
    const { data: fileData, error: checkError } = await supabase.storage
      .from(BUCKET_NAME)
      .list("products", {
        search: filePath.split("/").pop(),
      });

    if (checkError) {
      return Response.json(
        { error: "Error al verificar el archivo", details: checkError.message },
        { status: 500 }
      );
    }

    // Eliminar el archivo
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (deleteError) {
      console.error("Error al eliminar archivo:", deleteError);
      return Response.json(
        { error: "Error al eliminar el archivo", details: deleteError.message },
        { status: 500 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "Archivo eliminado correctamente",
        filePath: filePath,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error en DELETE /api/upload/[id]:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
        type: "unexpected_error",
      },
      { status: 500 }
    );
  }
}

