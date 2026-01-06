import { supabase } from "@/lib/supabase";
import { confirmPaymentSchema } from "@/validations/payment";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken, canConfirmPayments } from "@/lib/auth";
import { 
  recalculateSaleBalance, 
  logPaymentEvent, 
  confirmPayment,
  canConfirmPayment,
  validatePaymentAmount,
  checkDuplicateConfirmation
} from "@/lib/payment-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// SPRINT 1: PATCH /api/payments/:id/confirm - Confirmar pago manualmente
export async function PATCH(
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

    // SPRINT 2: Validar rol del usuario
    if (!canConfirmPayments(user)) {
      return errorResponse(
        "No autorizado. No tienes permisos para confirmar pagos. Se requiere rol de admin, manager o cashier",
        403
      );
    }

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID de pago inválido", 400, uuidValidation.error.errors);
    }

    const body = await req.json();
    console.log("[PATCH /api/payments/:id/confirm] Body recibido:", JSON.stringify(body, null, 2));

    // Validar datos
    const parsed = confirmPaymentSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[PATCH /api/payments/:id/confirm] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Obtener el pago
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(`
        *,
        sales:sale_id (
          id,
          tenant_id,
          status,
          total_amount,
          balance_amount,
          paid_amount
        )
      `)
      .eq("id", params.id)
      .single();

    if (paymentError || !payment) {
      if (paymentError?.code === "PGRST116") {
        return errorResponse("Pago no encontrado", 404);
      }
      console.error("[POST /api/payments/:id/confirm] Error al obtener pago:", paymentError);
      return errorResponse("Error al obtener el pago", 500, paymentError?.message, paymentError?.code);
    }

    const sale = payment.sales as any;
    const tenantId = sale?.tenant_id || payment.tenant_id;

    // SPRINT 2: Validación robusta del estado del pago
    const stateValidation = canConfirmPayment(payment);
    if (!stateValidation.valid) {
      return errorResponse(stateValidation.reason || "El pago no puede ser confirmado", 400);
    }

    // SPRINT 2: Validación del monto del pago
    const amountValidation = validatePaymentAmount(payment);
    if (!amountValidation.valid) {
      return errorResponse(amountValidation.reason || "El monto del pago es inválido", 400);
    }

    // SPRINT 2: Verificar idempotencia - evitar doble confirmación
    const duplicateCheck = await checkDuplicateConfirmation(params.id, user.id);
    if (duplicateCheck.isDuplicate) {
      console.log(`[PATCH /api/payments/:id/confirm] Confirmación duplicada detectada para pago ${params.id} por usuario ${user.id}`);
      
      // Retornar el pago actual (ya confirmado) en lugar de error
      const { data: existingPayment, error: fetchError } = await supabase
        .from("payments")
        .select(`
          *,
          payment_methods:payment_method_id (
            id,
            code,
            label,
            type,
            is_active
          )
        `)
        .eq("id", params.id)
        .single();
      
      if (!fetchError && existingPayment) {
        return jsonResponse(existingPayment, 200); // 200 porque ya está confirmado
      }
      
      // Si no se puede obtener, retornar error
      return errorResponse(
        "Este pago ya fue confirmado recientemente. Por favor, verifica el estado del pago",
        409
      );
    }

    // SPRINT F: Validar que el método de pago permite confirmación manual
    // Solo métodos gateway/external pueden requerir confirmación manual
    let paymentCategory = "gateway"; // Default
    
    if (payment.payment_method_id) {
      const { data: paymentMethod, error: pmError } = await supabase
        .from("payment_methods")
        .select("payment_category")
        .eq("id", payment.payment_method_id)
        .maybeSingle();
      
      if (paymentMethod && !pmError) {
        paymentCategory = paymentMethod.payment_category || "gateway";
      }
    } else {
      // Inferir del method si no hay payment_method_id
      if (payment.method === "mercadopago") {
        paymentCategory = "external";
      } else if (["cash", "transfer"].includes(payment.method || "")) {
        paymentCategory = "manual";
      }
    }

    // Los pagos manuales ya deberían estar en confirmed, pero permitimos confirmarlos si están en pending
    // Los pagos gateway/external pueden requerir confirmación manual

    // SPRINT 1: Actualizar estado del pago a confirmed con auditoría
    const previousStatus = payment.status;
    const updateData: any = {
      status: "confirmed",
      confirmed_by: user.id, // SPRINT 1: Usuario que confirma
      confirmed_at: new Date().toISOString(), // SPRINT 1: Fecha de confirmación
    };

    // SPRINT 1: Actualizar metadata si se proporciona
    if (parsed.data.metadata) {
      // Combinar metadata existente con el nuevo
      const existingMetadata = (payment as any).metadata || {};
      updateData.metadata = { ...existingMetadata, ...parsed.data.metadata };
    }

    // SPRINT F: Agregar evidencia de pago si se proporciona
    if (parsed.data.proofType) {
      updateData.proof_type = parsed.data.proofType;
    }
    if (parsed.data.proofReference !== undefined) {
      updateData.proof_reference = parsed.data.proofReference;
    }
    if (parsed.data.proofFileUrl) {
      updateData.proof_file_url = parsed.data.proofFileUrl;
    }
    if (parsed.data.terminalId) {
      updateData.terminal_id = parsed.data.terminalId;
    }
    if (parsed.data.cashRegisterId) {
      updateData.cash_register_id = parsed.data.cashRegisterId;
    }

    console.log("[PATCH /api/payments/:id/confirm] Actualizando pago con datos:", JSON.stringify(updateData, null, 2));

    // SPRINT 2: Actualizar con condición WHERE para proteger contra condiciones de carrera
    // Solo actualizar si el estado actual es 'pending' (protección a nivel de BD)
    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", params.id)
      .eq("status", "pending") // SPRINT 2: Protección adicional - solo actualizar si está en pending
      .select()
      .single();

    if (updateError || !updatedPayment) {
      // Si no se actualizó, puede ser porque el estado cambió (condición de carrera)
      if (updateError?.code === "PGRST116" || !updatedPayment) {
        // Verificar el estado actual del pago
        const { data: currentPayment } = await supabase
          .from("payments")
          .select("status, confirmed_at, confirmed_by")
          .eq("id", params.id)
          .single();
        
        if (currentPayment?.status === "confirmed") {
          // El pago ya fue confirmado (probablemente por otra request simultánea)
          console.log(`[PATCH /api/payments/:id/confirm] Pago ${params.id} ya fue confirmado por otra request`);
          
          // Retornar el pago actual
          const { data: existingPayment } = await supabase
            .from("payments")
            .select(`
              *,
              payment_methods:payment_method_id (
                id,
                code,
                label,
                type,
                is_active
              )
            `)
            .eq("id", params.id)
            .single();
          
          if (existingPayment) {
            return jsonResponse(existingPayment, 200);
          }
        }
        
        return errorResponse(
          "No se pudo confirmar el pago. El estado del pago puede haber cambiado. Por favor, verifica el estado actual",
          409
        );
      }
      
      console.error("[PATCH /api/payments/:id/confirm] Error al actualizar pago:", updateError);
      console.error("[PATCH /api/payments/:id/confirm] Update data:", JSON.stringify(updateData, null, 2));
      return errorResponse("Error al confirmar el pago", 500, updateError?.message, updateError?.code);
    }

    console.log(`[PATCH /api/payments/:id/confirm] Pago ${params.id} confirmado: ${previousStatus} → confirmed`);

    // SPRINT 1: Registrar evento de auditoría
    const previousState = {
      status: previousStatus,
      amount: payment.amount,
      method: payment.method,
      provider: (payment as any).provider || null,
    };

    const newState = {
      status: "confirmed",
      amount: payment.amount,
      method: payment.method,
      provider: (payment as any).provider || null,
      confirmed_by: user.id,
      confirmed_at: updateData.confirmed_at,
      metadata: updateData.metadata || null,
    };

    await logPaymentEvent(
      params.id,
      "confirmed",
      previousState,
      newState,
      user.id
    );

    // SPRINT 1: Recalcular balance de la venta
    try {
      const balanceResult = await recalculateSaleBalance(payment.sale_id);
      console.log(`[PATCH /api/payments/:id/confirm] Balance recalculado para venta ${payment.sale_id}:`, {
        paidAmount: balanceResult.paidAmount,
        balanceAmount: balanceResult.balanceAmount,
        isPaid: balanceResult.isPaid,
      });
    } catch (balanceError) {
      console.error("[PATCH /api/payments/:id/confirm] Error al recalcular balance:", balanceError);
      // No fallar, solo loguear
    }

    // Obtener el pago completo con relación payment_methods
    const { data: paymentComplete, error: fetchError } = await supabase
      .from("payments")
      .select(`
        *,
        payment_methods:payment_method_id (
          id,
          code,
          label,
          type,
          is_active
        )
      `)
      .eq("id", params.id)
      .single();

    if (fetchError || !paymentComplete) {
      console.error("[PATCH /api/payments/:id/confirm] Error al obtener pago completo:", fetchError);
      return jsonResponse(updatedPayment, 200);
    }

    return jsonResponse(paymentComplete, 200);
  } catch (error) {
    return handleUnexpectedError(error, "PATCH /api/payments/:id/confirm");
  }
}

