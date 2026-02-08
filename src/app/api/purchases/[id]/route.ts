import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { updatePurchaseSchema } from "@/validations/purchase";
import { calculatePurchaseTotals, preparePurchaseItems } from "@/lib/purchase-helpers";
import { z } from "zod";

const uuidSchema = z.string().uuid("El ID debe ser un UUID válido");

// GET /api/purchases/:id - Obtener compra por ID
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
      
      if (defaultStore && defaultStore.id) {
        tenantId = defaultStore.id;
      }
    }

    // SPRINT 3: Obtener compra con nuevos campos
    let query = supabase
      .from("purchases")
      .select(`
        *,
        suppliers (
          id,
          name,
          contact_name,
          email,
          phone
        ),
        purchase_items (
          id,
          product_id,
          variant_id,
          quantity,
          unit_cost,
          subtotal,
          products (
            id,
            name_internal,
            sku,
            cost
          ),
          variants (
            id,
            name,
            value
          )
        )
      `)
      .eq("id", params.id);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: purchase, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return errorResponse("Compra no encontrada", 404);
      }
      console.error("[GET /api/purchases/:id] Error al obtener compra:", error);
      return errorResponse("Error al obtener compra", 500, error.message, error.code);
    }

    return jsonResponse(purchase);
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/purchases/:id");
  }
}

// PUT /api/purchases/:id - SPRINT 3: No se permite modificar compras
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

    // SPRINT 3: No se permite modificar compras una vez creadas
    return errorResponse("No se permite modificar una compra una vez creada", 400);
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/purchases/:id");
  }
}

// DELETE /api/purchases/:id - SPRINT 3: No se permite eliminar compras
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

    // SPRINT 3: No se permite eliminar compras (auditoría obligatoria)
    return errorResponse("No se permite eliminar compras. La auditoría es obligatoria", 400);
  } catch (error) {
    return handleUnexpectedError(error, "DELETE /api/purchases/:id");
  }
}
