import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { recalculateSaleBalance, logPaymentEvent } from "@/lib/payment-helpers";
import { generateIdempotencyKey, getInitialPaymentStatus } from "@/lib/payment-helpers-sprint-b";
import { generateQRPayment } from "@/lib/qr-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// SPRINT F: Schema para crear pago QR
const createQRPaymentSchema = z.object({
  paymentMethodId: z.string().uuid().optional().nullable(),
  qrType: z.enum(["static", "dynamic"]).default("dynamic"), // static: QR fijo, dynamic: QR único por pago
  qrData: z.string().optional(), // Datos personalizados para el QR (opcional)
});

// POST /api/sales/:id/payments/qr - Crear pago con QR
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
      return errorResponse("ID de venta inválido", 400, uuidValidation.error.errors);
    }

    // Obtener tenantId
    const { searchParams } = new URL(req.url);
    let tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");
    if (!tenantId) {
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

    const body = await req.json();
    console.log("[POST /api/sales/:id/payments/qr] Body recibido:", JSON.stringify(body, null, 2));

    // Validar datos
    const parsed = createQRPaymentSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[POST /api/sales/:id/payments/qr] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Verificar que la venta existe y está en estado válido
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, total_amount, balance_amount, status, tenant_id")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (saleError || !sale) {
      if (saleError?.code === "PGRST116") {
        return errorResponse("Venta no encontrada", 404);
      }
      console.error("[POST /api/sales/:id/payments/qr] Error al obtener venta:", saleError);
      return errorResponse("Error al obtener la venta", 500, saleError?.message, saleError?.code);
    }

    if (sale.status === "draft") {
      return errorResponse("No se pueden crear pagos para ventas en estado draft", 400);
    }

    if (sale.status === "paid") {
      return errorResponse("La venta ya está pagada", 400);
    }

    const balanceAmount = parseFloat(sale.balance_amount || "0");
    if (balanceAmount <= 0) {
      return errorResponse("El balance de la venta ya es cero o negativo", 400);
    }

    // SPRINT F: Buscar o crear método de pago QR genérico
    let paymentMethodId = parsed.data.paymentMethodId;
    
    if (!paymentMethodId) {
      // Buscar método QR genérico del tenant
      const { data: qrMethod, error: qrMethodError } = await supabase
        .from("payment_methods")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("type", "qr")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (qrMethod && !qrMethodError) {
        paymentMethodId = qrMethod.id;
      } else {
        // Crear método QR genérico si no existe
        const { data: newQrMethod, error: createQrError } = await supabase
          .from("payment_methods")
          .insert({
            tenant_id: tenantId,
            code: "qr_generic",
            label: "QR Genérico",
            type: "qr",
            payment_category: "gateway",
            is_active: true,
            metadata: {
              provider: "generic_qr",
            },
          })
          .select()
          .single();

        if (createQrError || !newQrMethod) {
          console.error("[POST /api/sales/:id/payments/qr] Error al crear método QR:", createQrError);
          return errorResponse("Error al crear método de pago QR", 500, createQrError?.message);
        }

        paymentMethodId = newQrMethod.id;
      }
    }

    // SPRINT F: Generar idempotency_key
    const idempotencyKey = generateIdempotencyKey(
      params.id,
      balanceAmount,
      "qr",
      paymentMethodId
    );

    // Verificar idempotencia
    const { data: existingPayment, error: existingError } = await supabase
      .from("payments")
      .select("id, status, amount, external_reference, gateway_metadata")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existingPayment && !existingError) {
      console.log("[POST /api/sales/:id/payments/qr] Pago existente detectado:", existingPayment.id);
      // Retornar el pago existente con su QR en el formato requerido
      const gatewayMetadata = existingPayment.gateway_metadata as any;
      return jsonResponse({
        id: existingPayment.id,
        status: existingPayment.status,
        amount: parseFloat(existingPayment.amount || "0"),
        gateway_metadata: gatewayMetadata || null,
      }, 200);
    }

    // Generar QR usando el helper (intenta Mercado Pago si está configurado, sino genérico)
    const qrType = parsed.data.qrType || "dynamic";
    let qrResult;
    
    // Asegurar que tenantId no sea null
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }
    
    try {
      qrResult = await generateQRPayment(tenantId, params.id, balanceAmount, qrType);
    } catch (error: any) {
      console.error("[POST /api/sales/:id/payments/qr] Error al generar QR:", error);
      return errorResponse(
        `Error al generar QR: ${error.message || "Error desconocido"}`,
        500
      );
    }

    // Crear pago con status pending (requiere confirmación manual)
    const paymentStatus = getInitialPaymentStatus("gateway"); // gateway siempre inicia en pending

    // Formato requerido de gateway_metadata según contrato
    const gatewayMetadata = {
      qr_code: qrResult.qr_code,
      qr_payload: qrResult.qr_payload,
      provider: qrResult.provider,
      ...(qrResult.expires_at && { expires_at: qrResult.expires_at }),
    };

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        sale_id: params.id,
        tenant_id: tenantId,
        amount: balanceAmount.toString(),
        method: "qr",
        payment_method_id: paymentMethodId,
        status: paymentStatus,
        external_reference: `QR-${params.id}-${Date.now()}`,
        gateway_metadata: gatewayMetadata,
        idempotency_key: idempotencyKey,
        created_by: user.id,
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("[POST /api/sales/:id/payments/qr] Error al crear pago:", paymentError);
      return errorResponse("Error al crear el pago", 500, paymentError?.message, paymentError?.code);
    }

    // Registrar evento de auditoría
    const previousState = null;
    const newState = {
      amount: balanceAmount.toString(),
      method: "qr",
      payment_method_id: paymentMethodId,
      status: paymentStatus,
      qr_type: qrType,
    };

    await logPaymentEvent(
      payment.id,
      "created",
      previousState,
      newState,
      user.id
    );

    // Retornar pago con gateway_metadata en formato requerido
    return jsonResponse({
      id: payment.id,
      status: payment.status,
      amount: parseFloat(payment.amount || "0"),
      gateway_metadata: gatewayMetadata,
    }, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/sales/:id/payments/qr");
  }
}


