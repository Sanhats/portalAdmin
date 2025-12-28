# 📚 Documentación Completa - Sistema de Pagos para Frontend

**Versión:** 1.0  
**Fecha:** Diciembre 2024  
**Sprints Completados:** A, B, C, D, E, F

---

## 📋 Tabla de Contenidos

1. [Estados y Transiciones](#1-estados-y-transiciones)
2. [Contrato GET /api/sales/:id](#2-contrato-get-apisalesid)
3. [Contrato GET /api/sales/:id/payments](#3-contrato-get-apisalesidpayments)
4. [Contrato GET /api/payment-methods](#4-contrato-get-apipayment-methods)
5. [Matriz Método de Pago → Estado Inicial → Transición](#5-matriz-método-de-pago--estado-inicial--transición)
6. [Catálogo de Errores por Endpoint](#6-catálogo-de-errores-por-endpoint)
7. [Idempotency Key](#7-idempotency-key)
8. [Campos Gateway Seguros para UI](#8-campos-gateway-seguros-para-ui)
9. [SLA / Tiempos Esperados](#9-sla--tiempos-esperados-de-confirmación)
10. [Guía de Testing/Sandbox](#10-guía-de-testingsandbox-para-frontend)

---

## 1. Estados y Transiciones

### 1.1 Estados de Venta (`sales.status`)

| Estado | Descripción | Editable | Permite Pagos | Descuenta Stock |
|--------|-------------|-----------|---------------|-----------------|
| `draft` | Borrador, no confirmada | ✅ Sí | ❌ No | ❌ No |
| `in_progress` | En progreso (opcional) | ❌ No | ✅ Sí | ❌ No |
| `confirmed` | Confirmada, stock descontado | ❌ No | ✅ Sí | ✅ Sí |
| `completed` | Completada (opcional) | ❌ No | ✅ Sí | ✅ Sí |
| `paid` | Pagada completamente | ❌ No | ❌ No | ✅ Sí |
| `cancelled` | Cancelada, stock revertido | ❌ No | ❌ No | ❌ No |
| `refunded` | Reembolsada | ❌ No | ❌ No | ❌ No |

### 1.2 Transiciones de Venta

```
draft → confirmed (POST /api/sales/:id/confirm)
draft → cancelled (POST /api/sales/:id/cancel)
confirmed → paid (automático cuando balance_amount <= 0)
confirmed → cancelled (POST /api/sales/:id/cancel)
confirmed → refunded (futuro)
paid → refunded (futuro)
```

**Reglas:**
- Solo `draft` puede editarse (PUT)
- Solo `draft` o `in_progress` pueden confirmarse
- Solo `draft`, `confirmed` o `in_progress` pueden cancelarse
- `paid` se alcanza automáticamente cuando `balance_amount <= 0`

### 1.3 Estados de Pago (`payments.status`)

| Estado | Descripción | Eliminable | Impacta Balance | Transiciones Permitidas |
|--------|-------------|------------|-----------------|-------------------------|
| `pending` | Pendiente de confirmación | ✅ Sí | ❌ No | → `confirmed`, `failed`, `refunded` |
| `processing` | Procesando (gateway externo) | ❌ No | ❌ No | → `confirmed`, `failed`, `refunded` |
| `confirmed` | Confirmado y pagado | ❌ No | ✅ Sí | → `refunded` |
| `failed` | Fallido | ❌ No | ❌ No | (sin transiciones) |
| `refunded` | Reembolsado | ❌ No | ✅ Sí (negativo) | (sin transiciones) |

### 1.4 Transiciones de Pago

```
pending → confirmed (manual o webhook)
pending → failed (webhook o manual)
pending → refunded (manual)
processing → confirmed (webhook)
processing → failed (webhook)
processing → refunded (manual)
confirmed → refunded (manual)
```

**Reglas:**
- Solo `pending` puede eliminarse (DELETE)
- Solo `pending` o `processing` pueden confirmarse manualmente
- `confirmed` impacta en `paid_amount` y `balance_amount`
- `failed` no impacta en balance

---

## 2. Contrato GET /api/sales/:id

### 2.1 Endpoint

```
GET /api/sales/:id
Authorization: Bearer <token>
x-tenant-id: <tenant_id> (opcional)
```

### 2.2 Respuesta Exitosa (200)

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "status": "confirmed",
  "subtotal": "45000.00",
  "taxes": "9450.00",
  "discounts": "0.00",
  "total_amount": "54450.00",
  "cost_amount": "25000.00",
  "paid_amount": "25000.00",
  "balance_amount": "29450.00",
  "payment_method": null,
  "notes": "Venta de prueba",
  "payment_completed_at": null,
  "created_at": "2024-12-23T10:00:00Z",
  "updated_at": "2024-12-23T10:00:00Z",
  "created_by": "uuid",
  "sale_items": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "variant_id": null,
      "quantity": 1,
      "unit_price": "45000.00",
      "subtotal": "45000.00",
      "product_name": "Producto Ejemplo",
      "product_sku": "PROD-001",
      "variant_name": null,
      "variant_value": null,
      "unit_cost": "25000.00",
      "unit_tax": "9450.00",
      "unit_discount": "0.00",
      "stock_impacted": 1
    }
  ],
  "financial": {
    "totalAmount": 54450.00,
    "paidAmount": 25000.00,
    "balanceAmount": 29450.00,
    "isPaid": false,
    "paymentCompletedAt": null,
    "subtotal": 45000.00,
    "taxes": 9450.00,
    "discounts": 0.00,
    "costAmount": 25000.00,
    "margin": 29450.00,
    "marginPercentage": 54.09
  }
}
```

### 2.3 Campos Importantes

#### `financial` (Resumen Financiero)
- **`totalAmount`**: Monto total de la venta (subtotal + taxes - discounts)
- **`paidAmount`**: Suma de pagos `confirmed` (solo estos cuentan)
- **`balanceAmount`**: `totalAmount - paidAmount`
- **`isPaid`**: `true` si `balanceAmount <= 0`
- **`paymentCompletedAt`**: Timestamp cuando se completó el pago (si aplica)
- **`subtotal`**: Subtotal antes de impuestos
- **`taxes`**: Total de impuestos
- **`discounts`**: Total de descuentos
- **`costAmount`**: Costo total (para calcular margen)
- **`margin`**: `totalAmount - costAmount`
- **`marginPercentage`**: `(margin / totalAmount) * 100`

#### `sale_items` (Snapshot)
- **`product_name`**: Nombre del producto al momento de la venta (inmutable)
- **`product_sku`**: SKU del producto (inmutable)
- **`unit_price`**: Precio unitario al momento de la venta (inmutable)
- **`unit_cost`**: Costo unitario al momento de la venta (inmutable)
- **`unit_tax`**: Impuesto unitario (inmutable)
- **`unit_discount`**: Descuento unitario (inmutable)
- **`stock_impacted`**: Cantidad de stock afectada (solo si `status` es `confirmed` o superior)

### 2.4 Errores

| Código | Descripción |
|--------|-------------|
| 401 | No autorizado (token inválido) |
| 404 | Venta no encontrada |
| 500 | Error interno del servidor |

---

## 3. Contrato GET /api/sales/:id/payments

### 3.1 Endpoint

```
GET /api/sales/:id/payments
Authorization: Bearer <token>
x-tenant-id: <tenant_id> (opcional)
```

### 3.2 Respuesta Exitosa (200)

```json
{
  "payments": [
    {
      "id": "uuid",
      "sale_id": "uuid",
      "tenant_id": "uuid",
      "amount": "25000.00",
      "method": "cash",
      "payment_method_id": "uuid",
      "status": "confirmed",
      "reference": "Pago en efectivo",
      "external_reference": null,
      "gateway_metadata": null,
      "proof_type": null,
      "proof_reference": null,
      "proof_file_url": null,
      "terminal_id": null,
      "cash_register_id": null,
      "created_at": "2024-12-23T10:05:00Z",
      "created_by": "uuid",
      "payment_methods": {
        "id": "uuid",
        "code": "cash",
        "label": "Efectivo",
        "type": "cash",
        "is_active": true
      }
    },
    {
      "id": "uuid",
      "amount": "29450.00",
      "method": "mercadopago",
      "status": "pending",
      "external_reference": "1231202386-3090340c-bb63-4cbe-9bf9-6e1d1d9434ea",
      "gateway_metadata": {
        "provider": "mercadopago",
        "preference_id": "1231202386-3090340c-bb63-4cbe-9bf9-6e1d1d9434ea",
        "init_point": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
        "last_webhook": {
          "type": "payment.created",
          "status": "pending",
          "timestamp": "2024-12-23T10:10:00Z"
        }
      },
      "payment_methods": null
    },
    {
      "id": "uuid",
      "amount": "10000.00",
      "method": "qr",
      "status": "pending",
      "external_reference": "QR-abc123-1234567890",
      "gateway_metadata": {
        "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
        "qr_payload": "00020101021243650016COM.MERCADOLIVRE02008...",
        "provider": "mercadopago_instore",
        "expires_at": "2024-12-23T11:00:00Z"
      },
      "payment_methods": {
        "id": "uuid",
        "code": "qr_generic",
        "label": "QR Genérico",
        "type": "qr",
        "is_active": true
      }
    }
  ],
  "summary": {
    "totalPaid": 25000.00,
    "financial": {
      "paidAmount": 25000.00,
      "balanceAmount": 29450.00,
      "isPaid": false,
      "paymentCompletedAt": null
    }
  }
}
```

### 3.3 Campos Importantes

#### `summary.totalPaid`
- Suma de pagos con estado `confirmed` (solo estos cuentan)

#### `summary.financial`
- Mismo formato que `financial` en GET /api/sales/:id
- Valores calculados en tiempo real

#### `payments[].gateway_metadata`
- Solo presente para pagos de gateway externo (`mercadopago`, etc.) o QR (`mercadopago_instore`, `generic_qr`)
- **Para pagos online (MP Checkout):**
  - **`init_point`**: URL de checkout (para redirigir al usuario)
  - **`preference_id`**: ID de la preference en Mercado Pago
  - **`last_webhook`**: Último webhook recibido (si aplica)
- **Para pagos QR:**
  - **`qr_code`**: Imagen QR en base64 (data:image/png;base64,...)
  - **`qr_payload`**: Payload del QR (EMVCo para MP, JSON para genérico)
  - **`provider`**: `"mercadopago_instore"` (escaneable MP) o `"generic_qr"` (testing)
  - **`expires_at`**: Fecha de expiración (ISO-8601, opcional)

### 3.4 Errores

| Código | Descripción |
|--------|-------------|
| 401 | No autorizado |
| 404 | Venta no encontrada |
| 500 | Error interno |

---

## 4. Contrato GET /api/payment-methods

### 4.1 Endpoint

```
GET /api/payment-methods
Authorization: Bearer <token>
x-tenant-id: <tenant_id> (opcional)
?type=cash|transfer|qr|card|gateway|mercadopago|stripe|paypal|other
?isActive=true|false
```

### 4.2 Respuesta Exitosa (200)

```json
{
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "code": "cash",
      "label": "Efectivo",
      "type": "cash",
      "payment_category": "manual",
      "is_active": true,
      "metadata": null,
      "created_at": "2024-12-23T10:00:00Z"
    },
    {
      "id": "uuid",
      "code": "mercadopago",
      "label": "Mercado Pago",
      "type": "mercadopago",
      "payment_category": "external",
      "is_active": true,
      "metadata": {
        "provider": "mercadopago"
      }
    },
    {
      "id": "uuid",
      "code": "qr_generic",
      "label": "QR Genérico",
      "type": "qr",
      "payment_category": "gateway",
      "is_active": true,
      "metadata": {
        "provider": "generic_qr"
      }
    }
  ]
}
```

### 4.3 Flags de Comportamiento

#### `payment_category`

| Valor | Descripción | Estado Inicial | Confirmación |
|-------|-------------|----------------|--------------|
| `manual` | Pago manual (cash, transfer) | `confirmed` | Instantánea |
| `gateway` | Gateway interno (QR, POS) | `pending` | Manual requerida |
| `external` | Gateway externo (MP, Stripe) | `pending` | Webhook automático |

#### `type`

| Valor | Categoría Típica | Uso |
|-------|-------------------|-----|
| `cash` | `manual` | Efectivo físico |
| `transfer` | `manual` | Transferencia bancaria |
| `qr` | `gateway` | Código QR |
| `card` | `gateway` | Tarjeta (POS) |
| `mercadopago` | `external` | Mercado Pago online |
| `stripe` | `external` | Stripe |
| `paypal` | `external` | PayPal |

### 4.4 Errores

| Código | Descripción |
|--------|-------------|
| 401 | No autorizado |
| 500 | Error interno |

---

## 5. Matriz Método de Pago → Estado Inicial → Transición

### 5.1 Tabla Completa

| Método | Categoría | Estado Inicial | Transición Automática | Confirmación Manual |
|--------|-----------|----------------|----------------------|---------------------|
| `cash` | `manual` | `confirmed` | ✅ Instantánea | ❌ No requerida |
| `transfer` | `manual` | `confirmed` | ✅ Instantánea | ❌ No requerida |
| `qr` | `gateway` | `pending` | ❌ No | ✅ Requerida |
| `card` | `gateway` | `pending` | ❌ No | ✅ Requerida |
| `mercadopago` | `external` | `pending` | ✅ Webhook | ⚠️ Opcional (fallback) |
| `stripe` | `external` | `pending` | ✅ Webhook | ⚠️ Opcional (fallback) |
| `paypal` | `external` | `pending` | ✅ Webhook | ⚠️ Opcional (fallback) |

### 5.2 Reglas de Transición

#### Manual (`payment_category: "manual"`)
```
POST /api/sales/:id/payments
→ status: "confirmed" (automático)
→ balance_amount se actualiza inmediatamente
```

#### Gateway (`payment_category: "gateway"`)
```
POST /api/sales/:id/payments
→ status: "pending"
→ Requiere: POST /api/payments/:id/confirm
→ balance_amount se actualiza después de confirmar
```

#### External (`payment_category: "external"`)
```
POST /api/sales/:id/payments/mercadopago
→ status: "pending"
→ Webhook automático cuando el usuario paga
→ balance_amount se actualiza cuando webhook confirma
→ Opcional: POST /api/payments/:id/confirm (si webhook falla)
```

---

## 6. Catálogo de Errores por Endpoint

### 6.1 GET /api/sales/:id

| Código | Mensaje | Causa | Solución |
|--------|---------|-------|----------|
| 401 | No autorizado | Token inválido o expirado | Renovar token |
| 404 | Venta no encontrada | ID inválido o venta eliminada | Verificar ID |
| 500 | Error interno | Error del servidor | Contactar soporte |

### 6.2 GET /api/sales/:id/payments

| Código | Mensaje | Causa | Solución |
|--------|---------|-------|----------|
| 401 | No autorizado | Token inválido | Renovar token |
| 404 | Venta no encontrada | ID inválido | Verificar ID |
| 500 | Error interno | Error del servidor | Contactar soporte |

### 6.3 POST /api/sales/:id/payments

| Código | Mensaje | Causa | Solución |
|--------|---------|-------|----------|
| 400 | Venta en estado draft | No se pueden crear pagos en draft | Confirmar venta primero |
| 400 | Venta ya pagada | `balance_amount <= 0` | Verificar estado |
| 400 | Balance cero o negativo | No hay monto pendiente | Verificar balance |
| 400 | Datos inválidos | Validación fallida | Revisar body |
| 401 | No autorizado | Token inválido | Renovar token |
| 404 | Venta no encontrada | ID inválido | Verificar ID |
| 409 | Pago duplicado | Idempotency key existente | Usar pago existente |
| 500 | Error interno | Error del servidor | Contactar soporte |

### 6.4 POST /api/sales/:id/payments/mercadopago

| Código | Mensaje | Causa | Solución |
|--------|---------|-------|----------|
| 400 | Venta ya pagada | `balance_amount <= 0` | Verificar estado |
| 400 | Balance cero o negativo | No hay monto pendiente | Verificar balance |
| 401 | No autorizado | Token inválido | Renovar token |
| 404 | Configuración MP no encontrada | Gateway no configurado | Configurar gateway |
| 500 | Error al crear preference | Error en Mercado Pago | Verificar credenciales |

### 6.5 POST /api/sales/:id/payments/qr

| Código | Mensaje | Causa | Solución |
|--------|---------|-------|----------|
| 400 | Venta en estado draft | No se pueden crear pagos en draft | Confirmar venta primero |
| 400 | Venta ya pagada | `balance_amount <= 0` | Verificar estado |
| 401 | No autorizado | Token inválido | Renovar token |
| 404 | Venta no encontrada | ID inválido | Verificar ID |
| 500 | Error interno | Error del servidor | Contactar soporte |

### 6.6 POST /api/payments/:id/confirm

| Código | Mensaje | Causa | Solución |
|--------|---------|-------|----------|
| 400 | Estado no confirmable | Pago no está en `pending` o `processing` | Verificar estado |
| 401 | No autorizado | Token inválido | Renovar token |
| 404 | Pago no encontrado | ID inválido | Verificar ID |
| 500 | Error interno | Error del servidor | Contactar soporte |

### 6.7 DELETE /api/payments/:id

| Código | Mensaje | Causa | Solución |
|--------|---------|-------|----------|
| 400 | No se puede eliminar | Pago está `confirmed` | Solo `pending` se puede eliminar |
| 401 | No autorizado | Token inválido | Renovar token |
| 404 | Pago no encontrado | ID inválido | Verificar ID |
| 500 | Error interno | Error del servidor | Contactar soporte |

### 6.8 GET /api/payment-methods

| Código | Mensaje | Causa | Solución |
|--------|---------|-------|----------|
| 401 | No autorizado | Token inválido | Renovar token |
| 500 | Error interno | Error del servidor | Contactar soporte |

---

## 7. Idempotency Key

### 7.1 ¿Qué es?

La `idempotency_key` es un hash único que previene pagos duplicados si el mismo request se envía múltiples veces (por ejemplo, por un doble click o un retry).

### 7.2 ¿Cómo funciona?

1. **Frontend NO debe generar la key**: El backend la genera automáticamente
2. **Si el pago ya existe**: El backend retorna el pago existente (200) en lugar de crear uno nuevo
3. **Frontend debe manejar**: Si recibe un pago existente, debe usar ese pago en lugar de mostrar error

### 7.3 Ejemplo de Flujo

```javascript
// Request 1
POST /api/sales/123/payments
{ "amount": 1000, "method": "cash" }
→ 201 Created { "id": "payment-1" }

// Request 2 (duplicado, mismo body)
POST /api/sales/123/payments
{ "amount": 1000, "method": "cash" }
→ 200 OK { "id": "payment-1" } // Mismo pago, no duplicado
```

### 7.4 Recomendaciones para Frontend

✅ **Hacer:**
- Manejar respuesta 200 como éxito (pago existente)
- Deshabilitar botón después del primer click
- Mostrar loading durante el request

❌ **No hacer:**
- Generar `idempotency_key` manualmente
- Mostrar error si recibe 200 en lugar de 201
- Permitir múltiples clicks rápidos

### 7.5 Campos que afectan Idempotencia

- `sale_id`
- `amount`
- `method` o `payment_method_id`
- `external_reference` (si aplica)

**Nota:** Cambiar cualquiera de estos campos creará un nuevo pago.

---

## 8. Campos Gateway Seguros para UI

### 8.1 Campos Seguros (Pueden Mostrarse)

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `gateway_metadata.provider` | Proveedor del gateway | `"mercadopago"`, `"mercadopago_instore"`, `"generic_qr"` |
| `gateway_metadata.preference_id` | ID de la preference (solo MP Checkout) | `"1231202386-..."` |
| `gateway_metadata.init_point` | URL de checkout (solo MP Checkout) | `"https://www.mercadopago.com.ar/..."` |
| `gateway_metadata.qr_code` | Imagen QR en base64 (solo QR) | `"data:image/png;base64,..."` |
| `gateway_metadata.qr_payload` | Payload del QR (solo QR) | `"000201010212..."` o `"{...}"` |
| `gateway_metadata.expires_at` | Fecha de expiración del QR (solo QR) | `"2024-12-23T11:00:00Z"` |
| `gateway_metadata.last_webhook.status` | Estado del último webhook | `"pending"` |
| `gateway_metadata.last_webhook.timestamp` | Timestamp del webhook | `"2024-12-23T10:00:00Z"` |
| `external_reference` | Referencia externa | `"QR-123-456"` |

### 8.2 Campos NO Seguros (NO Mostrar)

| Campo | Descripción | Razón |
|-------|-------------|-------|
| `gateway_metadata.credentials` | Credenciales del gateway | Contiene tokens secretos |
| `gateway_metadata.access_token` | Token de acceso | Información sensible |
| `gateway_metadata.client_secret` | Secret del cliente | Información sensible |
| `gateway_metadata.raw_payload` | Payload completo del webhook | Puede contener datos sensibles |

### 8.3 Recomendaciones

✅ **Seguro mostrar:**
- Estado del pago (`status`)
- Monto (`amount`)
- URL de checkout (`init_point`) - solo para pagos online
- Imagen QR (`gateway_metadata.qr_code`) - solo para pagos QR
- Provider (`gateway_metadata.provider`)
- ID de referencia externa (`external_reference`)

❌ **NUNCA mostrar:**
- Credenciales del gateway
- Tokens de acceso
- Secrets
- Payloads completos de webhooks
- `gateway_metadata.qr_payload` (solo usar para debugging, no mostrar al usuario)

---

## 9. SLA / Tiempos Esperados de Confirmación

### 9.1 Tiempos por Tipo de Pago

| Tipo | Confirmación | Tiempo Esperado | Notas |
|------|--------------|----------------|-------|
| `manual` (cash, transfer) | Instantánea | < 1 segundo | Confirmación automática |
| `gateway` (QR, POS) | Manual | Variable | Depende del operador |
| `external` (MP, Stripe) | Webhook | 5-30 segundos | Después de que el usuario paga |

### 9.2 Recomendaciones de UI

#### Pagos Manuales
- ✅ Mostrar como confirmado inmediatamente
- ✅ Actualizar balance instantáneamente

#### Pagos Gateway (QR/POS)
- ⏳ Mostrar como pendiente hasta confirmación manual
- 🔔 Opción para confirmar manualmente (botón)
- ⏱️ Tiempo máximo sugerido: 5 minutos

#### Pagos External (Mercado Pago Online)
- 🔄 Mostrar loading mientras está pendiente
- 🔔 Polling opcional cada 10 segundos (máx 3 minutos)
- ✅ Webhook actualiza automáticamente
- ⏱️ Tiempo esperado: 5-30 segundos después del pago

#### Pagos QR (Mercado Pago In-Store)
- 📱 Mostrar QR inmediatamente (`gateway_metadata.qr_code`)
- 🔍 Verificar `provider === "mercadopago_instore"` para QR escaneable
- ⏱️ Tiempo esperado: Inmediato (QR generado al instante)
- 🔔 Webhook actualiza cuando el usuario escanea y paga
- ⚠️ Si `provider === "generic_qr"`, el QR NO es escaneable por MP (solo testing)

### 9.3 Estrategia de Polling (Opcional)

```javascript
// Solo para pagos external en estado pending
async function pollPaymentStatus(paymentId, maxAttempts = 18) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(10000); // 10 segundos
    const payment = await getPayment(paymentId);
    if (payment.status !== 'pending') {
      return payment;
    }
  }
  return null; // Timeout
}
```

**Nota:** El webhook es la fuente de verdad. El polling es solo para mejorar UX.

---

## 10. Guía de Testing/Sandbox para Frontend

### 10.1 Credenciales de Prueba

#### Mercado Pago Sandbox
- **Access Token**: Usar token de prueba (empieza con `TEST-`)
- **URLs de prueba**: Las URLs de checkout funcionan en sandbox
- **Webhooks**: Configurar `notification_url` apuntando a tu servidor de desarrollo

#### Variables de Entorno
```env
MERCADOPAGO_ACCESS_TOKEN=TEST-1234567890-123456-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 10.2 Flujos de Prueba

#### 1. Pago Manual (Cash)
```
1. Crear venta (POST /api/sales)
2. Confirmar venta (POST /api/sales/:id/confirm)
3. Crear pago cash (POST /api/sales/:id/payments)
   Body: { "amount": 1000, "method": "cash" }
4. Verificar: status = "confirmed", balance actualizado
```

#### 2. Pago QR
```
1. Crear venta y confirmar
2. Crear pago QR (POST /api/sales/:id/payments/qr)
   Body: { "qrType": "dynamic" }
3. Verificar: 
   - status = "pending"
   - gateway_metadata.qr_code presente (base64)
   - gateway_metadata.provider = "mercadopago_instore" (si está configurado) o "generic_qr"
4. Renderizar QR usando gateway_metadata.qr_code
5. Confirmar manualmente (POST /api/payments/:id/confirm)
   Body: { "proofType": "qr_code", "proofReference": "QR-123" }
6. Verificar: status = "confirmed", balance actualizado
```

#### 3. Pago Mercado Pago
```
1. Crear venta y confirmar
2. Crear pago MP (POST /api/sales/:id/payments/mercadopago)
3. Verificar: checkoutUrl presente, status = "pending"
4. Abrir checkoutUrl en navegador
5. Completar pago en sandbox de MP
6. Esperar webhook (5-30 segundos)
7. Verificar: status = "confirmed", balance actualizado
```

### 10.3 Casos de Prueba Críticos

#### ✅ Casos Exitosos
- [ ] Crear pago manual → Confirmado instantáneamente
- [ ] Crear pago QR → Pendiente → QR generado en `gateway_metadata.qr_code`
- [ ] QR escaneable → `provider === "mercadopago_instore"` (si está configurado)
- [ ] QR genérico → `provider === "generic_qr"` (fallback/testing)
- [ ] Confirmar pago QR manualmente → Status cambia a `confirmed`
- [ ] Crear pago MP → Pendiente → Webhook confirma
- [ ] Múltiples pagos parciales → Balance se actualiza correctamente
- [ ] Pago completo → Venta cambia a `paid`

#### ⚠️ Casos de Error
- [ ] Intentar pagar venta `draft` → Error 400
- [ ] Intentar pagar venta `paid` → Error 400
- [ ] Intentar eliminar pago `confirmed` → Error 400
- [ ] Crear pago duplicado → Retorna pago existente (200)

#### 🔄 Casos de Idempotencia
- [ ] Doble click en crear pago → Solo se crea uno
- [ ] Retry después de error de red → Usa pago existente
- [ ] Mismo body múltiples veces → Mismo pago

### 10.4 Scripts de Prueba Disponibles

El backend incluye scripts de prueba automatizados:

- `test-sprint-a.ps1` - Pruebas de ventas y snapshots
- `test-sprint-b.ps1` - Pruebas de normalización de pagos
- `test-sprint-c.ps1` - Pruebas de gateways
- `test-sprint-d.ps1` - Pruebas de Mercado Pago
- `test-sprint-e.ps1` - Pruebas de webhooks
- `test-sprint-f.ps1` - Pruebas de QR y confirmación manual

### 10.5 Datos de Prueba Recomendados

#### Productos
- Crear productos con stock suficiente (> 10 unidades)
- Precios variados: $1000, $5000, $10000

#### Ventas
- Venta pequeña: 1 producto, $1000
- Venta mediana: 2-3 productos, $5000-10000
- Venta grande: 5+ productos, $20000+

#### Pagos
- Pago completo: `amount = balance_amount`
- Pago parcial: `amount < balance_amount`
- Múltiples pagos: Dividir en 2-3 pagos

### 10.6 Checklist de Integración

- [ ] Autenticación funcionando
- [ ] GET /api/sales/:id muestra `financial` completo
- [ ] GET /api/sales/:id/payments muestra `summary`
- [ ] POST /api/sales/:id/payments crea pagos correctamente
- [ ] Estados se actualizan correctamente
- [ ] Balance se recalcula automáticamente
- [ ] Idempotencia funciona (doble click)
- [ ] Errores se manejan correctamente
- [ ] Loading states funcionan
- [ ] Webhooks actualizan estados (MP)

---

## 📝 Notas Finales

### Convenciones Importantes

1. **Montos**: Siempre en formato string con 2 decimales (`"1000.00"`)
2. **UUIDs**: Todos los IDs son UUIDs v4
3. **Timestamps**: Formato ISO 8601 (`2024-12-23T10:00:00Z`)
4. **Estados**: Siempre en minúsculas (`pending`, `confirmed`, etc.)

### Soporte

Para dudas o problemas:
1. Revisar logs del servidor
2. Verificar validaciones en el código
3. Consultar esta documentación
4. Contactar al equipo de backend

---

**Última actualización:** Diciembre 2024  
**Versión del API:** 1.0

