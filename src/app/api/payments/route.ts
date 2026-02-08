import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { createPaymentSchema } from "@/validations/payment-sprint5";
import { getOrCreateAccount, registerPayment } from "@/lib/accounting-helpers-sprint5";
import { validatePaymentCashRegister } from "@/lib/cash-helpers-sprint6";

// POST /api/payments - Crear pago
export async function POST(req: Request) {
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

    const body = await req.json();

    // Obtener tenant_id del body, header o usar default
    let tenantId: string | null = body.tenantId || req.headers.get("x-tenant-id");
    
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

    // Validar datos
    const parsed = createPaymentSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Validar que el cliente existe y está activo
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, active")
      .eq("id", parsed.data.customerId)
      .eq("tenant_id", tenantId)
      .single();

    if (customerError || !customer) {
      return errorResponse("Cliente no encontrado", 404);
    }

    if (!customer.active) {
      return errorResponse("El cliente está inactivo", 400);
    }

    // Validar venta si se proporciona
    if (parsed.data.saleId) {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("id, customer_id, status")
        .eq("id", parsed.data.saleId)
        .eq("tenant_id", tenantId)
        .single();

      if (saleError || !sale) {
        return errorResponse("Venta no encontrada", 404);
      }

      // Validar que la venta pertenezca al cliente
      if (sale.customer_id !== parsed.data.customerId) {
        return errorResponse("La venta no pertenece al cliente especificado", 400);
      }

      // Validar que la venta esté confirmada
      if (sale.status !== "confirmed") {
        return errorResponse("Solo se pueden registrar pagos para ventas confirmadas", 400);
      }
    }

    // Normalizar amount
    const amount = typeof parsed.data.amount === "string" 
      ? parseFloat(parsed.data.amount) 
      : parsed.data.amount;

    if (amount <= 0) {
      return errorResponse("El monto debe ser mayor a 0", 400);
    }

    // Validar que tenantId no sea null
    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // SPRINT 6: Validar que haya caja abierta para el vendedor
    const cashValidation = await validatePaymentCashRegister(parsed.data.sellerId, tenantId);
    if (!cashValidation.valid) {
      return errorResponse(cashValidation.error || "No se puede registrar pago sin caja abierta", 400);
    }

    // Crear pago con caja asociada
    const { data: payment, error: createError } = await supabase
      .from("payments_sprint5")
      .insert({
        tenant_id: tenantId,
        customer_id: parsed.data.customerId,
        sale_id: parsed.data.saleId || null,
        amount: amount.toString(),
        method: parsed.data.method,
        notes: parsed.data.notes || null,
        // SPRINT 6: Campos de caja
        cash_register_id: cashValidation.cashRegisterId,
        seller_id: parsed.data.sellerId,
      })
      .select()
      .single();

    if (createError || !payment) {
      console.error("[POST /api/payments] Error al crear pago:", createError);
      return errorResponse("Error al crear pago", 500, createError?.message, createError?.code);
    }

    // SPRINT 5: Registrar movimiento credit en cuenta corriente
    try {
      const registerResult = await registerPayment(payment.id, tenantId);
      if (!registerResult.success) {
        // Si falla el registro del movimiento, eliminar el pago creado (rollback)
        await supabase.from("payments_sprint5").delete().eq("id", payment.id);
        return errorResponse(`Error al registrar movimiento: ${registerResult.error}`, 500);
      }
    } catch (registerError: any) {
      // Si falla el registro del movimiento, eliminar el pago creado (rollback)
      await supabase.from("payments_sprint5").delete().eq("id", payment.id);
      return errorResponse(`Error al registrar movimiento: ${registerError.message}`, 500);
    }

    // Obtener pago completo con relaciones
    const { data: paymentWithRelations, error: fetchError } = await supabase
      .from("payments_sprint5")
      .select(`
        *,
        customers:customer_id (
          id,
          name,
          document
        ),
        sales:sale_id (
          id,
          total,
          status
        )
      `)
      .eq("id", payment.id)
      .single();

    if (fetchError || !paymentWithRelations) {
      // El pago se creó pero no pudimos obtenerlo completo, retornar el básico
      return jsonResponse(payment, 201);
    }

    return jsonResponse(paymentWithRelations, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/payments");
  }
}
