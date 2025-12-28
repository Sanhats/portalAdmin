import { supabase } from "@/lib/supabase";
import { createPaymentGatewaySchema } from "@/validations/payment-gateway";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

// GET /api/payment-gateways - Listar gateways del tenant
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

    // Obtener query params
    const provider = searchParams.get("provider");
    const enabled = searchParams.get("enabled");

    // Construir query
    let query = supabase
      .from("payment_gateways")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (provider) {
      query = query.eq("provider", provider);
    }

    if (enabled !== null) {
      query = query.eq("enabled", enabled === "true");
    }

    const { data: gateways, error } = await query;

    if (error) {
      console.error("[GET /api/payment-gateways] Error al obtener gateways:", error);
      return errorResponse("Error al obtener los gateways", 500, error.message, error.code);
    }

    // No exponer credenciales completas en la lista (solo indicar si existen)
    const safeGateways = (gateways || []).map(gateway => ({
      ...gateway,
      credentials: gateway.credentials ? { exists: true } : null,
    }));

    return jsonResponse(safeGateways);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/payment-gateways");
  }
}

// POST /api/payment-gateways - Crear gateway
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
    console.log("[POST /api/payment-gateways] Body recibido:", JSON.stringify(body, null, 2));

    // Validar datos
    const parsed = createPaymentGatewaySchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[POST /api/payment-gateways] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Verificar que no exista ya un gateway con el mismo provider para este tenant
    const { data: existingGateway, error: checkError } = await supabase
      .from("payment_gateways")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("provider", parsed.data.provider)
      .single();

    if (existingGateway && !checkError) {
      return errorResponse(`Ya existe un gateway con provider '${parsed.data.provider}' para este tenant`, 409);
    }

    // Crear gateway
    const { data: gateway, error: insertError } = await supabase
      .from("payment_gateways")
      .insert({
        tenant_id: tenantId,
        provider: parsed.data.provider,
        enabled: parsed.data.enabled ?? false,
        credentials: parsed.data.credentials || null,
        config: parsed.data.config || null,
      })
      .select()
      .single();

    if (insertError || !gateway) {
      console.error("[POST /api/payment-gateways] Error al crear gateway:", insertError);
      return errorResponse("Error al crear el gateway", 500, insertError?.message, insertError?.code);
    }

    // No exponer credenciales completas
    const safeGateway = {
      ...gateway,
      credentials: gateway.credentials ? { exists: true } : null,
    };

    return jsonResponse(safeGateway, 201);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/payment-gateways");
  }
}

