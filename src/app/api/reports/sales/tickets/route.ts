import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";
import { extractBearerToken, validateBearerToken } from "@/lib/auth";
import { getSalesTickets } from "@/lib/report-helpers-sprint7";
import { exportToExcel, flattenDataForExcel } from "@/lib/excel-export-sprint7";

// GET /api/reports/sales/tickets - Ticket por Ticket
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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

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

    // Obtener tickets
    const allTickets = await getSalesTickets(filters);

    // Exportar a Excel si se solicita
    if (exportExcel) {
      // Aplanar datos para Excel
      const flattenedTickets = flattenDataForExcel(allTickets);
      
      // Preparar columnas principales
      const excelData = flattenedTickets.map((ticket: any) => ({
        "ID Venta": ticket.id,
        "Fecha": ticket.date,
        "Cliente": ticket.customers_name || "Mostrador",
        "Vendedor": ticket.sellers_name || "Sin vendedor",
        "Subtotal": ticket.subtotal,
        "Descuento": ticket.discount_amount,
        "Total": ticket.total,
        "Estado": ticket.status,
      }));

      const columns = [
        { key: "ID Venta", header: "ID Venta", width: 40 },
        { key: "Fecha", header: "Fecha", width: 20 },
        { key: "Cliente", header: "Cliente", width: 30 },
        { key: "Vendedor", header: "Vendedor", width: 30 },
        { key: "Subtotal", header: "Subtotal", width: 15 },
        { key: "Descuento", header: "Descuento", width: 15 },
        { key: "Total", header: "Total", width: 15 },
        { key: "Estado", header: "Estado", width: 15 },
      ];

      const excel = await exportToExcel(excelData, columns, "tickets");

      return new Response(excel.buffer as any, {
        headers: {
          "Content-Type": excel.contentType,
          "Content-Disposition": `attachment; filename="${excel.filename}"`,
        },
      });
    }

    // Paginación para JSON
    const paginatedTickets = allTickets.slice(offset, offset + limit);

    return jsonResponse({
      tickets: paginatedTickets,
      pagination: {
        page,
        limit,
        total: allTickets.length,
        totalPages: Math.ceil(allTickets.length / limit),
      },
    });
  } catch (error) {
    return handleUnexpectedError(error, "GET /api/reports/sales/tickets");
  }
}
