import { supabase } from "@/lib/supabase";
import { createPaymentSchema } from "@/validations/payment";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { recalculateSaleBalance, logPaymentEvent } from "@/lib/payment-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// POST /api/sales/:id/payments - Crear pago para una venta
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

    // Validar UUID de la venta
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID de venta inválido", 400, uuidValidation.error.errors);
    }
    
    const body = await req.json();
    console.log("[POST /api/sales/:id/payments] Body recibido:", JSON.stringify(body, null, 2));
    
    // Validar datos
    const parsed = createPaymentSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[POST /api/sales/:id/payments] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    // Verificar que la venta existe
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, tenant_id, total_amount, status")
      .eq("id", params.id)
      .single();
    
    if (saleError || !sale) {
      if (saleError?.code === "PGRST116") {
        return errorResponse("Venta no encontrada", 404);
      }
      console.error("[POST /api/sales/:id/payments] Error al obtener venta:", saleError);
      return errorResponse("Error al obtener la venta", 500, saleError?.message, saleError?.code);
    }
    
    // CONTRATO: draft no admite pagos
    if (sale.status === "draft") {
      return errorResponse("No se pueden registrar pagos en ventas en estado draft. Confirma la venta primero", 400);
    }
    
    // CONTRATO: paid no admite más pagos (ya está pagada)
    if (sale.status === "paid") {
      return errorResponse("La venta ya está completamente pagada. No se pueden agregar más pagos", 400);
    }
    
    // Obtener tenant_id del header o de la venta
    const tenantId = req.headers.get("x-tenant-id") || sale.tenant_id;
    
    // Validar payment_method_id si se proporciona
    let paymentMethodId = parsed.data.paymentMethodId || null;
    let method = parsed.data.method || null;
    
    if (paymentMethodId) {
      // Verificar que el método de pago existe y pertenece al tenant
      const { data: paymentMethod, error: methodError } = await supabase
        .from("payment_methods")
        .select("id, tenant_id, code, type")
        .eq("id", paymentMethodId)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .single();
      
      if (methodError || !paymentMethod) {
        return errorResponse("Método de pago no encontrado o inactivo", 400);
      }
      
      // Usar el type del método de pago como method para backward compatibility
      method = paymentMethod.type;
    } else if (!method) {
      // Si no se proporciona ninguno, error
      return errorResponse("Debe proporcionar paymentMethodId o method", 400);
    }
    
    // Preparar datos del pago
    const amount = typeof parsed.data.amount === "number" 
      ? parsed.data.amount 
      : parseFloat(parsed.data.amount);
    
    const paymentStatus = parsed.data.status || "pending";
    
    // Estado anterior (null porque es creación)
    const previousState = null;
    const newState = {
      amount: amount.toString(),
      method,
      payment_method_id: paymentMethodId,
      status: paymentStatus,
      reference: parsed.data.reference || null,
      external_reference: parsed.data.externalReference || null,
      gateway_metadata: parsed.data.gatewayMetadata || null,
    };
    
    // Crear el pago
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        sale_id: params.id,
        tenant_id: tenantId,
        amount: amount.toString(),
        method: method, // Backward compatibility
        payment_method_id: paymentMethodId,
        status: paymentStatus,
        reference: parsed.data.reference || null,
        external_reference: parsed.data.externalReference || null,
        gateway_metadata: parsed.data.gatewayMetadata || null,
        created_by: user.id,
      })
      .select()
      .single();
    
    if (paymentError || !payment) {
      console.error("[POST /api/sales/:id/payments] Error al crear pago:", paymentError);
      return errorResponse("Error al crear el pago", 500, paymentError?.message, paymentError?.code);
    }
    
    // Registrar evento de auditoría
    await logPaymentEvent(payment.id, "created", previousState, newState, user.id);
    
    // Recalcular saldo de la venta
    try {
      const balanceResult = await recalculateSaleBalance(params.id);
      console.log(`[POST /api/sales/:id/payments] Saldo recalculado: paid=${balanceResult.paidAmount}, balance=${balanceResult.balanceAmount}, isPaid=${balanceResult.isPaid}`);
    } catch (balanceError) {
      console.error("[POST /api/sales/:id/payments] Error al recalcular saldo:", balanceError);
      // No fallar, solo loguear (el pago ya se creó)
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
      .eq("id", payment.id)
      .single();
    
    if (fetchError || !paymentComplete) {
      console.error("[POST /api/sales/:id/payments] Error al obtener pago completo:", fetchError);
      return jsonResponse(payment, 201);
    }
    
    return jsonResponse(paymentComplete, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/sales/:id/payments");
  }
}

// GET /api/sales/:id/payments - Listar pagos de una venta
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

    // Validar UUID de la venta
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID de venta inválido", 400, uuidValidation.error.errors);
    }
    
    // Verificar que la venta existe
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id")
      .eq("id", params.id)
      .single();
    
    if (saleError || !sale) {
      if (saleError?.code === "PGRST116") {
        return errorResponse("Venta no encontrada", 404);
      }
      console.error("[GET /api/sales/:id/payments] Error al obtener venta:", saleError);
      return errorResponse("Error al obtener la venta", 500, saleError?.message, saleError?.code);
    }
    
    // Obtener todos los pagos de la venta con método de pago
    const { data: payments, error: paymentsError } = await supabase
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
      .eq("sale_id", params.id)
      .order("created_at", { ascending: false });
    
    if (paymentsError) {
      console.error("[GET /api/sales/:id/payments] Error al obtener pagos:", paymentsError);
      return errorResponse("Error al obtener los pagos", 500, paymentsError.message, paymentsError.code);
    }
    
    // CONTRATO: Solo confirmed cuenta para paid_amount
    let totalPaid = 0;
    if (payments) {
      totalPaid = payments
        .filter(p => p.status === "confirmed")
        .reduce((sum, p) => {
          return sum + parseFloat(p.amount || "0");
        }, 0);
    }
    
    // Obtener resumen financiero de la venta
    const { data: saleFinancial, error: saleFinancialError } = await supabase
      .from("sales")
      .select("paid_amount, balance_amount, payment_completed_at")
      .eq("id", params.id)
      .single();
    
    // Obtener total_amount de la venta para el resumen financiero completo
    const { data: saleTotal, error: saleTotalError } = await supabase
      .from("sales")
      .select("total_amount")
      .eq("id", params.id)
      .single();
    
    const totalAmount = saleTotal ? parseFloat(saleTotal.total_amount || "0") : 0;
    const paidAmount = saleFinancial ? parseFloat(saleFinancial.paid_amount || "0") : totalPaid;
    const balanceAmount = saleFinancial ? parseFloat(saleFinancial.balance_amount || "0") : (totalAmount - totalPaid);
    
    return jsonResponse({
      payments: payments || [],
      totalPaid: totalPaid,
      financial: {
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        balanceAmount: balanceAmount,
        isPaid: balanceAmount <= 0,
        paymentCompletedAt: saleFinancial?.payment_completed_at || null,
      },
      summary: {
        total: payments?.length || 0,
        byStatus: {
          pending: payments?.filter(p => p.status === "pending").length || 0,
          confirmed: payments?.filter(p => p.status === "confirmed").length || 0,
          failed: payments?.filter(p => p.status === "failed").length || 0,
          refunded: payments?.filter(p => p.status === "refunded").length || 0,
        }
      }
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/sales/:id/payments");
  }
}

