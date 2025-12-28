import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { recalculateSaleBalance, logPaymentEvent } from "@/lib/payment-helpers";
import { generateIdempotencyKey, getInitialPaymentStatus } from "@/lib/payment-helpers-sprint-b";
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
      .select("id, status, external_reference, gateway_metadata")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (existingPayment && !existingError) {
      console.log("[POST /api/sales/:id/payments/qr] Pago existente detectado:", existingPayment.id);
      // Retornar el pago existente con su QR
      const qrData = (existingPayment.gateway_metadata as any)?.qr_data;
      return jsonResponse({
        id: existingPayment.id,
        qrCode: qrData?.qr_code || null,
        qrData: qrData?.qr_data || null,
        qrType: qrData?.qr_type || "dynamic",
        status: existingPayment.status,
      }, 200);
    }

    // SPRINT F: Generar datos del QR
    const qrType = parsed.data.qrType || "dynamic";
    let qrCode: string;
    let qrData: string;

    if (qrType === "static") {
      // QR estático: usar datos personalizados o datos del método de pago
      qrData = parsed.data.qrData || `VENTA:${params.id}`;
      qrCode = generateQRCode(qrData);
    } else {
      // QR dinámico: generar QR único con datos del pago
      qrData = JSON.stringify({
        sale_id: params.id,
        amount: balanceAmount,
        tenant_id: tenantId,
        timestamp: new Date().toISOString(),
        payment_id: null, // Se actualizará después de crear el pago
      });
      qrCode = generateQRCode(qrData);
    }

    // SPRINT F: Crear pago con status pending (requiere confirmación manual)
    const paymentStatus = getInitialPaymentStatus("gateway"); // gateway siempre inicia en pending

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
        gateway_metadata: {
          provider: "generic_qr",
          qr_type: qrType,
          qr_code: qrCode,
          qr_data: qrData,
        },
        idempotency_key: idempotencyKey,
        created_by: user.id,
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error("[POST /api/sales/:id/payments/qr] Error al crear pago:", paymentError);
      return errorResponse("Error al crear el pago", 500, paymentError?.message, paymentError?.code);
    }

    // Actualizar qr_data con el payment_id
    if (qrType === "dynamic") {
      const updatedQrData = JSON.stringify({
        sale_id: params.id,
        amount: balanceAmount,
        tenant_id: tenantId,
        timestamp: new Date().toISOString(),
        payment_id: payment.id,
      });
      const updatedQrCode = generateQRCode(updatedQrData);

      await supabase
        .from("payments")
        .update({
          gateway_metadata: {
            provider: "generic_qr",
            qr_type: qrType,
            qr_code: updatedQrCode,
            qr_data: updatedQrData,
          },
        })
        .eq("id", payment.id);
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

    return jsonResponse({
      id: payment.id,
      qrCode: qrType === "dynamic" ? (payment.gateway_metadata as any)?.qr_code : qrCode,
      qrData: qrType === "dynamic" ? (payment.gateway_metadata as any)?.qr_data : qrData,
      qrType,
      status: payment.status,
      amount: balanceAmount,
      saleId: params.id,
    }, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/sales/:id/payments/qr");
  }
}

/**
 * SPRINT F: Genera un código QR en formato texto (simulado)
 * En producción, usarías una librería como 'qrcode' para generar QR reales
 */
function generateQRCode(data: string): string {
  // SPRINT F: Simulación de generación de QR
  // En producción, usar: import QRCode from 'qrcode'; const qr = await QRCode.toDataURL(data);
  // Por ahora, retornamos un identificador único que representa el QR
  const hash = Buffer.from(data).toString('base64').substring(0, 20);
  return `QR-${hash}`;
}

