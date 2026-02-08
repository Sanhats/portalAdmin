/**
 * SPRINT 7: Helper para exportación a Excel
 * READ-ONLY: Solo genera archivos, no modifica datos
 */

export interface ExcelColumn {
  key: string;
  header: string;
  width?: number;
}

/**
 * Exporta datos a Excel (formato CSV como fallback si no hay librería)
 * Nota: Requiere instalar 'xlsx': npm install xlsx
 */
export async function exportToExcel(
  data: any[],
  columns: ExcelColumn[],
  filename: string = "report"
): Promise<{ buffer: Buffer | Uint8Array; filename: string; contentType: string }> {
  try {
    // Intentar usar xlsx si está disponible
    const xlsx = await import("xlsx").catch(() => null);

    if (xlsx) {
      // Crear workbook
      const workbook = xlsx.utils.book_new();

      // Preparar datos para Excel
      const excelData = data.map((row) => {
        const excelRow: any = {};
        for (const col of columns) {
          excelRow[col.header] = row[col.key] ?? "";
        }
        return excelRow;
      });

      // Crear worksheet
      const worksheet = xlsx.utils.json_to_sheet(excelData);

      // Ajustar ancho de columnas
      const colWidths = columns.map((col) => ({
        wch: col.width || 15,
      }));
      worksheet["!cols"] = colWidths;

      // Agregar worksheet al workbook
      xlsx.utils.book_append_sheet(workbook, worksheet, "Reporte");

      // Generar buffer
      const buffer = xlsx.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      return {
        buffer: Buffer.from(buffer) as any,
        filename: `${filename}.xlsx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    } else {
      // Fallback: CSV si no hay xlsx
      const headers = columns.map((col) => col.header).join(",");
      const rows = data.map((row) => {
        return columns
          .map((col) => {
            const value = row[col.key] ?? "";
            // Escapar comas y comillas en CSV
            if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(",");
      });

      const csv = [headers, ...rows].join("\n");
      const buffer = Buffer.from(csv, "utf-8");

      return {
        buffer: buffer as any,
        filename: `${filename}.csv`,
        contentType: "text/csv",
      };
    }
  } catch (error: any) {
    throw new Error(`Error al exportar a Excel: ${error.message}`);
  }
}

/**
 * Convierte datos anidados a formato plano para Excel
 */
export function flattenDataForExcel(data: any[]): any[] {
  return data.map((item) => {
    const flattened: any = { ...item };

    // Aplanar objetos anidados
    for (const key in item) {
      if (typeof item[key] === "object" && item[key] !== null && !Array.isArray(item[key])) {
        const nested = item[key];
        for (const nestedKey in nested) {
          flattened[`${key}_${nestedKey}`] = nested[nestedKey];
        }
        delete flattened[key];
      }
    }

    return flattened;
  });
}
