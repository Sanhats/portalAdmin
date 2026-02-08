import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getSalesByVendor } from "@/lib/report-helpers-sprint7";
import { exportToExcel } from "@/lib/excel-export-sprint7";
import { supabase } from "@/lib/supabase";

// GET /api/reports/sales/by-vendor - Ventas por Vendedor
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
    const tenantId = searchParams.get("tenantId") || req.headers.get("x-tenant-id");
    const exportExcel = searchParams.get("export") === "excel";

    if (!tenantId) {
      return errorResponse("tenantId es requerido", 400);
    }

    // Filtros
    const filters = {
      tenantId,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      sellerId: searchParams.get("sellerId") || undefined,
      customerId: searchParams.get("customerId") || undefined,
    };

    // Obtener ventas por vendedor
    const vendors = await getSalesByVendor(filters);

    // Exportar a Excel si se solicita
    if (exportExcel) {
      const excelData = vendors.map((v) => ({
        "Vendedor": v.sellerName,
        "Total Vendido": v.totalAmount,
        "Total Cobrado": v.totalPaid,
        "Diferencia": v.difference,
        "Cantidad de Tickets": v.ticketCount,
      }));

      const columns = [
        { key: "Vendedor", header: "Vendedor", width: 30 },
        { key: "Total Vendido", header: "Total Vendido", width: 15 },
        { key: "Total Cobrado", header: "Total Cobrado", width: 15 },
        { key: "Diferencia", header: "Diferencia", width: 15 },
        { key: "Cantidad de Tickets", header: "Cantidad de Tickets", width: 20 },
      ];

      const excel = await exportToExcel(excelData, columns, "ventas-por-vendedor");

      return new Response(excel.buffer as any, {
        headers: {
          "Content-Type": excel.contentType,
          "Content-Disposition": `attachment; filename="${excel.filename}"`,
        },
      });
    }

    return jsonResponse({
      vendors,
      total: vendors.length,
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/reports/sales/by-vendor");
  }
}
