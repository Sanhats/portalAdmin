import { supabase } from "@/lib/supabase";
import { createProductSprint1Schema } from "@/validations/product-sprint1";
import { jsonResponse, errorResponse, handleUnexpectedError } from "@/lib/api-response";

interface BulkImportResult {
  created: number;
  failed: number;
  errors: Array<{
    row: number;
    reason: string;
    sku?: string;
  }>;
}

interface CSVRow {
  [key: string]: string;
}

/**
 * Parsea un archivo CSV simple
 * Maneja valores entre comillas y comas dentro de valores
 */
function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  // Función para parsear una línea CSV respetando comillas
  function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Comilla escapada
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quotes
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Fin del campo
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Agregar último campo
    values.push(current.trim());
    return values;
  }

  // Primera línea son los headers
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
    if (values.length === 0 || values.every(v => !v)) continue; // Skip empty rows
    
    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

/**
 * Convierte una fila CSV a objeto para validación
 */
function csvRowToProduct(row: CSVRow, rowNumber: number): { data: any; error: string | null } {
  try {
    // Mapear columnas CSV a campos del schema
    const productData: any = {};
    
    // Campos requeridos
    if (!row.sku) {
      return { data: null, error: 'sku missing' };
    }
    productData.sku = row.sku.trim();
    
    if (!row.nameInternal && !row['name_internal']) {
      return { data: null, error: 'nameInternal missing' };
    }
    productData.nameInternal = (row.nameInternal || row['name_internal'] || '').trim();
    
    if (!row.price) {
      return { data: null, error: 'price missing' };
    }
    productData.price = row.price.trim();
    
    // Campos opcionales
    if (row.stock) {
      const stock = parseInt(row.stock.trim());
      if (isNaN(stock)) {
        return { data: null, error: 'stock must be a number' };
      }
      productData.stock = stock;
    }
    
    if (row.categoryId || row['category_id']) {
      productData.categoryId = (row.categoryId || row['category_id'] || '').trim() || null;
    }
    
    if (row.description) {
      productData.description = row.description.trim() || null;
    }
    
    if (row.isActive || row['is_active']) {
      productData.isActive = (row.isActive || row['is_active'] || '').trim().toLowerCase() === 'true';
    }
    
    if (row.isVisible || row['is_visible']) {
      productData.isVisible = (row.isVisible || row['is_visible'] || '').trim().toLowerCase() === 'true';
    }
    
    return { data: productData, error: null };
  } catch (error) {
    return { data: null, error: `Error parsing row: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// POST /api/products/bulk - Importación masiva desde CSV
export async function POST(req: Request) {
  try {
    // Verificar Content-Type
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return errorResponse("Content-Type debe ser multipart/form-data", 400);
    }

    // Obtener el FormData
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (error) {
      return errorResponse("Error al parsear FormData. Asegúrate de enviar un archivo CSV válido.", 400);
    }
    
    const file = formData.get("file") as File;

    if (!file) {
      return errorResponse("No se proporcionó ningún archivo CSV", 400);
    }

    // Validar que sea un archivo CSV
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return errorResponse("El archivo debe ser un CSV", 400);
    }

    // Leer contenido del archivo
    const csvContent = await file.text();
    
    if (!csvContent || csvContent.trim().length === 0) {
      return errorResponse("El archivo CSV está vacío", 400);
    }

    // Parsear CSV
    const csvRows = parseCSV(csvContent);
    
    if (csvRows.length === 0) {
      return errorResponse("El CSV no contiene datos válidos", 400);
    }

    console.log(`[POST /api/products/bulk] Procesando ${csvRows.length} filas del CSV`);

    const result: BulkImportResult = {
      created: 0,
      failed: 0,
      errors: [],
    };

    // Procesar cada fila
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const rowNumber = i + 2; // +2 porque la fila 1 son headers y empezamos desde 0
      
      // Convertir fila CSV a objeto
      const { data: productData, error: parseError } = csvRowToProduct(row, rowNumber);
      
      if (parseError || !productData) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          reason: parseError || 'Invalid row data',
          sku: row.sku || 'N/A',
        });
        continue;
      }

      // Validar con schema
      const validation = createProductSprint1Schema.safeParse(productData);
      
      if (!validation.success) {
        result.failed++;
        const firstError = validation.error.errors[0];
        result.errors.push({
          row: rowNumber,
          reason: `${firstError.path.join('.')}: ${firstError.message}`,
          sku: productData.sku || 'N/A',
        });
        continue;
      }

      // Intentar crear el producto
      try {
        const productToInsert: any = {
          sku: validation.data.sku,
          name_internal: validation.data.nameInternal,
          price: typeof validation.data.price === "number" 
            ? validation.data.price.toString() 
            : validation.data.price,
          stock: validation.data.stock ?? 0,
          category_id: validation.data.categoryId || null,
          description: validation.data.description || null,
          is_active: validation.data.isActive ?? true,
          is_visible: validation.data.isVisible ?? false,
        };

        const { error: insertError } = await supabase
          .from("products")
          .insert(productToInsert);

        if (insertError) {
          result.failed++;
          // Manejar error de SKU duplicado
          if (insertError.code === '23505') {
            result.errors.push({
              row: rowNumber,
              reason: 'SKU already exists',
              sku: productData.sku,
            });
          } else {
            result.errors.push({
              row: rowNumber,
              reason: insertError.message || 'Database error',
              sku: productData.sku,
            });
          }
        } else {
          result.created++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          reason: error instanceof Error ? error.message : 'Unknown error',
          sku: productData.sku || 'N/A',
        });
      }
    }

    console.log(`[POST /api/products/bulk] Resultado: ${result.created} creados, ${result.failed} fallidos`);

    return jsonResponse(result, 200);
  } catch (error) {
    return handleUnexpectedError(error, "POST /api/products/bulk");
  }
}

