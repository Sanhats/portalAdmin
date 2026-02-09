/**
 * SPRINT 13: Endpoint para configuración de stock por producto y sucursal
 * PATCH /api/stock/:productId/config - Actualizar configuración de stock
 */

import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { updateStockConfig } from "@/lib/stock-alerts-helpers-sprint13";
import { z } from "zod";

const updateStockConfigSchema = z.object({
  branchId: z.string().uuid("El branchId debe ser un UUID válido"),
  minStock: z.number().int().nonnegative().nullable().optional(),
  idealStock: z.number().int().nonnegative().nullable().optional(),
  reorderEnabled: z.boolean().optional(),
});

// PATCH /api/stock/:productId/config - Actualizar configuración de stock
export async function PATCH(
  req: Request,
  { params }: { params: { productId: string } }
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

    const body = await req.json();
    const parsed = updateStockConfigSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    // Actualizar configuración
    const result = await updateStockConfig(
      tenantId,
      parsed.data.branchId,
      params.productId,
      {
        minStock: parsed.data.minStock,
        idealStock: parsed.data.idealStock,
        reorderEnabled: parsed.data.reorderEnabled ?? false,
      }
    );

    if (!result.success) {
      return errorResponse(result.error || "Error al actualizar configuración", 400);
    }

    return jsonResponse(result.config);
  } catch (error) {
    return handleUnexpectedError(error, "PATCH /api/stock/:productId/config");
  }
}
