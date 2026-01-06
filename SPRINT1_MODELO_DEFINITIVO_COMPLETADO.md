# ✅ SPRINT 1 — MODELO DEFINITIVO DE REGISTRO DE COBROS - COMPLETADO

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo

Unificar todos los medios de pago bajo un único contrato de negocio con un modelo simplificado y consistente.

---

## ✅ Tareas Implementadas

### 1. **Modelo de Base de Datos - PaymentRecord (Final)**

#### **Tabla `payments` actualizada:**

```sql
Payment {
  id                    -- uuid (PK)
  sale_id               -- uuid (FK → sales.id)
  amount                -- numeric
  status                -- pending | confirmed
  method                -- cash | transfer | mp_point | qr | card | other
  provider              -- manual | mercadopago | banco | pos
  reference             -- string | null
  metadata              -- jsonb
  confirmed_by          -- user_id | null (null = system)
  confirmed_at          -- timestamp | null
  created_at            -- timestamp
  -- Campos adicionales (backward compatibility)
  payment_method_id     -- uuid (FK → payment_methods.id)
  external_reference    -- string | null
  gateway_metadata      -- jsonb (backward compatibility)
  -- ... otros campos existentes
}
```

#### **Nuevos campos agregados:**
- ✅ `provider` - Proveedor del pago (manual | mercadopago | banco | pos)
- ✅ `metadata` - Metadata JSON unificado para información adicional
- ✅ `confirmed_by` - ID del usuario que confirmó (NULL = system)
- ✅ `confirmed_at` - Fecha y hora de confirmación

#### **Índices creados:**
- ✅ `idx_payments_provider` - Para filtrado por proveedor
- ✅ `idx_payments_confirmed_by` - Para auditoría
- ✅ `idx_payments_confirmed_at` - Para consultas temporales

---

### 2. **Reglas de Negocio Implementadas**

#### ✅ **Una venta puede tener múltiples pagos**
- Implementado en `POST /api/sales/:id/payments`
- No hay límite en la cantidad de pagos por venta

#### ✅ **Suma de pagos confirmados ≥ total → venta paid**
- Implementado en `recalculateSaleBalance()`
- Solo pagos con `status = 'confirmed'` cuentan para `paid_amount`
- Actualización automática del estado de la venta

#### ✅ **Pagos manuales → status = confirmed por defecto**
- Implementado en `getInitialPaymentStatus()`
- Provider `manual` → status `confirmed` automáticamente
- Se establece `confirmed_by = NULL` (system) y `confirmed_at = now()`

#### ✅ **Pagos automáticos → pending**
- Provider `mercadopago`, `banco`, `pos` → status `pending`
- Requieren confirmación manual mediante `PATCH /api/payments/:id/confirm`

---

### 3. **Endpoints Implementados**

#### ✅ **POST /api/sales/:id/payments**
**Crear pago para una venta**

**Request Body:**
```json
{
  "amount": 1000,
  "method": "cash",
  "provider": "manual",
  "status": "confirmed",
  "reference": "Nro transferencia 12345",
  "metadata": {
    "custom_field": "value"
  }
}
```

**Validaciones:**
- ✅ Venta debe existir
- ✅ Venta no puede estar en estado `draft` o `paid`
- ✅ Monto debe ser positivo
- ✅ Método debe ser válido: cash | transfer | mp_point | qr | card | other
- ✅ Provider debe ser válido: manual | mercadopago | banco | pos
- ✅ Calcula provider automáticamente si no se proporciona
- ✅ Determina status inicial según provider (manual → confirmed, otros → pending)

**Response 201:**
```json
{
  "id": "uuid",
  "sale_id": "uuid",
  "amount": "1000",
  "status": "confirmed",
  "method": "cash",
  "provider": "manual",
  "reference": "Nro transferencia 12345",
  "metadata": { "custom_field": "value" },
  "confirmed_by": null,
  "confirmed_at": "2024-12-01T10:00:00Z",
  "created_at": "2024-12-01T10:00:00Z"
}
```

---

#### ✅ **PATCH /api/payments/:id/confirm**
**Confirmar pago manualmente**

**Request Body:**
```json
{
  "metadata": {
    "proof": "additional_info"
  },
  "proofType": "transfer_screenshot",
  "proofReference": "TRX-12345",
  "proofFileUrl": "https://..."
}
```

**Validaciones:**
- ✅ Pago debe existir
- ✅ Pago debe estar en estado `pending`
- ✅ Solo pagos automáticos pueden ser confirmados manualmente

**Response 200:**
```json
{
  "id": "uuid",
  "status": "confirmed",
  "confirmed_by": "user_uuid",
  "confirmed_at": "2024-12-01T10:00:00Z",
  "metadata": { "proof": "additional_info" }
}
```

**Efectos:**
- ✅ Actualiza `status` a `confirmed`
- ✅ Establece `confirmed_by` con el ID del usuario
- ✅ Establece `confirmed_at` con la fecha actual
- ✅ Recalcula el balance de la venta automáticamente
- ✅ Registra evento de auditoría

---

#### ✅ **GET /api/sales/:id/payments**
**Listar pagos de una venta**

