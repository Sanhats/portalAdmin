# ✅ SPRINT 5 — Cuentas Corrientes, Pagos y Saldos

**Fecha:** Enero 2025  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo del Sprint

Implementar el sistema financiero base, permitiendo:

- ✅ Manejar cuentas corrientes de clientes
- ✅ Registrar pagos parciales o totales
- ✅ Mantener saldos correctos y auditables
- ✅ Integrar pagos con ventas confirmadas
- ✅ Preparar la base para caja, reportes y cierre diario

**⚠️ NO incluye:** Caja, cierre diario, reportes, frontend, AFIP, facturación fiscal

---

## 📋 Entregables Completados

### 1. **Cuentas Corrientes (Accounts)**

**Tabla `accounts` creada:**
```sql
accounts {
  id            UUID (PK)
  tenant_id     UUID (FK stores)
  entity_type   TEXT ('customer') -- solo customer en este sprint
  entity_id     UUID (FK customers)
  balance       NUMERIC(15,2) DEFAULT 0 -- solo informativo (cache)
  created_at    TIMESTAMP
  updated_at    TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ Una sola cuenta por cliente y tenant
- ✅ Se crea automáticamente al crear un cliente (si no existe)
- ✅ El balance NO es fuente de verdad, solo cache
- ✅ Balance se recalcula desde movimientos

**Índices:**
- ✅ `idx_accounts_tenant_id` - Por tenant
- ✅ `idx_accounts_entity` - Por tipo y entidad
- ✅ `idx_accounts_unique_customer` - Unicidad (tenant, entity_type, entity_id)

### 2. **Movimientos de Cuenta (Account Movements)**

**Tabla `account_movements` creada:**
```sql
account_movements {
  id              UUID (PK)
  tenant_id       UUID (FK stores)
  account_id      UUID (FK accounts)
  type            TEXT ('debit' | 'credit')
  amount          NUMERIC(15,2)
  reference_type  TEXT ('sale' | 'payment' | 'adjustment' | 'sale_cancelation')
  reference_id    UUID
  description     TEXT
  created_at      TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ **Nunca se editan ni eliminan** (inmutables)
- ✅ `debit` = aumenta deuda
- ✅ `credit` = reduce deuda
- ✅ Todo impacto financiero genera un movimiento
- ✅ Trigger automático actualiza balance cacheado

**Tipos de referencia:**
- `sale` - Deuda por venta confirmada
- `payment` - Pago registrado
- `adjustment` - Ajuste manual (futuro)
- `sale_cancelation` - Reversión de deuda por cancelación

**Índices:**
- ✅ Por tenant, account, type, reference, fecha

### 3. **Pagos (Payments)**

**Tabla `payments_sprint5` creada:**
```sql
payments_sprint5 {
  id            UUID (PK)
  tenant_id     UUID (FK stores)
  customer_id   UUID (FK customers)
  sale_id       UUID (FK sales, nullable)
  amount        NUMERIC(15,2)
  method        TEXT (cash | transfer | card | other)
  notes         TEXT
  created_at    TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ Permite pagos parciales
- ✅ Un pago puede asociarse o no a una venta
- ✅ Cada pago genera un `account_movement` tipo `credit`
- ✅ Validación: cliente activo, venta confirmada (si se proporciona)

### 4. **Integración con Ventas (Sprint 4)**

**Al confirmar una venta:**
- ✅ Se genera un `account_movement`:
  - `type`: `debit`
  - `amount`: `sale.total`
  - `reference_type`: `sale`
  - `reference_id`: `sale.id`
- ✅ Solo si la venta tiene `customer_id` (ventas mostrador no generan deuda)

**Al cancelar una venta confirmada:**
- ✅ Se genera un movimiento inverso:
  - `type`: `credit`
  - `amount`: `sale.total`
  - `reference_type`: `sale_cancelation`
  - `reference_id`: `sale.id`

---

## 🔌 Endpoints Implementados

### Cuentas Corrientes

#### `GET /api/accounts/customers/:customerId`
Obtiene la cuenta corriente de un cliente.

**Query params:**
- `tenantId` (opcional, puede venir en header `x-tenant-id`)
- `page` (default: 1) - Para paginación de movimientos
- `limit` (default: 20) - Para paginación de movimientos

**Response:**
```json
{
  "account": {
    "id": "uuid",
    "tenant_id": "uuid",
    "entity_type": "customer",
    "entity_id": "uuid",
    "balance": 1500.50, // Balance calculado (fuente de verdad)
    "balanceCached": 1500.50, // Balance cacheado (solo informativo)
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  },
  "customer": {
    "id": "uuid",
    "name": "Juan Pérez"
  },
  "movements": {
    "data": [...], // Últimos movimientos
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### Pagos

#### `POST /api/payments`
Crea un nuevo pago.

**Body:**
```json
{
  "customerId": "uuid",
  "saleId": "uuid", // Opcional
  "amount": 500,
  "method": "cash",
  "notes": "Pago parcial"
}
```

**Validaciones:**
- ✅ Cliente debe existir y estar activo
- ✅ Si se proporciona `saleId`, la venta debe estar confirmada
- ✅ Si se proporciona `saleId`, debe pertenecer al cliente
- ✅ `amount` debe ser mayor a 0

**Response:** Pago creado con relaciones (201)

**Proceso:**
1. Crea el pago en `payments_sprint5`
2. Genera movimiento `credit` en `account_movements`
3. Actualiza balance cacheado automáticamente (trigger)

### Movimientos

#### `GET /api/accounts/:accountId/movements`
Obtiene movimientos de una cuenta con filtros.

**Query params:**
- `tenantId` (opcional, puede venir en header)
- `type` - Filtro por tipo: `debit` | `credit`
- `referenceType` - Filtro por referencia: `sale` | `payment` | `adjustment` | `sale_cancelation`
- `referenceId` - Filtro por ID de referencia
- `startDate` - Filtro desde fecha
- `endDate` - Filtro hasta fecha
- `page` (default: 1)
- `limit` (default: 50)

**Response:**
```json
{
  "movements": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

---

## 🛠️ Helpers Implementados

### `src/lib/accounting-helpers-sprint5.ts`

#### `getOrCreateAccount(customerId: string, tenantId: string)`
Obtiene o crea una cuenta corriente para un cliente.

**Returns:** `{ accountId: string, created: boolean }`

#### `createAccountMovement(input: AccountMovementInput, tenantId: string)`
Crea un movimiento de cuenta (inmutable).

**Input:**
```typescript
{
  accountId: string;
  type: "debit" | "credit";
  amount: number;
  referenceType: "sale" | "payment" | "adjustment" | "sale_cancelation";
  referenceId: string | null;
  description?: string;
}
```

**Returns:** `{ movementId: string }`

**Nota:** El trigger en BD actualiza automáticamente el balance cacheado.

#### `recalculateAccountBalance(accountId: string)`
Recalcula el balance de una cuenta desde sus movimientos.

**Returns:** `number` (balance calculado)

#### `getAccountBalance(accountId: string)`
Obtiene el balance actual de una cuenta (calculado desde movimientos, sin actualizar cache).

**Returns:** `number`

#### `registerSaleDebt(saleId: string, tenantId: string)`
Registra la deuda de una venta confirmada.

**Proceso:**
1. Obtiene la venta
2. Si tiene `customer_id`, obtiene/crea cuenta
3. Crea movimiento `debit` con referencia a la venta

**Returns:** `{ success: boolean, error?: string }`

#### `registerSaleCancelation(saleId: string, tenantId: string)`
Registra la reversión de deuda al cancelar una venta.

**Proceso:**
1. Obtiene la venta
2. Si tiene `customer_id`, obtiene cuenta
3. Crea movimiento `credit` con referencia a la cancelación

**Returns:** `{ success: boolean, error?: string }`

#### `registerPayment(paymentId: string, tenantId: string)`
Registra un pago y genera el movimiento credit correspondiente.

**Proceso:**
1. Obtiene el pago
2. Obtiene/crea cuenta del cliente
3. Crea movimiento `credit` con referencia al pago

**Returns:** `{ success: boolean, error?: string }`

---

## 🔄 Integración con Sprint 4

### Modificaciones en `sale-helpers-sprint4.ts`

**`confirmSale()` actualizado:**
- ✅ Después de confirmar la venta, llama a `registerSaleDebt()`
- ✅ Si falla el registro de deuda, solo loguea (no falla la confirmación)

**`cancelSale()` actualizado:**
- ✅ Después de cancelar la venta, llama a `registerSaleCancelation()`
- ✅ Si falla el registro de reversión, solo loguea (no falla la cancelación)

**Nota:** La integración es no bloqueante para mantener la consistencia del Sprint 4.

---

## 📊 Validaciones Implementadas

### Pagos
- ✅ `customerId` debe existir y estar activo
- ✅ `saleId` debe existir y estar confirmada (si se proporciona)
- ✅ `saleId` debe pertenecer al cliente (si se proporciona)
- ✅ `amount` debe ser mayor a 0
- ✅ `method` debe ser: `cash`, `transfer`, `card` u `other`

### Cuentas
- ✅ Una sola cuenta por cliente y tenant (constraint único)
- ✅ Balance se calcula siempre desde movimientos (fuente de verdad)

### Movimientos
- ✅ **Nunca se editan ni eliminan** (no hay endpoints PUT/DELETE)
- ✅ `type` debe ser `debit` o `credit`
- ✅ `amount` debe ser mayor a 0
- ✅ `reference_type` debe ser válido

---

## 🗄️ Migración SQL

**Archivo:** `migrations/sprint5_accounts_payments.sql`

**Cambios aplicados:**
1. ✅ Crear tabla `accounts`
2. ✅ Crear tabla `account_movements`
3. ✅ Crear tabla `payments_sprint5`
4. ✅ Crear índices y constraints
5. ✅ Trigger para `updated_at` en `accounts`
6. ✅ Función `recalculate_account_balance()`
7. ✅ Trigger para actualizar balance automáticamente
8. ✅ Función helper `get_or_create_account()`

**Nota:** La tabla se llama `payments_sprint5` para evitar conflicto con la tabla `payments` existente del sistema.

---

## 🧪 Criterios de Aceptación

### ✅ Completados

1. ✅ Confirmar una venta genera deuda (movimiento `debit`)
2. ✅ Registrar un pago reduce deuda (movimiento `credit`)
3. ✅ Pagos parciales funcionan (pago sin `saleId` o con `saleId` parcial)
4. ✅ Cancelar venta revierte deuda (movimiento `credit` tipo `sale_cancelation`)
5. ✅ No hay balances negativos incoherentes (balance siempre se calcula desde movimientos)
6. ✅ Auditoría completa (todos los movimientos quedan registrados)
7. ✅ Multi-tenant funcionando en todos los endpoints
8. ✅ Nada de Sprint 4 se rompe (integración no bloqueante)

---

## 🔄 Flujo Completo

### 1. Confirmar Venta (Genera Deuda)
```
POST /api/sales/:id/confirm
→ Valida stock
→ Genera movimientos de stock
→ Estado: confirmed
→ SPRINT 5: Genera account_movement (debit)
```

### 2. Registrar Pago (Reduce Deuda)
```
POST /api/payments
{
  "customerId": "uuid",
  "saleId": "uuid", // Opcional
  "amount": 500,
  "method": "cash"
}
→ Crea pago
→ Genera account_movement (credit)
→ Actualiza balance cacheado
```

### 3. Cancelar Venta (Revierte Deuda)
```
POST /api/sales/:id/cancel
→ Solo si status === 'confirmed'
→ Genera movimientos inversos de stock
→ Estado: cancelled
→ SPRINT 5: Genera account_movement (credit, tipo sale_cancelation)
```

### 4. Consultar Cuenta Corriente
```
GET /api/accounts/customers/:customerId
→ Obtiene cuenta
→ Calcula balance desde movimientos
→ Devuelve últimos movimientos (paginado)
```

---

## 📝 Notas de Implementación

### Inmutabilidad de Movimientos
- ✅ **No hay endpoints PUT/DELETE para `account_movements`**
- ✅ Los movimientos son inmutables por diseño
- ✅ Si hay error, se crea un movimiento de ajuste (futuro)

### Balance Cacheado
- ✅ El balance en `accounts.balance` es solo cache
- ✅ La fuente de verdad es la suma de `account_movements`
- ✅ El trigger actualiza el cache automáticamente
- ✅ Los helpers siempre calculan desde movimientos

### Integración con Sprint 4
- ✅ La integración es **no bloqueante**
- ✅ Si falla el registro de deuda/reversión, no falla la venta
- ✅ Esto mantiene la consistencia del Sprint 4

### Pagos Parciales
- ✅ Un pago puede no tener `saleId` (pago general)
- ✅ Un pago puede tener `saleId` (pago específico)
- ✅ Múltiples pagos pueden asociarse a una venta (futuro)

---

## 🚀 Preparación para Próximos Sprints

Este sprint deja preparado:

- ✅ Base para caja (pagos registrados)
- ✅ Base para reportes financieros
- ✅ Base para cierre diario
- ✅ Base para ajustes manuales (tipo `adjustment`)

**No implementado todavía:**
- ❌ Caja
- ❌ Cierre diario
- ❌ Reportes
- ❌ Ajustes manuales (tipo `adjustment`)
- ❌ Frontend

---

## ✅ Estado Final

**Sprint 5 completado exitosamente.**

- ✅ Todas las entidades implementadas
- ✅ Todos los endpoints funcionando
- ✅ Validaciones completas
- ✅ Helpers reutilizables
- ✅ Migración aplicada
- ✅ Integración con Sprint 4 (no bloqueante)
- ✅ Código limpio y documentado
- ✅ Listo para Sprint 6 (Caja y Cierre Diario)

---

## 🔒 Seguridad y Auditoría

### Principios Aplicados

1. ✅ **Nunca editar movimientos financieros**
   - No hay endpoints PUT/DELETE para `account_movements`
   - Los movimientos son inmutables

2. ✅ **Nunca recalcular balances manualmente**
   - El balance siempre se calcula desde movimientos
   - El cache se actualiza automáticamente (trigger)

3. ✅ **Todo saldo se deriva de movimientos**
   - La fuente de verdad es `account_movements`
   - `accounts.balance` es solo cache

4. ✅ **Todo es auditable**
   - Todos los movimientos quedan registrados
   - Cada movimiento tiene referencia a su origen

5. ✅ **Multi-tenant estricto**
   - Todas las queries filtran por `tenant_id`
   - Validaciones en todos los endpoints

---

**Fin del documento**
