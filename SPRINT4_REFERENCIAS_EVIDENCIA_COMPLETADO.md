# ✅ SPRINT 4 — REFERENCIAS Y EVIDENCIA DE PAGO - COMPLETADO

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo

Proporcionar trazabilidad sin burocracia mediante referencias y evidencia de pago opcionales.

---

## ✅ Tareas Implementadas

### 1. **Campos Opcionales Disponibles**

#### ✅ **Campo `reference`**
- ✅ Ya disponible en el esquema `createPaymentSchema`
- ✅ Tipo: `string | null`
- ✅ Máximo: 255 caracteres
- ✅ Opcional al crear pago

#### ✅ **Campo `metadata.comprobante_url`**
- ✅ Disponible en el esquema `createPaymentSchema` (campo `metadata`)
- ✅ Disponible en el esquema `confirmPaymentSchema` (campo `metadata` o `comprobante_url` directo)
- ✅ Tipo: `string (URL) | null`
- ✅ Opcional al crear o confirmar pago

---

### 2. **Upload de Evidencia (Opcional)**

#### ✅ **Endpoint POST /api/payments/evidence**

**Descripción:** Sube evidencia de pago (imagen o PDF) a Supabase Storage

**Request:**
- **Content-Type:** `multipart/form-data`
- **Body:** FormData con:
  - `file` (requerido): Archivo a subir (imagen o PDF)
  - `paymentId` (opcional): ID del pago para organizar archivos

**Validaciones:**
- ✅ Tipo de archivo: Imágenes (JPEG, PNG, WebP, GIF) o PDFs
- ✅ Tamaño máximo: 10MB
- ✅ Genera nombre único automáticamente
- ✅ Organiza archivos en carpeta `payment-evidence`

**Response 201:**
```json
{
  "success": true,
  "file": {
    "id": "payment-evidence/payment-uuid-1234567890-abc123.jpg",
    "fileName": "payment-uuid-1234567890-abc123.jpg",
    "filePath": "payment-evidence/payment-uuid-1234567890-abc123.jpg",
    "url": "https://[project].supabase.co/storage/v1/object/public/product-images/payment-evidence/payment-uuid-1234567890-abc123.jpg",
    "size": 123456,
    "type": "image/jpeg"
  },
  "comprobante_url": "https://[project].supabase.co/storage/v1/object/public/product-images/payment-evidence/payment-uuid-1234567890-abc123.jpg"
}
```

**Errores:**
- `400`: Archivo no proporcionado, tipo no permitido, o tamaño excedido
- `401`: No autorizado
- `404`: Pago no encontrado (si se proporciona paymentId)
- `500`: Error del servidor

---

### 3. **Funciones Helper Creadas**

#### ✅ **`uploadPaymentEvidence()`**

```typescript
// src/lib/upload.ts

/**
 * SPRINT 4: Sube evidencia de pago (imagen o PDF) a Supabase Storage
 * @param file - Archivo a subir (imagen o PDF)
 * @param paymentId - ID del pago (opcional, para organizar archivos)
 * @returns Resultado de la subida con URL pública
 */
uploadPaymentEvidence(
  file: File,
  paymentId?: string
): Promise<UploadResult>
```

**Características:**
- ✅ Acepta imágenes (JPEG, PNG, WebP, GIF) y PDFs
- ✅ Tamaño máximo: 10MB
- ✅ Genera nombres únicos con timestamp y random string
- ✅ Organiza archivos en carpeta `payment-evidence`
- ✅ Si se proporciona `paymentId`, incluye el ID en el nombre del archivo
- ✅ Retorna URL pública del archivo

---

### 4. **Validaciones Actualizadas**

#### ✅ **Esquema `evidenceFileTypeSchema`**

```typescript
// src/validations/upload.ts

export const evidenceFileTypeSchema = z.enum([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);
```

#### ✅ **Esquema `evidenceFileSizeSchema`**

```typescript
// src/validations/upload.ts

const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const evidenceFileSizeSchema = z.number().max(MAX_EVIDENCE_FILE_SIZE, {
  message: `El archivo no puede ser mayor a ${MAX_EVIDENCE_FILE_SIZE / 1024 / 1024}MB`,
});
```

#### ✅ **Esquema `confirmPaymentSchema` Actualizado**

```typescript
// src/validations/payment.ts

export const confirmPaymentSchema = z.object({
  // SPRINT 4: Opcional: metadata adicional al confirmar (puede incluir comprobante_url)
  metadata: z.record(z.any()).optional().nullable(),
  // SPRINT 4: Campo directo para comprobante_url (conveniencia)
  comprobante_url: z.string().url("La URL del comprobante debe ser válida").optional().nullable(),
  // ... otros campos
});
```

---

### 5. **Integración con Endpoints de Pagos**

#### ✅ **POST /api/sales/:id/payments**

**Uso de `reference` y `metadata.comprobante_url`:**

```json
{
  "amount": 1000,
  "method": "transfer",
  "reference": "TRX-12345",
  "metadata": {
    "comprobante_url": "https://...",
    "otro_campo": "valor"
  }
}
```

#### ✅ **PATCH /api/payments/:id/confirm**

**Uso de `comprobante_url`:**

```json
{
  "comprobante_url": "https://...",
  "metadata": {
    "notas": "Pago confirmado con evidencia"
  }
}
```

**O usando `metadata` directamente:**

