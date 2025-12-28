import { supabase } from "@/lib/supabase";
import { updatePaymentGatewaySchema } from "@/validations/payment-gateway";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// GET /api/payment-gateways/:id - Obtener gateway específico
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

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID de gateway inválido", 400, uuidValidation.error.errors);
    }

    // Obtener gateway
    const { data: gateway, error } = await supabase
      .from("payment_gateways")
      .select("*")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return errorResponse("Gateway no encontrado", 404);
      }
      console.error("[GET /api/payment-gateways/:id] Error al obtener gateway:", error);
      return errorResponse("Error al obtener el gateway", 500, error.message, error.code);
    }

    // No exponer credenciales completas
    const safeGateway = {
      ...gateway,
      credentials: gateway.credentials ? { exists: true } : null,
    };

    return jsonResponse(safeGateway);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/payment-gateways/:id");
  }
}

// PUT /api/payment-gateways/:id - Actualizar gateway
export async function PUT(
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

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID de gateway inválido", 400, uuidValidation.error.errors);
    }
    console.log("[PUT /api/payment-gateways/:id] Body recibido:", JSON.stringify(body, null, 2));

    // Validar datos
    const parsed = updatePaymentGatewaySchema.safeParse(body);
    
    if (!parsed.success) {
      console.error("[PUT /api/payment-gateways/:id] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Verificar que el gateway existe y pertenece al tenant
    const { data: existingGateway, error: checkError } = await supabase
      .from("payment_gateways")
      .select("id")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (checkError || !existingGateway) {
      if (checkError?.code === "PGRST116") {
        return errorResponse("Gateway no encontrado", 404);
      }
      return errorResponse("Gateway no encontrado o no pertenece a este tenant", 404);
    }

    // Actualizar gateway
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.enabled !== undefined) {
      updateData.enabled = parsed.data.enabled;
    }

    if (parsed.data.credentials !== undefined) {
      updateData.credentials = parsed.data.credentials;
    }

    if (parsed.data.config !== undefined) {
      updateData.config = parsed.data.config;
    }

    const { data: gateway, error: updateError } = await supabase
      .from("payment_gateways")
      .update(updateData)
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (updateError || !gateway) {
      console.error("[PUT /api/payment-gateways/:id] Error al actualizar gateway:", updateError);
      return errorResponse("Error al actualizar el gateway", 500, updateError?.message, updateError?.code);
    }

    // No exponer credenciales completas
    const safeGateway = {
      ...gateway,
      credentials: gateway.credentials ? { exists: true } : null,
    };

    return jsonResponse(safeGateway);
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/payment-gateways/:id");
  }
}

// DELETE /api/payment-gateways/:id - Eliminar gateway
export async function DELETE(
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

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID de gateway inválido", 400, uuidValidation.error.errors);
    }

    // Verificar que el gateway existe y pertenece al tenant
    const { data: existingGateway, error: checkError } = await supabase
      .from("payment_gateways")
      .select("id")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (checkError || !existingGateway) {
      if (checkError?.code === "PGRST116") {
        return errorResponse("Gateway no encontrado", 404);
      }
      return errorResponse("Gateway no encontrado o no pertenece a este tenant", 404);
    }

    // Eliminar gateway
    const { error: deleteError } = await supabase
      .from("payment_gateways")
      .delete()
      .eq("id", params.id)
      .eq("tenant_id", tenantId);

    if (deleteError) {
      console.error("[DELETE /api/payment-gateways/:id] Error al eliminar gateway:", deleteError);
      return errorResponse("Error al eliminar el gateway", 500, deleteError.message, deleteError.code);
    }

    return jsonResponse({ message: "Gateway eliminado correctamente" });
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/payment-gateways/:id");
  }
}

