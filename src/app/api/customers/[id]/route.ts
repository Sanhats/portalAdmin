import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { updateCustomerSchema } from "@/validations/customer";

// GET /api/customers/:id - Obtener cliente por ID
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
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    const { data: customer, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !customer) {
      return errorResponse("Cliente no encontrado", 404);
    }

    return jsonResponse(customer);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/customers/:id");
  }
}

// PUT /api/customers/:id - Actualizar cliente
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
    const tenantId = body.tenantId || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Validar datos
    const parsed = updateCustomerSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Verificar que el cliente existe y pertenece al tenant
    const { data: existingCustomer, error: checkError } = await supabase
      .from("customers")
      .select("id, document")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (checkError || !existingCustomer) {
      return errorResponse("Cliente no encontrado", 404);
    }

    // SPRINT 4: Validar unicidad de documento por tenant (si se está actualizando)
    if (parsed.data.document && parsed.data.document !== existingCustomer.document) {
      const { data: duplicateCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("document", parsed.data.document)
        .eq("active", true)
        .neq("id", params.id)
        .single();

      if (duplicateCustomer) {
        return errorResponse("Ya existe un cliente activo con ese documento en este tenant", 409);
      }
    }

    // Actualizar cliente
    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.document !== undefined) updateData.document = parsed.data.document;
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
    if (parsed.data.address !== undefined) updateData.address = parsed.data.address;
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

    const { data: customer, error: updateError } = await supabase
      .from("customers")
      .update(updateData)
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (updateError) {
      console.error("[PUT /api/customers/:id] Error al actualizar cliente:", updateError);
      
      // Manejar error de unicidad de documento
      if (updateError.code === "23505") {
        return errorResponse("Ya existe un cliente con ese documento en este tenant", 409);
      }
      
      return errorResponse("Error al actualizar cliente", 500, updateError.message, updateError.code);
    }

    return jsonResponse(customer);
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/customers/:id");
  }
}

// DELETE /api/customers/:id - Soft delete (marcar como inactivo)
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
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // SPRINT 4: Soft delete (marcar como inactivo)
    const { data: customer, error: updateError } = await supabase
      .from("customers")
      .update({ active: false })
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (updateError || !customer) {
      return errorResponse("Cliente no encontrado", 404);
    }

    return jsonResponse({ message: "Cliente eliminado correctamente", customer });
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/customers/:id");
  }
}