```json
{
  "metadata": {
    "comprobante_url": "https://...",
    "notas": "Pago confirmado con evidencia"
  }
}
```

---

## 🔧 Archivos Creados/Modificados

### **Archivos Creados:**
- ✅ `src/app/api/payments/evidence/route.ts` - Endpoint para subir evidencia de pago

### **Archivos Modificados:**
- ✅ `src/validations/upload.ts` - Agregado validaciones para evidencia (imágenes y PDFs)
- ✅ `src/lib/upload.ts` - Agregado función `uploadPaymentEvidence()`
- ✅ `src/validations/payment.ts` - Agregado campo `comprobante_url` en `confirmPaymentSchema`
- ✅ `src/app/api/payments/[id]/confirm/route.ts` - Actualizado para manejar `comprobante_url`

---

## ✅ Criterios de Aceptación

### ✅ **Campos Opcionales**
- ✅ Campo `reference` disponible al crear pago
- ✅ Campo `metadata.comprobante_url` disponible al crear y confirmar pago
- ✅ Campo `comprobante_url` directo disponible al confirmar pago (conveniencia)

### ✅ **Upload de Evidencia**
- ✅ Endpoint POST /api/payments/evidence implementado
- ✅ Acepta imágenes (JPEG, PNG, WebP, GIF)
- ✅ Acepta PDFs
- ✅ Tamaño máximo: 10MB
- ✅ Retorna URL pública del archivo
- ✅ Organiza archivos en carpeta `payment-evidence`

---

## 📊 Flujo de Uso

### **Flujo 1: Crear Pago con Referencia**

```
1. POST /api/sales/:id/payments
   Body: {
     "amount": 1000,
     "method": "transfer",
     "reference": "TRX-12345"
   }
   → ✅ Pago creado con referencia
```

### **Flujo 2: Subir Evidencia y Confirmar Pago**

```
1. POST /api/payments/evidence
   FormData: {
     file: [archivo imagen o PDF],
     paymentId: "uuid-del-pago" (opcional)
   }
   → ✅ Retorna: { comprobante_url: "https://..." }

2. PATCH /api/payments/:id/confirm
   Body: {
     "comprobante_url": "https://...",
     "metadata": {
       "notas": "Pago confirmado"
     }
   }
   → ✅ Pago confirmado con evidencia
```

### **Flujo 3: Crear Pago con Evidencia Directa**

```
1. POST /api/payments/evidence
   FormData: { file: [archivo] }
   → ✅ Retorna: { comprobante_url: "https://..." }

2. POST /api/sales/:id/payments
   Body: {
     "amount": 1000,
     "method": "transfer",
     "reference": "TRX-12345",
     "metadata": {
       "comprobante_url": "https://..."
     }
   }
   → ✅ Pago creado con evidencia
```

---

## 📝 Ejemplos de Uso

### **Ejemplo 1: Crear Pago con Referencia**

```typescript
const response = await fetch('/api/sales/sale-id/payments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 1000,
    method: 'transfer',
    reference: 'TRX-12345'
  })
});
```

### **Ejemplo 2: Subir Evidencia**

```typescript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('paymentId', 'payment-uuid'); // opcional

const response = await fetch('/api/payments/evidence', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();
const comprobanteUrl = data.comprobante_url;
```

### **Ejemplo 3: Confirmar Pago con Evidencia**

```typescript
const response = await fetch('/api/payments/payment-id/confirm', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    comprobante_url: comprobanteUrl,
    metadata: {
      notas: 'Pago confirmado con comprobante'
    }
  })
});
```

---

## 🎯 Tipos de Archivo Soportados

### **Imágenes:**
- ✅ JPEG (`image/jpeg`, `image/jpg`)
- ✅ PNG (`image/png`)
- ✅ WebP (`image/webp`)
- ✅ GIF (`image/gif`)

### **Documentos:**
- ✅ PDF (`application/pdf`)

---

## 📦 Organización de Archivos

Los archivos de evidencia se organizan en Supabase Storage:

```
product-images/
  └── payment-evidence/
      ├── payment-uuid-1234567890-abc123.jpg
      ├── payment-uuid-1234567890-def456.pdf
      └── evidence-1234567890-ghi789.png (sin paymentId)
```

**Nota:** Si se proporciona `paymentId`, el nombre del archivo incluye el ID del pago para facilitar la organización.

---

## 🔒 Seguridad

- ✅ Autenticación requerida (Token Bearer)
- ✅ Validación de tipo de archivo
- ✅ Validación de tamaño de archivo
- ✅ Validación de paymentId si se proporciona
- ✅ Nombres de archivo únicos (previene sobrescritura)

---

## 📝 Notas Técnicas

### **Bucket de Storage**
- Se usa el mismo bucket `product-images` existente
- Los archivos se organizan en la carpeta `payment-evidence`
- Se puede crear un bucket separado `payment-evidence` en el futuro si es necesario

### **Tamaño Máximo**
- Imágenes de productos: 5MB
- Evidencia de pago: 10MB (para incluir PDFs)

### **URLs Públicas**
- Las URLs son públicas y accesibles sin autenticación
- Se pueden usar directamente en `metadata.comprobante_url`
- Se pueden usar en `proofFileUrl` (backward compatibility)

---

**Estado Final:** ✅ **COMPLETADO Y LISTO PARA PRUEBAS**

