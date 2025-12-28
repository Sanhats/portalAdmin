import { supabase } from "@/lib/supabase";
import { updatePaymentIntentSchema } from "@/validations/payment-intent";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// GET /api/payment-intents/:id - Obtener intención de pago por ID
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }
    
    // Obtener intención de pago
    const { data: paymentIntent, error } = await supabase
      .from("payment_intents")
      .select("*")
      .eq("id", params.id)
      .single();
    
    if (error) {
      if (error.code === "PGRST116") {
        return errorResponse("Intención de pago no encontrada", 404);
      }
      console.error("[GET /api/payment-intents/:id] Error de Supabase:", error);
      return errorResponse("Error al obtener la intención de pago", 500, error.message, error.code);
    }
    
    if (!paymentIntent) {
      return errorResponse("Intención de pago no encontrada", 404);
    }
    
    return jsonResponse(paymentIntent);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/payment-intents/:id");
  }
}

// PUT /api/payment-intents/:id - Actualizar intención de pago
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }
    
    const body = await req.json();
    console.log("[PUT /api/payment-intents/:id] Body recibido:", JSON.stringify(body, null, 2));
    
    // Validar datos
    const parsed = updatePaymentIntentSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[PUT /api/payment-intents/:id] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    // Verificar que la intención existe
    const { data: existing, error: checkError } = await supabase
      .from("payment_intents")
      .select("id, status")
      .eq("id", params.id)
      .single();
    
    if (checkError || !existing) {
      if (checkError?.code === "PGRST116") {
        return errorResponse("Intención de pago no encontrada", 404);
      }
      return errorResponse("Intención de pago no encontrada", 404);
    }
    
    // Preparar datos para actualizar
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.externalReference !== undefined) updateData.external_reference = parsed.data.externalReference;
    if (parsed.data.gatewayMetadata !== undefined) {
      updateData.gateway_metadata = parsed.data.gatewayMetadata;
    }
    if (parsed.data.paymentId !== undefined) {
      updateData.payment_id = parsed.data.paymentId || null;
    }
    
    // Actualizar intención de pago
    const { data: updated, error: updateError } = await supabase
      .from("payment_intents")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();
    
    if (updateError || !updated) {
      console.error("[PUT /api/payment-intents/:id] Error al actualizar intención de pago:", updateError);
      return errorResponse("Error al actualizar la intención de pago", 500, updateError?.message, updateError?.code);
    }
    
    return jsonResponse(updated);
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/payment-intents/:id");
  }
}

