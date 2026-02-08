/**
 * SPRINT 12: Endpoints para gestión de sucursales individuales
 * GET /api/branches/:id - Obtener sucursal
 * PATCH /api/branches/:id - Actualizar sucursal
 * DELETE /api/branches/:id - Desactivar sucursal (soft delete)
 */

import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { z } from "zod";

const updateBranchSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  active: z.boolean().optional(),
});

// GET /api/branches/:id - Obtener sucursal
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

    // Obtener sucursal
    const { data: branch, error } = await supabase
      .from("branches")
      .select("*")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return errorResponse("Sucursal no encontrada", 404);
      }
      console.error("[GET /api/branches/:id] Error:", error);
      return errorResponse("Error al obtener sucursal", 500, error.message);
    }

    if (!branch) {
      return errorResponse("Sucursal no encontrada", 404);
    }

    return jsonResponse(branch);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/branches/:id");
  }
}

// PATCH /api/branches/:id - Actualizar sucursal
export async function PATCH(
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
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Validar datos
    const parsed = updateBranchSchema.safeParse(body);
    
    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Verificar que la sucursal existe y pertenece al tenant
    const { data: existingBranch, error: fetchError } = await supabase
      .from("branches")
      .select("id, tenant_id, active")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError || !existingBranch) {
      return errorResponse("Sucursal no encontrada", 404);
    }

    // SPRINT 12: Validar que no se desactive la última sucursal activa
    if (parsed.data.active === false && existingBranch.active === true) {
      const { data: activeBranches, error: countError } = await supabase
        .from("branches")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .neq("id", params.id);

      if (countError) {
        console.error("[PATCH /api/branches/:id] Error al contar sucursales:", countError);
      } else {
        const activeCount = activeBranches?.length || 0;
        if (activeCount === 0) {
          return errorResponse("No se puede desactivar la última sucursal activa del tenant", 400);
        }
      }
    }

    // Actualizar sucursal
    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.address !== undefined) updateData.address = parsed.data.address;
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

    const { data: branch, error: updateError } = await supabase
      .from("branches")
      .update(updateData)
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (updateError || !branch) {
      console.error("[PATCH /api/branches/:id] Error:", updateError);
      return errorResponse("Error al actualizar sucursal", 500, updateError?.message);
    }

    return jsonResponse(branch);
  } catch (error) {
    return handleUnexpectedError(error, "PATCH /api/branches/:id");
  }
}

// DELETE /api/branches/:id - Desactivar sucursal (soft delete)
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

    // Verificar que la sucursal existe y pertenece al tenant
    const { data: existingBranch, error: fetchError } = await supabase
      .from("branches")
      .select("id, tenant_id, active")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError || !existingBranch) {
      return errorResponse("Sucursal no encontrada", 404);
    }

    // SPRINT 12: Validar que no se desactive la última sucursal activa
    if (existingBranch.active) {
      const { data: activeBranches, error: countError } = await supabase
        .from("branches")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .neq("id", params.id);

      if (countError) {
        console.error("[DELETE /api/branches/:id] Error al contar sucursales:", countError);
      } else {
        const activeCount = activeBranches?.length || 0;
        if (activeCount === 0) {
          return errorResponse("No se puede desactivar la última sucursal activa del tenant", 400);
        }
      }
    }

    // Desactivar sucursal (soft delete)
    const { data: branch, error: updateError } = await supabase
      .from("branches")
      .update({ active: false })
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (updateError || !branch) {
      console.error("[DELETE /api/branches/:id] Error:", updateError);
      return errorResponse("Error al desactivar sucursal", 500, updateError?.message);
    }

    return jsonResponse({ message: "Sucursal desactivada correctamente", branch });
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/branches/:id");
  }
}
