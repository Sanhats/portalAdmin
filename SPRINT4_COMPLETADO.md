# ✅ SPRINT 4 — Importación Masiva (Bulk / CSV) - COMPLETADO

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo

Crear muchos productos de una sola vez mediante importación desde archivo CSV.

---

## ✅ Implementación

### 1. **Endpoint: POST /api/products/bulk**

**Ruta:** `POST /api/products/bulk`

**Content-Type:** `multipart/form-data`

**Body:**
- `file`: Archivo CSV (requerido)

### 2. **Formato CSV Esperado**

El CSV debe tener las siguientes columnas (headers en la primera fila):

#### Columnas Requeridas:
- `sku`: Código SKU único del producto
- `nameInternal` o `name_internal`: Nombre interno del producto
- `price`: Precio del producto (número)

#### Columnas Opcionales:
- `stock`: Stock inicial (número entero, default: 0)
- `categoryId` o `category_id`: UUID de la categoría
- `description`: Descripción del producto
- `isActive` o `is_active`: Si el producto está activo (true/false, default: true)
- `isVisible` o `is_visible`: Si el producto es visible (true/false, default: false)

### 3. **Ejemplo de CSV**

```csv
sku,nameInternal,price,stock,description,isActive,isVisible
PROD-001,Producto 1,15000,50,Descripción del producto 1,true,false
PROD-002,Producto 2,20000,30,Descripción del producto 2,true,true
PROD-003,Producto 3,12000,25,,true,false
```

### 4. **Respuesta del Endpoint**

#### Éxito (200):
```json
{
  "created": 120,
  "failed": 5,
  "errors": [
    {
      "row": 14,
      "reason": "price missing",
      "sku": "PROD-014"
    },
    {
      "row": 25,
      "reason": "SKU already exists",
      "sku": "PROD-001"
    },
    {
      "row": 30,
      "reason": "sku: El SKU debe contener solo letras mayúsculas, números, guiones y guiones bajos",
      "sku": "prod-030"
    }
  ]
}
```

#### Errores:
- `400`: Archivo no proporcionado, no es CSV, o CSV vacío
- `500`: Error del servidor

---

## 🔒 Reglas Implementadas

### **Validación Fila por Fila**

- ✅ Cada fila se valida independientemente
- ✅ Errores en una fila no detienen el proceso
- ✅ Se reportan todos los errores encontrados

### **Guardado de Productos Válidos**

- ✅ Solo se guardan productos que pasan la validación
- ✅ Se usa el schema del SPRINT 2 (carga rápida)
- ✅ Valores por defecto aplicados automáticamente

### **Reporte de Errores**

- ✅ Número de fila del error (incluyendo header)
- ✅ Razón del error
- ✅ SKU del producto (si está disponible)
- ✅ Errores agrupados en array

### **Idempotencia**

- ✅ SKU duplicado detectado y reportado como error
- ✅ No se crean productos duplicados
- ✅ El proceso continúa con las siguientes filas

---

## 📝 Ejemplo de Uso

### Crear archivo CSV:

```csv
sku,nameInternal,price,stock,description,isActive,isVisible
ABC-001,Remera Negra M,12000,50,Remera de algodón negra talla M,true,false
ABC-002,Remera Roja M,12000,30,Remera de algodón roja talla M,true,false
ABC-003,Remera Azul M,12000,25,Remera de algodón azul talla M,true,true
```

### Importar desde PowerShell:

```powershell
$filePath = "C:\ruta\a\productos.csv"
$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = (
  "--$boundary",
  "Content-Disposition: form-data; name=`"file`"; filename=`"productos.csv`"",
  "Content-Type: text/csv",
  "",
  [System.Text.Encoding]::UTF8.GetString($fileBytes),
  "--$boundary--"
) -join $LF

$headers = @{
  "Content-Type" = "multipart/form-data; boundary=$boundary"
}

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/products/bulk" `
  -Method POST `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($bodyLines)) `
  -Headers $headers

Write-Host "Creados: $($response.created)"
Write-Host "Fallidos: $($response.failed)"
if ($response.errors.Count -gt 0) {
    Write-Host "Errores:"
    $response.errors | ForEach-Object {
        Write-Host "  Fila $($_.row): $($_.reason) (SKU: $($_.sku))"
    }
}
```

---

## ✅ Criterio de Éxito

- ✅ **Importación segura**
  - Validación fila por fila
  - Errores no detienen el proceso
  - Solo se guardan productos válidos

- ✅ **Errores trazables**
  - Número de fila reportado
  - Razón del error clara
  - SKU identificado cuando es posible

- ✅ **Idempotente**
  - SKU duplicado detectado
  - No se crean duplicados
  - Proceso predecible

---

## 🔍 Manejo de Errores

### Tipos de Errores Reportados:

1. **Campos faltantes:**
   - `"price missing"`
   - `"nameInternal missing"`
   - `"sku missing"`

2. **Validación de schema:**
   - `"sku: El SKU debe contener solo letras mayúsculas..."`
   - `"price: El precio debe ser un número válido"`

3. **Errores de base de datos:**
   - `"SKU already exists"` (código 23505)
   - `"Database error"` (otros errores)

4. **Errores de parsing:**
   - `"stock must be a number"`
   - `"Error parsing row: ..."`

---

## 📁 Archivos Creados

1. ✅ `src/app/api/products/bulk/route.ts` - Endpoint de importación masiva (NUEVO)

---

## 🚀 Próximos Pasos

1. **Probar el endpoint:**
   - Crear un archivo CSV de ejemplo
   - Importar productos
   - Verificar resultados

2. **Mejoras futuras (opcionales):**
   - Soporte para importación en modo SPRINT 3 (estructura completa)
   - Validación de categorías antes de importar
   - Procesamiento en lotes para mejor performance
   - Soporte para actualización de productos existentes

---

## 🎉 Estado Final

**SPRINT 4 COMPLETADO** ✅

El endpoint `POST /api/products/bulk` permite:
- ✅ Importar múltiples productos desde CSV
- ✅ Validación fila por fila
- ✅ Reporte detallado de errores
- ✅ Importación segura e idempotente

