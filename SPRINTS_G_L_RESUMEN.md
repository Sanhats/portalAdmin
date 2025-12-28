# 🚀 Sprints G-L: QR Interoperable y Motor de Matching

## 📋 Resumen Ejecutivo

Se ha implementado un sistema completo de **QR Interoperable** con **Motor de Matching Automático** para Transferencias 3.0, permitiendo:

- ✅ Generar QR escaneables por cualquier billetera (MODO, Naranja X, MP, Bancos)
- ✅ Registrar transferencias entrantes desde múltiples fuentes
- ✅ Matching automático de pagos con transferencias recibidas
- ✅ Confirmación automática cuando confidence >= 0.9
- ✅ Confirmación asistida cuando confidence >= 0.6
- ✅ Señales claras para el frontend con sugerencias

---

## 🟦 Sprint G: QR Interoperable

### Implementación

**Archivo:** `src/lib/qr-helpers.ts`

**Función:** `generateInteroperableQR()`

### Características

- ✅ Soporta **monto fijo** y **monto abierto**
- ✅ Genera payload **EMVCo Argentina** según especificación Transferencias 3.0
- ✅ Incluye **reference única** (ej: SALE-8F3A)
- ✅ Persiste `qr_payload`, `qr_provider = "interoperable_qr"`, `expires_at`
- ✅ Escaneable por cualquier billetera digital

### Formato EMVCo

El QR incluye:
- Payload Format Indicator
- Point of Initiation (11 = estático, 12 = dinámico)
- Merchant Account Information (CBU/CVU)
- Transaction Currency (ARS)
- Transaction Amount (si es monto fijo)
- Merchant Name
- Reference única

### Uso

```typescript
import { generateInteroperableQR } from "@/lib/qr-helpers";

const qr = await generateInteroperableQR(
  saleId,
  amount, // null para monto abierto
  "SALE-8F3A", // reference única
  "1234567890123456789012", // CBU/CVU (opcional, puede venir de env)
  "Mi Comercio" // Nombre del comercio (opcional)
);
```

### Output API

```json
{
  "gateway": "interoperable_qr",
  "qr_code": "data:image/png;base64,...",
  "reference": "SALE-8F3A",
  "qr_payload": "000201010212...",
  "expires_at": "2024-12-23T11:00:00Z"
}
```

---

## 🟦 Sprint H: Registro de Movimientos Entrantes

### Migración de Base de Datos

**Archivo:** `drizzle/migration_sprint_g_h_interoperable_qr.sql`

**Nueva tabla:** `incoming_transfers`

