import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { GatewayFactory } from "@/lib/gateway-interface";
import { MercadoPagoGateway } from "@/lib/gateways/mercadopago-gateway";
import { recalculateSaleBalance, logPaymentEvent } from "@/lib/payment-helpers";
import { generateIdempotencyKey, getInitialPaymentStatus } from "@/lib/payment-helpers-sprint-b";
import { z } from "zod";

// SPRINT D: Registrar Mercado Pago Gateway
if (!GatewayFactory.isRegistered("mercadopago")) {
  GatewayFactory.register("mercadopago", MercadoPagoGateway);
}

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// POST /api/sales/:id/payments/mercadopago - Crear pago con Mercado Pago
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

    const { searchParams } = new URL(req.url);
    
    // Obtener tenant_id del query param o header
    let tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      // Usar store por defecto
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (!defaultStore) {
        return errorResponse("No se encontró store por defecto. Proporciona tenantId", 400);
      }
      
      tenantId = defaultStore.id;
    }

    // Verificar que la venta existe y obtener balance_amount
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, tenant_id, status, total_amount, balance_amount, paid_amount")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (saleError || !sale) {
      if (saleError?.code === "PGRST116") {
        return errorResponse("Venta no encontrada", 404);
      }
      console.error("[POST /api/sales/:id/payments/mercadopago] Error al obtener venta:", saleError);
      return errorResponse("Error al obtener la venta", 500, saleError?.message, saleError?.code);
    }

    // Validar que la venta esté en un estado válido para pagar
    if (sale.status === "draft") {
      return errorResponse("No se puede crear un pago para una venta en estado 'draft'. Confirma la venta primero", 400);
    }

    if (sale.status === "paid") {
      return errorResponse("La venta ya está pagada completamente", 400);
    }

    if (sale.status === "cancelled") {
      return errorResponse("No se puede crear un pago para una venta cancelada", 400);
    }

    // SPRINT D: Obtener gateway de Mercado Pago configurado para este tenant
    const { data: gateway, error: gatewayError } = await supabase
      .from("payment_gateways")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("provider", "mercadopago")
      .eq("enabled", true)
      .single();

    if (gatewayError || !gateway) {
      if (gatewayError?.code === "PGRST116") {
        return errorResponse("Gateway de Mercado Pago no configurado o deshabilitado para este tenant", 400);
      }
      console.error("[POST /api/sales/:id/payments/mercadopago] Error al obtener gateway:", gatewayError);
      return errorResponse("Error al obtener el gateway de Mercado Pago", 500, gatewayError?.message, gatewayError?.code);
    }

    // SPRINT D: Obtener método de pago de Mercado Pago (o crearlo si no existe)
    let paymentMethodId: string | null = null;
    const { data: existingMethod, error: methodCheckError } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("type", "mercadopago")
      .eq("is_active", true)
      .single();

    if (existingMethod && !methodCheckError) {
      paymentMethodId = existingMethod.id;
    } else {
      // Crear método de pago de Mercado Pago si no existe
      const { data: newMethod, error: createMethodError } = await supabase
        .from("payment_methods")
        .insert({
          tenant_id: tenantId,
          code: "mercadopago_default",
          label: "Mercado Pago",
          type: "mercadopago",
          payment_category: "external",
          is_active: true,
        })
        .select("id")
        .single();

      if (createMethodError || !newMethod) {
        console.error("[POST /api/sales/:id/payments/mercadopago] Error al crear método de pago:", createMethodError);
        // Continuar sin payment_method_id si falla
      } else {
        paymentMethodId = newMethod.id;
      }
    }

    // SPRINT D: Calcular monto a pagar (balance_amount)
    const balanceAmount = parseFloat(sale.balance_amount || "0");
    if (balanceAmount <= 0) {
      return errorResponse("La venta ya está pagada completamente", 400);
    }

    // SPRINT D: Generar idempotency_key
    const idempotencyKey = generateIdempotencyKey(
      params.id,
      balanceAmount,
      "mercadopago",
      null,
      paymentMethodId
    );

    // SPRINT D: Verificar si ya existe un pago con la misma idempotency_key
    const { data: existingPayment, error: checkDuplicateError } = await supabase
      .from("payments")
      .select("id, status, external_reference")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existingPayment && !checkDuplicateError) {
      // Ya existe un pago con la misma clave de idempotencia
      console.log(`[POST /api/sales/:id/payments/mercadopago] Pago duplicado detectado (idempotency_key: ${idempotencyKey}), retornando pago existente`);
      
      // Obtener el pago completo
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
        .eq("id", existingPayment.id)
        .single();

      if (!fetchError && paymentComplete) {
        // Obtener gateway_metadata para retornar checkoutUrl
        const gatewayMetadata = paymentComplete.gateway_metadata as any;
        return jsonResponse({
          ...paymentComplete,
          checkoutUrl: gatewayMetadata?.init_point || gatewayMetadata?.checkoutUrl,
        }, 200);
      }
    }

    // SPRINT D: Crear instancia del gateway de Mercado Pago
    const credentials = (gateway.credentials as any) || {};
    const config = (gateway.config as any) || {};

    // SPRINT D: Priorizar access_token de variables de entorno sobre el de la DB
    // Esto permite usar un token global sin tener que configurarlo por tenant
    let accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (accessToken) {
      console.log("[POST /api/sales/:id/payments/mercadopago] Usando access_token de variable de entorno MERCADOPAGO_ACCESS_TOKEN");
      credentials.access_token = accessToken;
    } else {
      // Fallback a credenciales del gateway si no hay variable de entorno
      accessToken = credentials.access_token;
      if (accessToken) {
        console.log("[POST /api/sales/:id/payments/mercadopago] Usando access_token de las credenciales del gateway");
      }
    }

    // Validar que hay credenciales
    if (!accessToken) {
      console.error("[POST /api/sales/:id/payments/mercadopago] No hay access_token en las credenciales del gateway ni en variables de entorno");
      return errorResponse("Gateway de Mercado Pago no tiene access_token configurado. Configúralo en el gateway o en la variable de entorno MERCADOPAGO_ACCESS_TOKEN", 400);
    }

    // Construir notification_url si no está configurada
    if (!config.notification_url && !config.webhook_url) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000";
      config.notification_url = `${baseUrl}/api/webhooks/mercadopago`;
    }

    let mercadoPagoGateway;
    try {
      console.log("[POST /api/sales/:id/payments/mercadopago] Creando instancia de MercadoPagoGateway...");
      mercadoPagoGateway = GatewayFactory.create("mercadopago", credentials, config);
      console.log("[POST /api/sales/:id/payments/mercadopago] Gateway creado exitosamente");
    } catch (error: any) {
      console.error("[POST /api/sales/:id/payments/mercadopago] Error al crear gateway:", error);
      console.error("[POST /api/sales/:id/payments/mercadopago] Stack:", error.stack);
      return errorResponse(`Error al inicializar gateway de Mercado Pago: ${error.message}`, 500);
    }

    // SPRINT D: Crear preference en Mercado Pago
    console.log(`[POST /api/sales/:id/payments/mercadopago] Creando preference con amount=${balanceAmount}, saleId=${params.id}`);
    let gatewayResponse;
    try {
      gatewayResponse = await mercadoPagoGateway.createPayment({
        saleId: params.id,
        amount: balanceAmount,
        currency: "ARS",
        description: `Pago de venta ${params.id}`,
        externalReference: params.id, // SPRINT D: external_reference = sale_id
        metadata: {
          tenant_id: tenantId,
          sale_id: params.id,
        },
      });
      console.log(`[POST /api/sales/:id/payments/mercadopago] Gateway response:`, JSON.stringify(gatewayResponse, null, 2));
    } catch (error: any) {
      console.error("[POST /api/sales/:id/payments/mercadopago] Error al llamar createPayment:", error);
      console.error("[POST /api/sales/:id/payments/mercadopago] Stack:", error.stack);
      return errorResponse(`Error al crear preference: ${error.message}`, 500);
    }

    if (!gatewayResponse.success || !gatewayResponse.checkoutUrl) {
      console.error("[POST /api/sales/:id/payments/mercadopago] Error al crear preference:", gatewayResponse.error);
      
      // Mensaje de error más descriptivo según el código
      let errorMessage = gatewayResponse.error?.message || "Error al crear preference en Mercado Pago";
      if (gatewayResponse.error?.code === "INVALID_ACCESS_TOKEN") {
        errorMessage = "Access token de Mercado Pago inválido. Verifica las credenciales del gateway en la configuración.";
      }
      
      return errorResponse(
        errorMessage,
        500,
        gatewayResponse.error
      );
    }

    // SPRINT D: Crear payment en DB con status pending y method mercadopago
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        sale_id: params.id,
        tenant_id: tenantId,
        amount: balanceAmount.toString(),
        method: "mercadopago",
        payment_method_id: paymentMethodId,
        status: "pending", // SPRINT D: status siempre pending para external
        external_reference: gatewayResponse.paymentId, // preference_id de MP
        gateway_metadata: {
          provider: "mercadopago",
          preference_id: gatewayResponse.paymentId,
          init_point: gatewayResponse.checkoutUrl,
          ...gatewayResponse.metadata,
        },
        idempotency_key: idempotencyKey,
        created_by: user.id,
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("[POST /api/sales/:id/payments/mercadopago] Error al crear pago:", paymentError);
      return errorResponse("Error al crear el pago", 500, paymentError?.message, paymentError?.code);
    }

    // Registrar evento de auditoría
    const previousState = null;
    const newState = {
      amount: balanceAmount.toString(),
      method: "mercadopago",
      payment_method_id: paymentMethodId,
      status: "pending",
      external_reference: gatewayResponse.paymentId,
      gateway_metadata: payment.gateway_metadata,
    };

    await logPaymentEvent(payment.id, "created", previousState, newState, user.id);

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
      console.error("[POST /api/sales/:id/payments/mercadopago] Error al obtener pago completo:", fetchError);
      return jsonResponse(payment, 201);
    }

    // SPRINT D: Retornar respuesta con checkoutUrl, payment_id y external_reference
    return jsonResponse({
      ...paymentComplete,
      checkoutUrl: gatewayResponse.checkoutUrl,
      payment_id: gatewayResponse.paymentId,
      external_reference: params.id, // sale_id
    }, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/sales/:id/payments/mercadopago");
  }
}