**Response 200:**
```json
{
  "payments": [
    {
      "id": "uuid",
      "amount": "1000",
      "status": "confirmed",
      "method": "cash",
      "provider": "manual",
      "confirmed_by": null,
      "confirmed_at": "2024-12-01T10:00:00Z"
    }
  ],
  "totalPaid": 1000,
  "financial": {
    "totalAmount": 1000,
    "paidAmount": 1000,
    "balanceAmount": 0,
    "isPaid": true,
    "paymentCompletedAt": "2024-12-01T10:00:00Z"
  },
  "summary": {
    "total": 1,
    "byStatus": {
      "pending": 0,
      "confirmed": 1,
      "failed": 0,
      "refunded": 0
    }
  }
}
```

---

### 4. **Auditoría - payment_events**

#### ✅ **Eventos registrados:**
- ✅ `created` - Cuando se crea un pago
- ✅ `confirmed` - Cuando se confirma un pago
- ✅ `status_changed` - Cuando cambia el estado (backward compatibility)
- ✅ `cancelled` - Cuando se cancela un pago (futuro)

#### ✅ **Información registrada:**
- ✅ `payment_id` - ID del pago
- ✅ `action` - Acción realizada
- ✅ `previous_state` - Estado anterior (JSON)
- ✅ `new_state` - Nuevo estado (JSON)
- ✅ `created_by` - Usuario que realizó la acción
- ✅ `created_at` - Fecha y hora del evento

---

## 🔧 Archivos Creados/Modificados

### **Archivos Modificados:**
- ✅ `src/db/schema.ts` - Agregado campos: provider, metadata, confirmed_by, confirmed_at
- ✅ `src/validations/payment.ts` - Actualizado esquemas para incluir provider y mp_point
- ✅ `src/lib/payment-helpers.ts` - Agregado funciones: determinePaymentProvider, getInitialPaymentStatus, confirmPayment
- ✅ `src/app/api/sales/[id]/payments/route.ts` - Actualizado lógica de creación con nuevo modelo
- ✅ `src/app/api/payments/[id]/confirm/route.ts` - Cambiado a PATCH y actualizado con nuevo modelo

### **Archivos Creados:**
- ✅ `drizzle/migration_sprint1_payment_model.sql` - Migración SQL para nuevos campos
- ✅ `SPRINT1_MODELO_DEFINITIVO_COMPLETADO.md` - Este documento

---

## ✅ Criterios de Aceptación

### ✅ **Registrar cualquier pago sin gateway**
- ✅ Endpoint `POST /api/sales/:id/payments` permite crear pagos sin depender de gateways
- ✅ Soporta métodos: cash, transfer, mp_point, qr, card, other
- ✅ Provider se determina automáticamente según el método

### ✅ **Confirmar pago manualmente**
- ✅ Endpoint `PATCH /api/payments/:id/confirm` permite confirmar pagos pendientes
- ✅ Registra `confirmed_by` y `confirmed_at` para auditoría
- ✅ Actualiza metadata si se proporciona

### ✅ **Venta cambia de estado automáticamente**
- ✅ Función `recalculateSaleBalance()` actualiza `paid_amount` y `balance_amount`
- ✅ Si `balance_amount <= 0` → venta cambia a estado `paid`
- ✅ Si `balance_amount > 0` y estaba en `paid` → vuelve a `confirmed`
- ✅ Se actualiza `payment_completed_at` cuando se completa el pago

---

## 📊 Flujo de Estados

### **Pago Manual (provider = manual)**
```
Crear → status: confirmed (automático)
       → confirmed_by: null (system)
       → confirmed_at: now()
```

### **Pago Automático (provider = mercadopago | banco | pos)**
```
Crear → status: pending
       → confirmed_by: null
       → confirmed_at: null

Confirmar → status: confirmed
          → confirmed_by: user_id
          → confirmed_at: now()
```

---

## 🔄 Migración de Datos

La migración SQL incluye:
- ✅ Agregar columnas nuevas (provider, metadata, confirmed_by, confirmed_at)
- ✅ Migrar datos existentes: determinar provider según method
- ✅ Actualizar pagos confirmados existentes con confirmed_at y confirmed_by
- ✅ Crear índices para mejorar rendimiento

---

## 🎯 Próximos Pasos (Opcional)

- [ ] Agregar endpoint para cancelar pagos
- [ ] Implementar reembolsos
- [ ] Agregar validaciones adicionales según reglas de negocio específicas
- [ ] Documentar casos de uso específicos

---

## 📝 Notas Técnicas

### **Backward Compatibility**
- ✅ Se mantiene `gateway_metadata` para compatibilidad con código anterior
- ✅ Se mantiene `payment_method_id` para integración con métodos de pago configurables
- ✅ Estados antiguos (processing, failed, refunded) siguen siendo válidos pero no se usan en el nuevo modelo

### **Determinación Automática de Provider**
```typescript
cash | other → provider: "manual"
transfer → provider: "banco"
mp_point | mercadopago | qr → provider: "mercadopago"
card → provider: "pos"
```

### **Determinación Automática de Status**
```typescript
provider: "manual" → status: "confirmed"
provider: "mercadopago" | "banco" | "pos" → status: "pending"
```

---

**Estado Final:** ✅ **COMPLETADO Y LISTO PARA PRUEBAS**

