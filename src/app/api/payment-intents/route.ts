import { supabase } from "@/lib/supabase";
import { createPaymentIntentSchema } from "@/validations/payment-intent";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { z } from "zod";

// GET /api/payment-intents - Listar intenciones de pago
export async function GET(req: Request) {
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

    // Filtros
    const saleId = searchParams.get("saleId");
    const status = searchParams.get("status");
    const gateway = searchParams.get("gateway");
    
    // Construir query
    let query = supabase
      .from("payment_intents")
      .select("*")
      .eq("tenant_id", tenantId);
    
    // Aplicar filtros
    if (saleId) {
      query = query.eq("sale_id", saleId);
    }
    
    if (status) {
      query = query.eq("status", status);
    }
    
    if (gateway) {
      query = query.eq("gateway", gateway);
    }
    
    // Ordenar por fecha de creación (más recientes primero)
    query = query.order("created_at", { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[GET /api/payment-intents] Error de Supabase:", error);
      return errorResponse("Error al obtener intenciones de pago", 500, error.message, error.code);
    }
    
    return jsonResponse(data || []);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/payment-intents");
  }
}

// POST /api/payment-intents - Crear intención de pago
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
    console.log("[POST /api/payment-intents] Body recibido:", JSON.stringify(body, null, 2));
    
    // Validar datos
    const parsed = createPaymentIntentSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[POST /api/payment-intents] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    // Obtener tenant_id de la venta
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("tenant_id")
      .eq("id", parsed.data.saleId)
      .single();
    
    if (saleError || !sale) {
      return errorResponse("Venta no encontrada", 404);
    }
    
    const tenantId = sale.tenant_id;
    
    // Preparar datos
    const amount = typeof parsed.data.amount === "number" 
      ? parsed.data.amount 
      : parseFloat(parsed.data.amount);
    
    const expiresAt = parsed.data.expiresAt 
      ? new Date(parsed.data.expiresAt).toISOString()
      : null;
    
    // Crear intención de pago
    const { data: paymentIntent, error: insertError } = await supabase
      .from("payment_intents")
      .insert({
        sale_id: parsed.data.saleId,
        tenant_id: tenantId,
        amount: amount.toString(),
        gateway: parsed.data.gateway,
        status: "created",
        expires_at: expiresAt,
        external_reference: parsed.data.externalReference || null,
        gateway_metadata: parsed.data.gatewayMetadata || null,
        created_by: user.id,
      })
      .select()
      .single();
    
    if (insertError || !paymentIntent) {
      console.error("[POST /api/payment-intents] Error al crear intención de pago:", insertError);
      return errorResponse("Error al crear la intención de pago", 500, insertError?.message, insertError?.code);
    }
    
    return jsonResponse(paymentIntent, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/payment-intents");
  }
}

