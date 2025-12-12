import { supabase } from "./supabase";

const BUCKET_NAME = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface UploadResult {
  success: boolean;
  file?: {
    id: string;
    fileName: string;
    filePath: string;
    url: string;
    size: number;
    type: string;
  };
  error?: string;
}

/**
 * Sube un archivo a Supabase Storage
 * @param file - Archivo a subir
 * @param folder - Carpeta donde guardar (default: "products")
 * @returns Resultado de la subida con URL pública
 */
export async function uploadFile(
  file: File,
  folder: string = "products"
): Promise<UploadResult> {
  try {
    // Validar tipo de archivo
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: "Tipo de archivo no permitido. Solo se permiten imágenes: JPEG, PNG, WebP, GIF",
      };
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `El archivo no puede ser mayor a ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    // Generar nombre único
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Convertir File a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: uploadError.message,
      };
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      // Limpiar archivo subido si falla
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      return {
        success: false,
        error: "Error al obtener la URL pública del archivo",
      };
    }

    return {
      success: true,
      file: {
        id: uploadData.path,
        fileName: fileName,
        filePath: filePath,
        url: urlData.publicUrl,
        size: file.size,
        type: file.type,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido al subir archivo",
    };
  }
}

/**
 * Elimina un archivo de Supabase Storage
 * @param filePath - Ruta del archivo a eliminar
 * @returns true si se eliminó correctamente, false en caso contrario
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    return !error;
  } catch (error) {
    console.error("Error al eliminar archivo:", error);
    return false;
  }
}

