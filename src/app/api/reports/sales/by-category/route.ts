import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getSalesByCategory } from "@/lib/report-helpers-sprint7";
import { exportToExcel } from "@/lib/excel-export-sprint7";

// GET /api/reports/sales/by-category - Ventas por Rubro
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

    // Obtener ventas por categoría
    const categories = await getSalesByCategory(filters);

    // Exportar a Excel si se solicita
    if (exportExcel) {
      const excelData = categories.map((c) => ({
        "Rubro": c.categoryName,
        "Total Vendido": c.totalAmount,
        "Cantidad de Productos": c.productCount,
        "Participación %": c.percentage,
      }));

      const columns = [
        { key: "Rubro", header: "Rubro", width: 30 },
        { key: "Total Vendido", header: "Total Vendido", width: 15 },
        { key: "Cantidad de Productos", header: "Cantidad de Productos", width: 20 },
        { key: "Participación %", header: "Participación %", width: 15 },
      ];

      const excel = await exportToExcel(excelData, columns, "ventas-por-rubro");

      return new Response(excel.buffer as any, {
        headers: {
          "Content-Type": excel.contentType,
          "Content-Disposition": `attachment; filename="${excel.filename}"`,
        },
      });
    }

    return jsonResponse({
      categories,
      total: categories.length,
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/reports/sales/by-category");
  }
}
