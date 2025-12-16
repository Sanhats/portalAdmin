import { supabase } from "@/lib/supabase";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { z } from "zod";

// Esquema de validación para el orden manual de productos
const productOrderSchema = z.object({
  products: z.array(
    z.object({
      id: z.string().uuid("El id del producto debe ser un UUID válido"),
      position: z.number().int("position debe ser un número entero").min(1, "position debe ser mayor o igual a 1"),
    })
  ).nonempty("Debe enviar al menos un producto para actualizar el orden"),
});

// PUT /api/products/order - Actualizar el orden (position) de múltiples productos
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const parsed = productOrderSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[PUT /api/products/order] Error de validación:", parsed.error.errors);
      return errorResponse("Datos inválidos", 400, parsed.error.errors);
    }

    const { products } = parsed.data;

    // Validar que no haya posiciones duplicadas en el payload
    const positions = new Set<number>();
    for (const item of products) {
      if (positions.has(item.position)) {
        return errorResponse(
          "Las posiciones deben ser únicas",
          400,
          `La posición ${item.position} está duplicada en la lista de productos`
        );
      }
      positions.add(item.position);
    }

    // Actualizar cada producto individualmente
    for (const { id, position } of products) {
      // Verificar que el producto existe y no está eliminado antes de actualizar
      const { data: existingProduct, error: checkError } = await supabase
        .from("products")
        .select("id")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (checkError || !existingProduct) {
        console.error("[PUT /api/products/order] Producto no encontrado o eliminado:", { id, error: checkError });
        return errorResponse(
          `Producto con ID ${id} no encontrado o está eliminado`,
          404
        );
      }

      const { error } = await supabase
        .from("products")
        .update({ position })
        .eq("id", id)
        .is("deleted_at", null); // Solo actualizar si no está eliminado

      if (error) {
        console.error("[PUT /api/products/order] Error al actualizar posición:", { id, position, error });
        return errorResponse(
          `Error al actualizar la posición del producto ${id}`,
          500,
          error.message,
          error.code
        );
      }
    }

    console.log("[PUT /api/products/order] Orden de productos actualizado correctamente");

    return jsonResponse(
      {
        success: true,
      },
      200
    );
  } catch (error) {
    return handleUnexpectedError(error, "PUT /api/products/order");
  }
}


