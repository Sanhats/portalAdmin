import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { recalculateSaleBalance, logPaymentEvent } from "@/lib/payment-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// DELETE /api/payments/:id - Eliminar pago (solo si está en pending)
export async function DELETE(
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
    
    // Verificar que el pago existe y obtener su información completa
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", params.id)
      .single();
    
    if (paymentError || !payment) {
      if (paymentError?.code === "PGRST116") {
        return errorResponse("Pago no encontrado", 404);
      }
      console.error("[DELETE /api/payments/:id] Error al obtener pago:", paymentError);
      return errorResponse("Error al obtener el pago", 500, paymentError?.message, paymentError?.code);
    }
    
    // CONTRATO: Solo pending se puede eliminar
    if (payment.status !== "pending") {
      return errorResponse(
        `No se puede eliminar un pago en estado '${payment.status}'. Solo se pueden eliminar pagos en estado 'pending'`,
        400
      );
    }
    
    // CONTRATO: confirmed no se puede eliminar (impacta en contabilidad)
    if (payment.status === "confirmed") {
      return errorResponse(
        "No se puede eliminar un pago confirmado. Los pagos confirmados impactan en la contabilidad y no pueden eliminarse",
        400
      );
    }
    
    // Guardar estado anterior para auditoría
    const previousState = {
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      payment_method_id: payment.payment_method_id,
      status: payment.status,
      reference: payment.reference,
    };
    
    // Eliminar el pago
    const { error: deleteError } = await supabase
      .from("payments")
      .delete()
      .eq("id", params.id);
    
    if (deleteError) {
      console.error("[DELETE /api/payments/:id] Error al eliminar pago:", deleteError);
      return errorResponse("Error al eliminar el pago", 500, deleteError.message, deleteError.code);
    }
    
    // Registrar evento de auditoría
    await logPaymentEvent(params.id, "deleted", previousState, null, user.id);
    
    // Recalcular saldo de la venta
    try {
      const balanceResult = await recalculateSaleBalance(payment.sale_id);
      console.log(`[DELETE /api/payments/:id] Saldo recalculado: paid=${balanceResult.paidAmount}, balance=${balanceResult.balanceAmount}, isPaid=${balanceResult.isPaid}`);
    } catch (balanceError) {
      console.error("[DELETE /api/payments/:id] Error al recalcular saldo:", balanceError);
      // No fallar, solo loguear (el pago ya se eliminó)
    }
    
    return jsonResponse({
      message: "Pago eliminado correctamente",
      deletedPayment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status
      }
    });
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/payments/:id");
  }
}

