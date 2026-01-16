import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { updateSupplierSchema } from "@/validations/supplier";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// GET /api/suppliers/:id - Obtener proveedor por ID
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

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }

    // Obtener tenant_id del header o usar default
    let tenantId: string | null = req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (defaultStore) {
        tenantId = defaultStore.id;
      }
    }

    // Obtener proveedor
    let query = supabase
      .from("suppliers")
      .select("*")
      .eq("id", params.id)
      .is("deleted_at", null);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: supplier, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return errorResponse("Proveedor no encontrado", 404);
      }
      console.error("[GET /api/suppliers/:id] Error al obtener proveedor:", error);
      return errorResponse("Error al obtener proveedor", 500, error.message, error.code);
    }

    return jsonResponse(supplier);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/suppliers/:id");
  }
}

// PUT /api/suppliers/:id - Actualizar proveedor
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

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }

    const body = await req.json();

    // Validar datos
    const parsed = updateSupplierSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Obtener tenant_id del header o usar default
    let tenantId: string | null = req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (defaultStore) {
        tenantId = defaultStore.id;
      }
    }

    // Verificar que el proveedor existe y pertenece al tenant
    let checkQuery = supabase
      .from("suppliers")
      .select("id")
      .eq("id", params.id)
      .is("deleted_at", null);

    if (tenantId) {
      checkQuery = checkQuery.eq("tenant_id", tenantId);
    }

    const { data: existingSupplier } = await checkQuery.single();

    if (!existingSupplier) {
      return errorResponse("Proveedor no encontrado", 404);
    }

    // Preparar datos de actualización
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
    }
    if (parsed.data.email !== undefined) {
      updateData.email = parsed.data.email;
    }
    if (parsed.data.phone !== undefined) {
      updateData.phone = parsed.data.phone;
    }
    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes;
    }

    // Actualizar proveedor
    const { data: supplier, error: updateError } = await supabase
      .from("suppliers")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("[PUT /api/suppliers/:id] Error al actualizar proveedor:", updateError);
      return errorResponse("Error al actualizar proveedor", 500, updateError.message, updateError.code);
    }

    return jsonResponse(supplier);
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/suppliers/:id");
  }
}

// DELETE /api/suppliers/:id - Eliminar proveedor (soft delete)
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

    // Validar UUID
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }

    // Obtener tenant_id del header o usar default
    let tenantId: string | null = req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      const { data: defaultStore } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", "store-default")
        .is("deleted_at", null)
        .single();
      
      if (defaultStore) {
        tenantId = defaultStore.id;
      }
    }

    // Verificar que el proveedor existe y pertenece al tenant
    let checkQuery = supabase
      .from("suppliers")
      .select("id")
      .eq("id", params.id)
      .is("deleted_at", null);

    if (tenantId) {
      checkQuery = checkQuery.eq("tenant_id", tenantId);
    }

    const { data: existingSupplier } = await checkQuery.single();

    if (!existingSupplier) {
      return errorResponse("Proveedor no encontrado", 404);
    }

    // Verificar si tiene compras asociadas
    const { data: purchases } = await supabase
      .from("purchases")
      .select("id")
      .eq("supplier_id", params.id)
      .limit(1);

    if (purchases && purchases.length > 0) {
      return errorResponse("No se puede eliminar el proveedor porque tiene compras asociadas", 400);
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from("suppliers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id);

    if (deleteError) {
      console.error("[DELETE /api/suppliers/:id] Error al eliminar proveedor:", deleteError);
      return errorResponse("Error al eliminar proveedor", 500, deleteError.message, deleteError.code);
    }

    return jsonResponse({ message: "Proveedor eliminado correctamente" });
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/suppliers/:id");
  }
}
