import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { GatewayFactory } from "@/lib/gateway-interface";
import { MercadoPagoGateway } from "@/lib/gateways/mercadopago-gateway";
import { recalculateSaleBalance, logPaymentEvent } from "@/lib/payment-helpers";

// SPRINT E: Registrar Mercado Pago Gateway si no está registrado
if (!GatewayFactory.isRegistered("mercadopago")) {
  GatewayFactory.register("mercadopago", MercadoPagoGateway);
}

// POST /api/webhooks/mercadopago - Recibir webhook de Mercado Pago
export async function POST(req: Request) {
  try {
    console.log("[POST /api/webhooks/mercadopago] Webhook recibido");
    
    // SPRINT E: Obtener headers y body del webhook
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const body = await req.json();
    console.log("[POST /api/webhooks/mercadopago] Body recibido:", JSON.stringify(body, null, 2));
    console.log("[POST /api/webhooks/mercadopago] Headers:", JSON.stringify(headers, null, 2));

    // SPRINT E: Parsear webhook usando el gateway
    // Obtener access_token de variables de entorno o de la DB
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("[POST /api/webhooks/mercadopago] No hay MERCADOPAGO_ACCESS_TOKEN configurado");
      return errorResponse("Configuración de Mercado Pago no encontrada", 500);
    }

    // Crear instancia del gateway para parsear el webhook
    const mercadoPagoGateway = GatewayFactory.create(
      "mercadopago",
      { access_token: accessToken },
      {}
    );

    // SPRINT E: Parsear webhook y obtener evento estandarizado
    let gatewayEvent;
    try {
      gatewayEvent = mercadoPagoGateway.parseWebhook(body, headers);
      console.log("[POST /api/webhooks/mercadopago] Evento parseado:", JSON.stringify(gatewayEvent, null, 2));
    } catch (error: any) {
      console.error("[POST /api/webhooks/mercadopago] Error al parsear webhook:", error);
      return errorResponse("Error al parsear webhook", 400, error.message);
    }

    // SPRINT E: Validar que tenemos los datos necesarios
    if (!gatewayEvent.paymentId || !gatewayEvent.externalReference) {
      console.error("[POST /api/webhooks/mercadopago] Webhook sin paymentId o externalReference");
      return errorResponse("Webhook inválido: falta paymentId o externalReference", 400);
    }

    // SPRINT E: Buscar el pago en nuestra base de datos
    // Mercado Pago envía en el webhook:
    // - data.id: payment_id (ID del pago en MP, NO es el preference_id)
    // - data.external_reference: el external_reference que configuramos (sale_id)
    // 
    // En nuestra DB guardamos:
    // - external_reference: preference_id (de la preference creada)
    // - gateway_metadata.preference_id: preference_id
    //
    // Buscamos por:
    // 1. sale_id usando external_reference del webhook (sale_id que configuramos)
    // 2. external_reference si coincide con el payment_id (por si acaso)
    
    let payment: any = null;
    let sale: any = null;
    let paymentError: any = null;

    // SPRINT E: Buscar por sale_id usando external_reference del webhook
    // El external_reference que configuramos es el sale_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(gatewayEvent.externalReference)) {
      const { data: paymentBySale, error: errorBySale } = await supabase
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
        .eq("sale_id", gatewayEvent.externalReference)
        .eq("method", "mercadopago")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentBySale && !errorBySale) {
        payment = paymentBySale;
        sale = paymentBySale.sales;
        console.log(`[POST /api/webhooks/mercadopago] Pago encontrado por sale_id: ${gatewayEvent.externalReference}`);
      } else {
        paymentError = errorBySale;
      }
    }

    // Si no se encontró por sale_id, intentar por external_reference (preference_id)
    if (!payment) {
      const { data: paymentByRef, error: errorByRef } = await supabase
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
        .eq("external_reference", gatewayEvent.paymentId)
        .eq("method", "mercadopago")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentByRef && !errorByRef) {
        payment = paymentByRef;
        sale = paymentByRef.sales;
        console.log(`[POST /api/webhooks/mercadopago] Pago encontrado por external_reference: ${gatewayEvent.paymentId}`);
      } else {
        paymentError = errorByRef || paymentError;
      }
    }

    if (!payment) {
      console.error("[POST /api/webhooks/mercadopago] Pago no encontrado:", {
        paymentId: gatewayEvent.paymentId,
        externalReference: gatewayEvent.externalReference,
        error: paymentError,
      });
      // Retornar 200 para que MP no reintente (el pago puede no existir en nuestro sistema)
      return jsonResponse({ message: "Pago no encontrado en el sistema" }, 200);
    }

    // SPRINT E: Procesar el evento del webhook
    await processWebhookEvent(payment, gatewayEvent, body, sale);

    return jsonResponse({ message: "Webhook procesado correctamente" }, 200);
  } catch (error) {
    console.error("[POST /api/webhooks/mercadopago] Error inesperado:", error);
    return handleUnexpectedError(error, "POST /api/webhooks/mercadopago");
  }
}

