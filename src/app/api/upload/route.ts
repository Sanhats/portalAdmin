import { supabase } from "@/lib/supabase";
import { imageFileTypeSchema } from "@/validations/upload";

const BUCKET_NAME = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// POST /api/upload - Subir imagen a Supabase Storage
export async function POST(req: Request) {
  try {
    // Verificar que las variables de entorno estén configuradas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        { error: "Variables de entorno no configuradas" },
        { status: 500 }
      );
    }

    // Obtener el FormData
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json(
        { error: "No se proporcionó ningún archivo" },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    const fileType = file.type;
    const typeValidation = imageFileTypeSchema.safeParse(fileType);
    
    if (!typeValidation.success) {
      return Response.json(
        { 
          error: "Tipo de archivo no permitido",
          details: "Solo se permiten imágenes: JPEG, PNG, WebP, GIF"
        },
        { status: 400 }
      );
    }

    // Validar tamaño del archivo
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { 
          error: "Archivo demasiado grande",
          details: `El archivo no puede ser mayor a ${MAX_FILE_SIZE / 1024 / 1024}MB`
        },
        { status: 400 }
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
      console.error("Error al subir archivo:", uploadError);
      return Response.json(
        { error: "Error al subir el archivo", details: uploadError.message },
        { status: 500 }
      );
    }

    // Obtener URL pública del archivo
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      // Si falla, intentar eliminar el archivo subido
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      return Response.json(
        { error: "Error al obtener la URL pública del archivo" },
        { status: 500 }
      );
    }

    // Retornar información del archivo subido
    return Response.json(
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
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en POST /api/upload:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
        type: "unexpected_error",
      },
      { status: 500 }
    );
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
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
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

    return Response.json({
      files: filesWithUrls,
      count: filesWithUrls.length,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

