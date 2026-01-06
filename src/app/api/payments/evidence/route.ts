import { supabase } from "@/lib/supabase";
import { evidenceFileTypeSchema, evidenceFileSizeSchema } from "@/validations/upload";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { uploadPaymentEvidence } from "@/lib/upload";

const BUCKET_NAME = "product-images"; // Usar el mismo bucket (o crear uno nuevo)
const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// SPRINT 4: POST /api/payments/evidence - Subir evidencia de pago (imagen o PDF)
export async function POST(req: Request) {
  try {
    // Verificar autenticación
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      return errorResponse("No autorizado. Token Bearer requerido", 401);
    }
    
    const user = await validateBearerToken(token);
    if (!user) {
      return errorResponse("No autorizado. Token inválido o expirado", 401);
    }

    // Verificar que las variables de entorno estén configuradas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return errorResponse("Variables de entorno no configuradas", 500);
    }

    // Obtener el FormData
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const paymentId = formData.get("paymentId") as string | null;

    if (!file) {
      return errorResponse("No se proporcionó ningún archivo", 400);
    }

    // Validar tipo de archivo (imágenes y PDFs)
    const fileType = file.type;
    const typeValidation = evidenceFileTypeSchema.safeParse(fileType);
    
    if (!typeValidation.success) {
      return errorResponse(
        "Tipo de archivo no permitido",
        400,
        "Solo se permiten imágenes (JPEG, PNG, WebP, GIF) o PDFs"
      );
    }

    // Validar tamaño del archivo
    if (file.size > MAX_EVIDENCE_FILE_SIZE) {
      return errorResponse(
        "Archivo demasiado grande",
        400,
        `El archivo no puede ser mayor a ${MAX_EVIDENCE_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    // Validar paymentId si se proporciona
    if (paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .select("id")
        .eq("id", paymentId)
        .single();

      if (paymentError || !payment) {
        return errorResponse("Pago no encontrado", 404);
      }
    }

    // Subir archivo usando la función helper
    const uploadResult = await uploadPaymentEvidence(file, paymentId || undefined);

    if (!uploadResult.success) {
      return errorResponse(
        uploadResult.error || "Error al subir el archivo",
        500
      );
    }

    console.log("[POST /api/payments/evidence] Evidencia subida exitosamente:", uploadResult.file?.filePath);

    // Retornar información del archivo subido
    return jsonResponse(
      {
        success: true,
        file: uploadResult.file,
        // SPRINT 4: Incluir URL para usar como comprobante_url en metadata
        comprobante_url: uploadResult.file?.url,
      },
      201
    );
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/payments/evidence");
  }
}