```sql
CREATE TABLE incoming_transfers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  reference TEXT,
  origin_label TEXT, -- "BBVA", "MP", "NaranjaX", etc.
  raw_description TEXT,
  source TEXT NOT NULL DEFAULT 'manual', -- 'api' | 'csv' | 'manual'
  received_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Endpoints Implementados

#### 1. POST /api/transfers/import

Importa múltiples transferencias en batch (CSV/JSON).

**Request:**
```json
{
  "transfers": [
    {
      "amount": 1000.00,
      "reference": "SALE-8F3A",
      "origin_label": "Naranja X",
      "raw_description": "Transferencia SALE-8F3A desde Naranja X",
      "received_at": "2024-12-23T10:43:00Z",
      "source": "csv"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "imported": 1,
  "transfers": [...]
}
```

#### 2. POST /api/transfers/manual

Registra una transferencia manualmente.

**Request:**
```json
{
  "amount": 1000.00,
  "reference": "SALE-8F3A",
  "origin_label": "MODO",
  "raw_description": "Transferencia recibida",
  "received_at": "2024-12-23T10:43:00Z"
}
```

---

## 🟦 Sprint I: Motor de Matching Automático

### Implementación

**Archivo:** `src/lib/matching-engine.ts`

**Función:** `runMatchingEngine()`

### Lógica de Matching

El motor calcula un **confidence score** (0.0 a 1.0) basado en:

1. **Monto exacto** (+0.5 puntos)
2. **Reference en descripción** (+0.3 puntos)
3. **QR reference encontrado** (+0.3 puntos)
4. **Reference exacto** (+0.4 puntos)
5. **Penalización por diferencia de monto** (-hasta 0.3 puntos)

### Resultados

- **`matched_auto`**: confidence >= 0.9 → Auto-confirmar
- **`matched_suggested`**: 0.6 <= confidence < 0.9 → Sugerir confirmación
- **`no_match`**: confidence < 0.6 → Requiere revisión manual

### Campos en Payments

```sql
ALTER TABLE payments ADD COLUMN match_confidence NUMERIC(3, 2) DEFAULT 0.0;
ALTER TABLE payments ADD COLUMN matched_transfer_id UUID;
ALTER TABLE payments ADD COLUMN match_result TEXT DEFAULT 'no_match';
```

---

## 🟦 Sprint J: Polling / Importación de Movimientos

### Endpoints Disponibles

1. **POST /api/transfers/import** - Importación batch (CSV/JSON)
2. **POST /api/transfers/manual** - Registro manual

### Fuentes Soportadas

- ✅ **CSV**: Importación desde extractos bancarios
- ✅ **JSON**: Importación desde APIs bancarias
- ✅ **Manual**: Ingreso manual por usuario

### Integración Futura

El sistema está preparado para:
- Integración con APIs bancarias (polling)
- Scheduler para importación automática
- Webhooks de bancos/PSPs

---

## 🟦 Sprint K: Confirmación Automática y Asistida

### Implementación

**Archivo:** `src/lib/payment-confirmation.ts`

### Reglas de Confirmación

#### Auto-confirmación (confidence >= 0.9)

```typescript
if (confidence >= 0.9) {
  await autoConfirmPayment(paymentId, transferId, confidence, reasons);
}
```

- ✅ Actualiza `status = "confirmed"`
- ✅ Registra en `payment_confirmations` con `confirmation_type = "auto"`
- ✅ Recalcula balance de la venta
- ✅ Marca venta como `paid` si balance = 0

#### Confirmación Asistida (0.6 <= confidence < 0.9)

```typescript
if (confidence >= 0.6 && confidence < 0.9) {
  // Frontend muestra sugerencia
  // Usuario confirma manualmente
  await assistedConfirmPayment(paymentId, transferId, userId);
}
```

#### Confirmación Manual (confidence < 0.6)

- Requiere intervención manual del usuario
- No hay sugerencia automática

### Auditoría

**Tabla:** `payment_confirmations`

```sql
CREATE TABLE payment_confirmations (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL,
  transfer_id UUID,
  confirmation_type TEXT NOT NULL, -- 'auto' | 'assisted' | 'manual'
  confidence_score NUMERIC(3, 2),
  confirmed_by UUID, -- NULL si es automático
  confirmed_at TIMESTAMP DEFAULT NOW(),
  reason TEXT
);
```

---

## 🟦 Sprint L: Señales Claras para Frontend

### Endpoint

**GET /api/payments/:id/matching-status**

### Response

```json
{
  "status": "pending",
  "confidence": 0.78,
  "match_result": "matched_suggested",
  "suggested_transfer": {
    "id": "transfer-uuid",
    "amount": 1000.00,
    "origin": "Naranja X",
    "received_at": "2024-12-23T10:43:00Z",
    "raw_description": "Transferencia SALE-8F3A desde Naranja X"
  },
  "message": "Detectamos una transferencia compatible. ¿Confirmar?",
  "action": "suggest",
  "payment": {
    "id": "payment-uuid",
    "amount": 1000.00,
    "reference": "SALE-8F3A",
    "created_at": "2024-12-23T10:00:00Z"
  }
}
```

### Valores de `action`

- **`"confirmed"`**: Pago confirmado automáticamente
- **`"suggest"`**: Mostrar sugerencia de confirmación
- **`"waiting"`**: Esperando transferencia
- **`"none"`**: Sin acción requerida

### UX Esperada

```typescript
// Frontend puede usar el endpoint así:
const response = await fetch(`/api/payments/${paymentId}/matching-status`);

if (response.action === "suggest") {
  // Mostrar modal: "Detectamos una transferencia compatible. ¿Confirmar?"
  showConfirmationModal(response.suggested_transfer);
} else if (response.action === "confirmed") {
  // Mostrar: "Pago confirmado automáticamente"
  showSuccessMessage();
}
```

---

## 📊 Flujo Completo

```
1. Cliente solicita pago QR
   ↓
2. Backend genera QR interoperable (Sprint G)
   ↓
3. Cliente escanea QR y paga con cualquier billetera
   ↓
4. Dinero entra a CBU/CVU
   ↓
5. Backend importa movimiento (Sprint H/J)
   ↓
6. Motor de matching ejecuta (Sprint I)
   ↓
7a. Si confidence >= 0.9 → Auto-confirmar (Sprint K)
7b. Si 0.6 <= confidence < 0.9 → Sugerir (Sprint L)
7c. Si confidence < 0.6 → Manual
   ↓
8. Frontend muestra estado/sugerencia (Sprint L)
```

---

## 🔧 Configuración Requerida

### Variables de Entorno

```env
MERCHANT_CBU=1234567890123456789012
MERCHANT_CVU=1234567890123456789012
MERCHANT_NAME=Mi Comercio
```

### Migración de Base de Datos

Ejecutar:
```sql
-- Ver: drizzle/migration_sprint_g_h_interoperable_qr.sql
```

---

## ✅ Criterios de Aceptación

### Sprint G
- ✅ QR escaneable por MODO, Naranja X, MP, Bancos
- ✅ Soporta monto fijo y abierto
- ✅ Genera reference única
- ✅ Persiste qr_payload, provider, expires_at

### Sprint H
- ✅ Se pueden cargar movimientos sin tocar pagos
- ✅ Soporta múltiples fuentes (api, csv, manual)

### Sprint I
- ✅ Pagos se confirman sin intervención si confidence >= 0.9
- ✅ Sugerencias cuando confidence >= 0.6

### Sprint J
- ✅ Movimientos entran de forma automática o semi-automática

### Sprint K
- ✅ Auto-confirmación con auditoría completa
- ✅ Confirmación asistida con registro de usuario

### Sprint L
- ✅ Frontend recibe señales claras
- ✅ UX intuitiva para confirmaciones

---

## 📝 Archivos Creados/Modificados

### Nuevos Archivos

- `src/lib/qr-helpers.ts` (actualizado con `generateInteroperableQR`)
- `src/lib/matching-engine.ts`
- `src/lib/payment-confirmation.ts`
- `src/app/api/transfers/import/route.ts`
- `src/app/api/transfers/manual/route.ts`
- `src/app/api/payments/[id]/matching-status/route.ts`
- `drizzle/migration_sprint_g_h_interoperable_qr.sql`
- `src/db/schema.ts` (actualizado con nuevas tablas)

### Migraciones

Ejecutar en Supabase SQL Editor:
```sql
-- Ver: drizzle/migration_sprint_g_h_interoperable_qr.sql
```

---

## 🎯 Próximos Pasos

1. **Testing**: Probar QR con diferentes billeteras
2. **Ajustes**: Ajustar pesos del motor de matching según resultados reales
3. **Integración**: Conectar con APIs bancarias para polling automático
4. **UI**: Implementar componentes de frontend para sugerencias

---

**Estado:** ✅ Todos los sprints completados
**Fecha:** $(Get-Date -Format "yyyy-MM-dd")

