import { supabase } from "@/lib/supabase";
import { updatePaymentMethodSchema } from "@/validations/payment-method";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// PUT /api/payment-methods/:id - Actualizar método de pago
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
    console.log("[PUT /api/payment-methods/:id] Body recibido:", JSON.stringify(body, null, 2));
    
    // Validar datos
    const parsed = updatePaymentMethodSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[PUT /api/payment-methods/:id] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    // Verificar que el método de pago existe
    const { data: existing, error: checkError } = await supabase
      .from("payment_methods")
      .select("id, tenant_id, code")
      .eq("id", params.id)
      .single();
    
    if (checkError || !existing) {
      if (checkError?.code === "PGRST116") {
        return errorResponse("Método de pago no encontrado", 404);
      }
      console.error("[PUT /api/payment-methods/:id] Error al obtener método de pago:", checkError);
      return errorResponse("Error al obtener el método de pago", 500, checkError?.message, checkError?.code);
    }
    
    // Si se actualiza el código, verificar que no exista otro con el mismo código
    if (parsed.data.code && parsed.data.code !== existing.code) {
      const { data: codeExists, error: codeCheckError } = await supabase
        .from("payment_methods")
        .select("id")
        .eq("tenant_id", existing.tenant_id)
        .eq("code", parsed.data.code)
        .single();
      
      if (codeExists) {
        return errorResponse(`Ya existe un método de pago con el código '${parsed.data.code}' para este tenant`, 400);
      }
    }
    
    // Preparar datos para actualizar
    const updateData: any = {};
    
    if (parsed.data.code !== undefined) updateData.code = parsed.data.code;
    if (parsed.data.label !== undefined) updateData.label = parsed.data.label;
    if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
    // SPRINT B: Actualizar payment_category si se proporciona
    if (parsed.data.paymentCategory !== undefined) {
      updateData.payment_category = parsed.data.paymentCategory;
    }
    if (parsed.data.isActive !== undefined) updateData.is_active = parsed.data.isActive;
    if (parsed.data.metadata !== undefined) {
      updateData.metadata = parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null;
    }
    
    // Actualizar método de pago
    const { data: updated, error: updateError } = await supabase
      .from("payment_methods")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();
    
    if (updateError || !updated) {
      console.error("[PUT /api/payment-methods/:id] Error al actualizar método de pago:", updateError);
      return errorResponse("Error al actualizar el método de pago", 500, updateError?.message, updateError?.code);
    }
    
    // Parsear metadata si existe
    if (updated.metadata && typeof updated.metadata === 'string') {
      try {
        updated.metadata = JSON.parse(updated.metadata);
      } catch {
        // Si no se puede parsear, dejarlo como está
      }
    }
    
    return jsonResponse(updated);
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/payment-methods/:id");
  }
}

