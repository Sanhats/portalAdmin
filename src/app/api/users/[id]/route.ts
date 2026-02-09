/**
 * Endpoints para gestionar un vendedor específico (alias de /api/sellers/:id)
 * GET /api/users/:id - Obtener vendedor
 * PUT /api/users/:id - Actualizar vendedor
 * DELETE /api/users/:id - Eliminar vendedor
 */

import { supabase } from "@/lib/supabase";
import { updateSellerSchema } from "@/validations/seller";
import { z } from "zod";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// GET /api/users/:id - Obtener vendedor
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }

    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      return errorResponse("No autorizado. Token Bearer requerido", 401);
    }
    
    const user = await validateBearerToken(token);
    if (!user) {
      return errorResponse("No autorizado. Token inválido o expirado", 401);
    }

    const { data, error } = await supabase
      .from("sellers")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return errorResponse("Vendedor no encontrado", 404);
      }
      console.error("[GET /api/users/:id] Error:", error);
      return errorResponse("Error al obtener vendedor", 500, error.message, error.code);
    }

    return jsonResponse(data);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/users/:id");
  }
}

// PUT /api/users/:id - Actualizar vendedor
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }

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
    const parsed = updateSellerSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Verificar que el vendedor existe
    const { data: existing, error: checkError } = await supabase
      .from("sellers")
      .select("id")
      .eq("id", params.id)
      .single();

    if (checkError || !existing) {
      return errorResponse("Vendedor no encontrado", 404);
    }

    const { data, error } = await supabase
      .from("sellers")
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("[PUT /api/users/:id] Error:", error);
      return errorResponse("Error al actualizar vendedor", 500, error.message, error.code);
    }

    return jsonResponse(data);
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/users/:id");
  }
}

// DELETE /api/users/:id - Eliminar vendedor
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const uuidValidation = uuidSchema.safeParse(params.id);
    if (!uuidValidation.success) {
      return errorResponse("ID inválido", 400, uuidValidation.error.errors);
    }

    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      return errorResponse("No autorizado. Token Bearer requerido", 401);
    }
    
    const user = await validateBearerToken(token);
    if (!user) {
      return errorResponse("No autorizado. Token inválido o expirado", 401);
    }

    // Verificar que el vendedor existe
    const { data: existing, error: checkError } = await supabase
      .from("sellers")
      .select("id")
      .eq("id", params.id)
      .single();

    if (checkError || !existing) {
      return errorResponse("Vendedor no encontrado", 404);
    }

    // Verificar que no tenga caja abierta
    const { data: openSession } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("seller_id", params.id)
      .eq("status", "open")
      .single();

    if (openSession) {
      return errorResponse("No se puede eliminar un vendedor con caja abierta", 400);
    }

    const { error } = await supabase
      .from("sellers")
      .delete()
      .eq("id", params.id);

    if (error) {
      console.error("[DELETE /api/users/:id] Error:", error);
      return errorResponse("Error al eliminar vendedor", 500, error.message, error.code);
    }

    return jsonResponse({ message: "Vendedor eliminado correctamente" });
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/users/:id");
  }
}
