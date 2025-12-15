import { supabase } from "@/lib/supabase";
import { imageFileTypeSchema } from "@/validations/upload";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";

const BUCKET_NAME = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// POST /api/upload - Subir imagen a Supabase Storage
export async function POST(req: Request) {
  try {
    // Verificar que las variables de entorno estén configuradas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return errorResponse("Variables de entorno no configuradas", 500);
    }

    // Obtener el FormData
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return errorResponse("No se proporcionó ningún archivo", 400);
    }

    // Validar tipo de archivo
    const fileType = file.type;
    const typeValidation = imageFileTypeSchema.safeParse(fileType);
    
    if (!typeValidation.success) {
      return errorResponse(
        "Tipo de archivo no permitido",
        400,
        "Solo se permiten imágenes: JPEG, PNG, WebP, GIF"
      );
    }

    // Validar tamaño del archivo
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        "Archivo demasiado grande",
        400,
        `El archivo no puede ser mayor a ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    // Generar nombre único para el archivo
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `products/${fileName}`;

    // Convertir File a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir archivo a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false, // No sobrescribir si existe
      });

    if (uploadError) {
      console.error("[POST /api/upload] Error al subir archivo:", uploadError);
      return errorResponse("Error al subir el archivo", 500, uploadError.message);
    }

    // Obtener URL pública del archivo
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      // Si falla, intentar eliminar el archivo subido
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      return errorResponse("Error al obtener la URL pública del archivo", 500);
    }

    console.log("[POST /api/upload] Archivo subido exitosamente:", filePath);
    // Retornar información del archivo subido
    return jsonResponse(
      {
        success: true,
        file: {
          id: uploadData.path,
          fileName: fileName,
          filePath: filePath,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type,
        },
      },
      201
    );
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/upload");
  }
}

// GET /api/upload - Listar archivos (opcional, para debugging)
export async function GET() {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list("products", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.error("[GET /api/upload] Error al listar archivos:", error);
      return errorResponse("Error al listar archivos", 500, error.message);
    }

    // Obtener URLs públicas para cada archivo
    const filesWithUrls = (data || []).map((file) => {
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(`products/${file.name}`);

      return {
        ...file,
        url: urlData?.publicUrl,
      };
    });

    return jsonResponse({
      files: filesWithUrls,
      count: filesWithUrls.length,
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/upload");
  }
}

