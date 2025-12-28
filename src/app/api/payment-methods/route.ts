import { supabase } from "@/lib/supabase";
import { createPaymentMethodSchema } from "@/validations/payment-method";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// GET /api/payment-methods - Listar métodos de pago
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
    const isActive = searchParams.get("isActive");
    const type = searchParams.get("type");
    
    // Construir query
    let query = supabase
      .from("payment_methods")
      .select("*")
      .eq("tenant_id", tenantId);
    
    // Aplicar filtros
    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true");
    }
    
    if (type) {
      query = query.eq("type", type);
    }
    
    // Ordenar por código
    query = query.order("code", { ascending: true });
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[GET /api/payment-methods] Error de Supabase:", error);
      return errorResponse("Error al obtener métodos de pago", 500, error.message, error.code);
    }
    
    return jsonResponse(data || []);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/payment-methods");
  }
}

// POST /api/payment-methods - Crear método de pago
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
    console.log("[POST /api/payment-methods] Body recibido:", JSON.stringify(body, null, 2));
    
    // Obtener tenant_id del body o header
    let tenantId = body.tenantId || req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      // Usar store por defecto
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (!defaultStore) {
        return errorResponse("No se encontró store por defecto. Proporciona tenantId en el body o header x-tenant-id", 400);
      }
      
      tenantId = defaultStore.id;
    }
    
    // Validar datos
    const parsed = createPaymentMethodSchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[POST /api/payment-methods] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }
    
    // Verificar que el código no exista para este tenant
    const { data: existing, error: checkError } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("code", parsed.data.code)
      .single();
    
    if (existing) {
      return errorResponse(`Ya existe un método de pago con el código '${parsed.data.code}' para este tenant`, 400);
    }
    
    // Crear método de pago
    const { data: paymentMethod, error: insertError } = await supabase
      .from("payment_methods")
      .insert({
        tenant_id: tenantId,
        code: parsed.data.code,
        label: parsed.data.label,
        type: parsed.data.type,
        is_active: parsed.data.isActive ?? true,
        metadata: parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null,
      })
      .select()
      .single();
    
    if (insertError || !paymentMethod) {
      console.error("[POST /api/payment-methods] Error al crear método de pago:", insertError);
      return errorResponse("Error al crear el método de pago", 500, insertError?.message, insertError?.code);
    }
    
    // Parsear metadata si existe
    if (paymentMethod.metadata && typeof paymentMethod.metadata === 'string') {
      try {
        paymentMethod.metadata = JSON.parse(paymentMethod.metadata);
      } catch {
        // Si no se puede parsear, dejarlo como está
      }
    }
    
    return jsonResponse(paymentMethod, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/payment-methods");
  }
}