/**
 * SPRINT E: Procesa un evento de webhook y actualiza el estado del pago
 */
async function processWebhookEvent(
  payment: any,
  gatewayEvent: any,
  rawPayload: any,
  sale: any
) {
  const previousStatus = payment.status;
  const newStatus = gatewayEvent.status;

  // SPRINT E: Si el estado no cambió, no hacer nada (idempotencia)
  if (previousStatus === newStatus) {
    console.log(`[processWebhookEvent] Pago ${payment.id} ya está en estado ${newStatus}, ignorando webhook`);
    return;
  }

  // SPRINT E: Validar transiciones de estado válidas
  const validTransitions: Record<string, string[]> = {
    pending: ["confirmed", "failed", "refunded"],
    processing: ["confirmed", "failed", "refunded"],
    confirmed: ["refunded"],
    failed: [], // No se puede cambiar desde failed
    refunded: [], // No se puede cambiar desde refunded
  };

  const allowedStatuses = validTransitions[previousStatus] || [];
  if (!allowedStatuses.includes(newStatus)) {
    console.error(`[processWebhookEvent] Transición inválida: ${previousStatus} → ${newStatus}`);
    return;
  }

  // SPRINT E: Actualizar estado del pago
  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: newStatus,
      gateway_metadata: {
        ...(payment.gateway_metadata || {}),
        last_webhook: {
          type: gatewayEvent.type,
          status: newStatus,
          timestamp: gatewayEvent.timestamp,
          raw_payload: rawPayload,
        },
      },
    })
    .eq("id", payment.id);

  if (updateError) {
    console.error("[processWebhookEvent] Error al actualizar pago:", updateError);
    throw updateError;
  }

  console.log(`[processWebhookEvent] Pago ${payment.id} actualizado: ${previousStatus} → ${newStatus}`);

  // SPRINT E: Registrar evento de auditoría
  const previousState = {
    status: previousStatus,
    amount: payment.amount,
    method: payment.method,
  };

  const newState = {
    status: newStatus,
    amount: payment.amount,
    method: payment.method,
    gateway_event: gatewayEvent.type,
  };

  // Obtener tenant_id del sale
  const tenantId = sale?.tenant_id || payment.tenant_id;
  
  // Usar un usuario del sistema para eventos de webhook (o null si no hay)
  const systemUserId = "00000000-0000-0000-0000-000000000000"; // UUID del sistema

  await logPaymentEvent(
    payment.id,
    "status_changed",
    previousState,
    newState,
    systemUserId
  );

  // SPRINT E: Recalcular balance de la venta si el estado cambió a confirmed o refunded
  if (newStatus === "confirmed" || newStatus === "refunded") {
    try {
      const balanceResult = await recalculateSaleBalance(payment.sale_id);
      console.log(`[processWebhookEvent] Balance recalculado para venta ${payment.sale_id}:`, {
        paidAmount: balanceResult.paidAmount,
        balanceAmount: balanceResult.balanceAmount,
        isPaid: balanceResult.isPaid,
      });
    } catch (balanceError) {
      console.error("[processWebhookEvent] Error al recalcular balance:", balanceError);
      // No fallar, solo loguear
    }
  }
}

