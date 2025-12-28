import { supabase } from "@/lib/supabase";
import { createPaymentSchema } from "@/validations/payment";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { recalculateSaleBalance, logPaymentEvent } from "@/lib/payment-helpers";
import { generateIdempotencyKey, getInitialPaymentStatus } from "@/lib/payment-helpers-sprint-b";
import { generateQRPayment, isQRPaymentMethod } from "@/lib/qr-helpers";
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
    
    // SPRINT B: Guardar si status fue proporcionado explícitamente (antes de validar)
    const statusProvidedExplicitly = body.status !== undefined;
    
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
    let paymentMethod: any = null;
    
    // SPRINT B: Obtener información del método de pago y determinar estado inicial
    let paymentCategory: "manual" | "gateway" | "external" = "manual";
    let isQR = false;
    
    if (paymentMethodId) {
      // Verificar que el método de pago existe y pertenece al tenant
      // SPRINT B: Asegurar que payment_category se seleccione explícitamente
      const { data: pmData, error: methodError } = await supabase
        .from("payment_methods")
        .select("id, tenant_id, code, type, payment_category, metadata")
        .eq("id", paymentMethodId)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .single();
      
      // Debug: verificar que payment_category existe
      if (pmData && !(pmData as any).payment_category) {
        console.error(`[POST /api/sales/:id/payments] payment_method ${paymentMethodId} no tiene payment_category en la respuesta:`, Object.keys(pmData));
      }
      
      if (methodError || !pmData) {
        return errorResponse("Método de pago no encontrado o inactivo", 400);
      }
      
      paymentMethod = pmData;
      
      // Usar el type del método de pago como method para backward compatibility
      method = paymentMethod.type;
      
      // Detectar si es QR
      isQR = isQRPaymentMethod(paymentMethod);
      
      // SPRINT B/C: Determinar payment_category basado en el type del método
      // Esto es más confiable que depender del campo payment_category de la DB
      const methodType = paymentMethod.type?.toLowerCase() || "";
      const categoryFromDB = (paymentMethod as any).payment_category;
      
      // Si tiene payment_category en la DB y es válido, usarlo
      if (categoryFromDB === "manual" || categoryFromDB === "gateway" || categoryFromDB === "external") {
        paymentCategory = categoryFromDB;
      } else {
        // Inferir del type si no tiene payment_category
        if (["cash", "transfer", "other"].includes(methodType)) {
          paymentCategory = "manual";
        } else if (["qr", "card", "gateway"].includes(methodType)) {
          paymentCategory = "gateway";
        } else {
          // Default a manual si no se puede determinar
          paymentCategory = "manual";
        }
      }
      
      console.log(`[POST /api/sales/:id/payments] paymentMethod type=${paymentMethod.type}, methodType=${methodType}, paymentCategory=${paymentCategory}, isQR=${isQR}, statusProvidedExplicitly=${statusProvidedExplicitly}`);
    } else if (!method) {
      // Si no se proporciona ninguno, error
      return errorResponse("Debe proporcionar paymentMethodId o method", 400);
    } else {
      // SPRINT B/C: Si solo se proporciona method (backward compatibility), determinar category
      isQR = method === "qr";
      
      if (["cash", "transfer"].includes(method)) {
        paymentCategory = "manual";
      } else if (["qr", "card", "gateway"].includes(method)) {
        paymentCategory = "gateway";
      } else if (["mercadopago", "stripe", "paypal"].includes(method)) {
        paymentCategory = "external";
      } else {
        paymentCategory = "manual"; // Default
      }
    }
    
    // Preparar datos del pago
    const amount = typeof parsed.data.amount === "number" 
      ? parsed.data.amount 
      : parseFloat(parsed.data.amount);
    
    // Si es QR, generar el QR automáticamente
    let qrMetadata: any = null;
    if (isQR) {
      try {
        console.log(`[POST /api/sales/:id/payments] Detectado pago QR, generando QR...`);
        const qrResult = await generateQRPayment(tenantId, params.id, amount, "dynamic");
        qrMetadata = {
          qr_code: qrResult.qr_code,
          qr_payload: qrResult.qr_payload,
          provider: qrResult.provider,
          ...(qrResult.expires_at && { expires_at: qrResult.expires_at }),
        };
        console.log(`[POST /api/sales/:id/payments] QR generado exitosamente con provider: ${qrResult.provider}`);
      } catch (error: any) {
        console.error(`[POST /api/sales/:id/payments] Error al generar QR:`, error);
        return errorResponse(
          `Error al generar QR: ${error.message || "Error desconocido"}`,
          500
        );
      }
    }
    
    // SPRINT B: Determinar estado inicial según reglas (backend decide, no frontend)
    // El backend SIEMPRE decide el estado inicial según el tipo de pago
    // Solo respetamos el status proporcionado si es compatible con las reglas
    let paymentStatus: "pending" | "confirmed" | "failed" | "refunded";
    
    // Calcular el estado inicial según el tipo
    const calculatedInitialStatus = getInitialPaymentStatus(paymentCategory);
    
    // Si se proporciona status explícitamente, validar compatibilidad
    if (statusProvidedExplicitly && body.status && body.status !== calculatedInitialStatus) {
      // Si el status proporcionado difiere del calculado, validar compatibilidad
      if (body.status === "confirmed" && paymentCategory === "gateway") {
        // Gateway no puede iniciar en confirmed
        return errorResponse("Los pagos de gateway siempre inician en estado 'pending'. No se puede crear directamente como 'confirmed'", 400);
      }
      // Si es compatible, usar el proporcionado (solo para casos especiales como "failed", "processing")
      if (["pending", "processing", "confirmed", "failed", "refunded"].includes(body.status)) {
        paymentStatus = body.status;
      } else {
        paymentStatus = calculatedInitialStatus;
      }
    } else {
      // SPRINT B: El backend decide el estado inicial según el tipo
      paymentStatus = calculatedInitialStatus;
    }
    
    console.log(`[POST /api/sales/:id/payments] Estado final ANTES de insert: paymentStatus=${paymentStatus}, paymentCategory=${paymentCategory}, calculatedInitialStatus=${calculatedInitialStatus}, statusProvidedExplicitly=${statusProvidedExplicitly}, body.status=${body.status}`);
    
    // SPRINT B: Generar idempotency_key para evitar duplicados
    // Incluir payment_method_id para diferenciar métodos con el mismo type
    const idempotencyKey = generateIdempotencyKey(
      params.id,
      amount,
      method,
      parsed.data.externalReference || null,
      paymentMethodId || null
    );
    
    // SPRINT B: Verificar si ya existe un pago con la misma idempotency_key
    const { data: existingPayment, error: checkDuplicateError } = await supabase
      .from("payments")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .single();
    
    if (existingPayment && !checkDuplicateError) {
      // Ya existe un pago con la misma clave de idempotencia
      console.log(`[POST /api/sales/:id/payments] Pago duplicado detectado (idempotency_key: ${idempotencyKey}), retornando pago existente`);
      // Retornar el pago existente
      const { data: existingPaymentFull, error: fetchExistingError } = await supabase
        .from("payments")
        .select(`
          *,
          payment_methods:payment_method_id (
            id,
            code,
            label,
            type,
            payment_category,
            is_active
          )
        `)
        .eq("id", existingPayment.id)
        .single();
      
      if (!fetchExistingError && existingPaymentFull) {
        return jsonResponse(existingPaymentFull, 200); // 200 porque ya existe
      }
    }
    
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
    
    // SPRINT B/C: Crear el pago con idempotency_key
    // Asegurar que paymentStatus tenga un valor válido
    const finalStatus: "pending" | "processing" | "confirmed" | "failed" | "refunded" = paymentStatus || getInitialPaymentStatus(paymentCategory);
    
    // Paso 1: Log real del insert
    const insertPayload: any = {
      sale_id: params.id,
      tenant_id: tenantId,
      amount: amount.toString(),
      method: method, // Backward compatibility
      payment_method_id: paymentMethodId,
      status: finalStatus, // SPRINT B: Estado determinado por el backend según el tipo
      reference: parsed.data.reference || null,
      external_reference: parsed.data.externalReference || null,
      // Si es QR, usar el metadata generado; sino usar el proporcionado o null
      gateway_metadata: isQR ? qrMetadata : (parsed.data.gatewayMetadata || null),
      idempotency_key: idempotencyKey, // SPRINT B: Clave de idempotencia
      created_by: user.id,
    };

    // SPRINT F: Agregar campos de evidencia de pago si se proporcionan
    if (parsed.data.proofType) {
      insertPayload.proof_type = parsed.data.proofType;
    }
    if (parsed.data.proofReference !== undefined) {
      insertPayload.proof_reference = parsed.data.proofReference;
    }
    if (parsed.data.proofFileUrl) {
      insertPayload.proof_file_url = parsed.data.proofFileUrl;
    }
    if (parsed.data.terminalId) {
      insertPayload.terminal_id = parsed.data.terminalId;
    }
    if (parsed.data.cashRegisterId) {
      insertPayload.cash_register_id = parsed.data.cashRegisterId;
    }
    
    console.log("[POST /api/sales/:id/payments] Paso 1 - Creating payment:", {
      methodType: method,
      paymentCategory,
      statusToInsert: finalStatus,
      saleId: params.id,
      amount: amount.toString(),
      insertPayload: JSON.stringify(insertPayload, null, 2)
    });
    
    // Paso 2: Log del response de Supabase
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert(insertPayload)
      .select()
      .single();
    
    if (paymentError || !payment) {
      console.error("[POST /api/sales/:id/payments] Error al crear pago:", paymentError);
      return errorResponse("Error al crear el pago", 500, paymentError?.message, paymentError?.code);
    }
    
    console.log("[POST /api/sales/:id/payments] Paso 2 - Supabase response:", {
      insertedStatus: payment.status,
      expectedStatus: finalStatus,
      match: payment.status === finalStatus,
      paymentId: payment.id,
      paymentCategory,
      methodType: method
    });
    
    // Si el status insertado no coincide con el esperado, es un problema crítico
    if (payment.status !== finalStatus) {
      console.error(`[POST /api/sales/:id/payments] ⚠️ CRÍTICO: Status insertado (${payment.status}) no coincide con esperado (${finalStatus}). paymentCategory=${paymentCategory}, methodType=${method}`);
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

