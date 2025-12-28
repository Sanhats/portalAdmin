import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { recalculateSaleBalance, logPaymentEvent } from "@/lib/payment-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// SPRINT F: Schema para confirmar pago manualmente
const confirmPaymentSchema = z.object({
  proofType: z.enum(["qr_code", "receipt", "transfer_screenshot", "pos_ticket", "other"]).optional(),
  proofReference: z.string().max(255).optional().nullable(),
  proofFileUrl: z.string().url().optional().nullable(),
  terminalId: z.string().max(100).optional().nullable(),
  cashRegisterId: z.string().max(100).optional().nullable(),
});

// POST /api/payments/:id/confirm - Confirmar pago manualmente (para gateways QR/POS)
export async function POST(
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
      return errorResponse("ID de pago inválido", 400, uuidValidation.error.errors);
    }

    const body = await req.json();
    console.log("[POST /api/payments/:id/confirm] Body recibido:", JSON.stringify(body, null, 2));

    // Validar datos
    const parsed = confirmPaymentSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[POST /api/payments/:id/confirm] Error de validación:", parsed.error.errors);
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

    // SPRINT F: Validar que el pago puede ser confirmado manualmente
    // Solo pagos en estado pending o processing pueden ser confirmados manualmente
    if (payment.status !== "pending" && payment.status !== "processing") {
      return errorResponse(
        `No se puede confirmar un pago en estado '${payment.status}'. Solo se pueden confirmar pagos en estado 'pending' o 'processing'`,
        400
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

    // SPRINT F: Actualizar estado del pago a confirmed
    const previousStatus = payment.status;
    const updateData: any = {
      status: "confirmed",
    };

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

    console.log("[POST /api/payments/:id/confirm] Actualizando pago con datos:", JSON.stringify(updateData, null, 2));

    const { data: updatedPayment, error: updateError } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError || !updatedPayment) {
      console.error("[POST /api/payments/:id/confirm] Error al actualizar pago:", updateError);
      console.error("[POST /api/payments/:id/confirm] Update data:", JSON.stringify(updateData, null, 2));
      return errorResponse("Error al confirmar el pago", 500, updateError?.message, updateError?.code);
    }

    console.log(`[POST /api/payments/:id/confirm] Pago ${params.id} confirmado: ${previousStatus} → confirmed`);

    // SPRINT F: Registrar evento de auditoría
    const previousState = {
      status: previousStatus,
      amount: payment.amount,
      method: payment.method,
    };

    const newState = {
      status: "confirmed",
      amount: payment.amount,
      method: payment.method,
      proof_type: parsed.data.proofType || null,
      proof_reference: parsed.data.proofReference || null,
      confirmed_by: user.id,
    };

    await logPaymentEvent(
      params.id,
      "status_changed",
      previousState,
      newState,
      user.id
    );

    // SPRINT F: Recalcular balance de la venta
    try {
      const balanceResult = await recalculateSaleBalance(payment.sale_id);
      console.log(`[POST /api/payments/:id/confirm] Balance recalculado para venta ${payment.sale_id}:`, {
        paidAmount: balanceResult.paidAmount,
        balanceAmount: balanceResult.balanceAmount,
        isPaid: balanceResult.isPaid,
      });
    } catch (balanceError) {
      console.error("[POST /api/payments/:id/confirm] Error al recalcular balance:", balanceError);
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
      console.error("[POST /api/payments/:id/confirm] Error al obtener pago completo:", fetchError);
      return jsonResponse(updatedPayment, 200);
    }

    return jsonResponse(paymentComplete, 200);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/payments/:id/confirm");
  }
}

