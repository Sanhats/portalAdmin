# ✅ SPRINT 6 — Caja, Ingresos y Cierre Diario

**Fecha:** Enero 2025  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo del Sprint

Implementar el sistema de caja diaria y cierre, permitiendo:

- ✅ Apertura y cierre de caja
- ✅ Registro de ingresos por método de pago
- ✅ Asociación de pagos a caja y vendedor
- ✅ Cierre diario inmutable
- ✅ Detección de descuadres
- ✅ Base sólida para reportes y auditoría

**⚠️ NO incluye:** Frontend, reportes avanzados, AFIP/facturación fiscal, egresos de caja

---

## 📋 Entregables Completados

### 1. **Caja (Cash Registers)**

**Tabla `cash_registers` creada:**
```sql
cash_registers {
  id              UUID (PK)
  tenant_id       UUID (FK stores)
  seller_id       UUID (FK sellers)
  opened_at       TIMESTAMP
  closed_at       TIMESTAMP (nullable)
  opening_amount  NUMERIC(15,2) DEFAULT 0
  closing_amount  NUMERIC(15,2) -- declarado por el vendedor
  status          TEXT ('open' | 'closed')
  created_at      TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ Solo una caja abierta por vendedor y tenant (constraint único)
- ✅ No se puede cerrar si ya está cerrada
- ✅ No se puede reabrir una caja cerrada
- ✅ Caja cerrada es inmutable
- ✅ Vendedor debe existir y estar activo

**Índices:**
- ✅ Por tenant, seller, status, fecha
- ✅ Constraint único para caja abierta (tenant, seller)

### 2. **Modificación de Pagos (Payments Sprint 5)**

**Tabla `payments_sprint5` actualizada:**
```sql
payments_sprint5 {
  ...
  cash_register_id UUID (FK cash_registers, nullable) -- SPRINT 6
  seller_id        UUID (FK sellers) -- SPRINT 6
}
```

**Reglas implementadas:**
- ✅ Todo pago registrado DEBE pertenecer a una caja abierta
- ✅ El vendedor del pago debe coincidir con la caja
- ✅ No se pueden mover pagos entre cajas
- ✅ Validación obligatoria antes de crear pago

### 3. **Cierres de Caja (Cash Closures)**

**Tabla `cash_closures` creada:**
```sql
cash_closures {
  id               UUID (PK)
  tenant_id        UUID
  cash_register_id UUID (FK cash_registers)
  total_cash       NUMERIC(15,2)
  total_transfer   NUMERIC(15,2)
  total_card       NUMERIC(15,2)
  total_other      NUMERIC(15,2)
  total_income     NUMERIC(15,2)
  difference       NUMERIC(15,2) -- closing_amount - total_income
  created_at       TIMESTAMP
}
```

**Reglas implementadas:**
- ✅ Se genera automáticamente al cerrar la caja
- ✅ Nunca se edita ni elimina (inmutable)
- ✅ Fuente de verdad: `payments_sprint5`
- ✅ Totales calculados desde pagos registrados
- ✅ Diferencia = `closing_amount - total_income` (descuadre)

---

## 🔌 Endpoints Implementados

### Caja

#### `POST /api/cash-registers/open`
Abre una nueva caja para un vendedor.

**Body:**
```json
{
  "sellerId": "uuid",
  "openingAmount": 1000
}
```

**Validaciones:**
- ✅ Vendedor debe existir y estar activo
- ✅ No puede haber caja abierta para el mismo vendedor
- ✅ `openingAmount` no negativo (default: 0)

**Response:** Caja creada con relaciones (201)

#### `GET /api/cash-registers/open?sellerId=xxx`
Obtiene la caja abierta de un vendedor.

**Query params:**
- `sellerId` (requerido)
- `tenantId` (opcional, puede venir en header)

**Response:** Caja abierta con relaciones o 404 si no hay caja abierta

#### `GET /api/cash-registers/:id`
Obtiene una caja por ID.

**Response:** Caja completa con relaciones

#### `POST /api/cash-registers/:id/close`
Cierra una caja y genera el cierre.

**Body:**
```json
{
  "closingAmount": 15200
}
```

**Proceso:**
1. Valida que la caja esté abierta
2. Calcula ingresos reales desde `payments_sprint5`
3. Calcula totales por método de pago
4. Genera `cash_closures` (inmutable)
5. Calcula diferencia (`closing_amount - total_income`)
6. Marca caja como `closed`

**Response:** Caja cerrada con cierre generado

**Validaciones:**
- ✅ Solo se puede cerrar si `status === 'open'`
- ✅ Si falla algo, no se cierra nada (rollback)

### Cierres

#### `GET /api/cash-closures/:cashRegisterId`
Obtiene el cierre de una caja.

**Response:** Cierre completo con relaciones a caja y vendedor

---

## 🛠️ Helpers Implementados

### `src/lib/cash-helpers-sprint6.ts`

#### `openCashRegister(sellerId: string, tenantId: string, openingAmount: number = 0)`
Abre una caja para un vendedor.

**Returns:** `{ cashRegisterId: string, error?: string }`

#### `getOpenCashRegister(sellerId: string, tenantId: string)`
Obtiene la caja abierta de un vendedor.

**Returns:** `{ cashRegister: any | null, error?: string }`

#### `calculateCashTotals(cashRegisterId: string)`
Calcula los totales de una caja desde los pagos registrados.

**Returns:** `CashTotals` con totales por método y total general

#### `closeCashRegister(cashRegisterId: string, tenantId: string, closingAmount: number)`
Cierra una caja y genera el cierre.

**Proceso:**
1. Valida estado de caja
2. Calcula totales desde pagos
3. Crea cierre (inmutable)
4. Cierra caja

**Returns:** `{ success: boolean, error?: string, closure?: any }`

#### `validatePaymentCashRegister(sellerId: string, tenantId: string)`
Valida que un pago pueda asociarse a una caja.

**Returns:** `{ valid: boolean, cashRegisterId?: string, error?: string }`

---

## 🔄 Integración con Sprint 5

### Modificación en `POST /api/payments`

**Cambios aplicados:**
- ✅ Requiere `sellerId` en el body
- ✅ Valida que haya caja abierta para el vendedor
- ✅ Asocia automáticamente `cash_register_id` y `seller_id`
- ✅ Si no hay caja abierta → Error descriptivo

**Validación:**
```typescript
// SPRINT 6: Validar que haya caja abierta para el vendedor
const cashValidation = await validatePaymentCashRegister(parsed.data.sellerId, tenantId);
if (!cashValidation.valid) {
  return errorResponse(cashValidation.error || "No se puede registrar pago sin caja abierta", 400);
}
```

---

## 📊 Validaciones Implementadas

### Caja
- ✅ Solo una caja abierta por vendedor y tenant
- ✅ Vendedor debe existir y estar activo
- ✅ No se puede cerrar si ya está cerrada
- ✅ No se puede reabrir una caja cerrada
- ✅ Caja cerrada es inmutable (no hay endpoints PUT/DELETE)

### Pagos
- ✅ **Requiere caja abierta** (SPRINT 6)
- ✅ **Requiere sellerId** (SPRINT 6)
- ✅ El vendedor del pago debe coincidir con la caja
- ✅ No se pueden mover pagos entre cajas

### Cierres
- ✅ Se generan automáticamente al cerrar
- ✅ Nunca se editan ni eliminan (inmutable)
- ✅ Totales siempre desde `payments_sprint5`

---

## 🗄️ Migración SQL

**Archivo:** `migrations/sprint6_cash_registers.sql`

**Cambios aplicados:**
1. ✅ Crear tabla `cash_registers`
2. ✅ Crear tabla `cash_closures`
3. ✅ Modificar `payments_sprint5` (agregar `cash_register_id` y `seller_id`)
4. ✅ Crear índices y constraints
5. ✅ Constraint único para caja abierta (tenant, seller)
6. ✅ Función `calculate_cash_totals()`
7. ✅ Función `has_open_cash_register()`

---

## 🔄 Flujo Completo de Caja

### 1. Apertura de Caja
```
POST /api/cash-registers/open
{
  "sellerId": "uuid",
  "openingAmount": 1000
}
→ Valida vendedor activo
→ Valida que no haya caja abierta
→ Crea caja con status: open
```

### 2. Registrar Pago (modificado Sprint 5)
```
POST /api/payments
{
  "customerId": "uuid",
  "sellerId": "uuid", // SPRINT 6: Requerido
  "amount": 500,
  "method": "cash"
}
→ Valida caja abierta para vendedor
→ Asocia cash_register_id automáticamente
→ Crea pago con caja asociada
→ Genera movimiento credit en cuenta corriente
```

### 3. Cierre de Caja
```
POST /api/cash-registers/:id/close
{
  "closingAmount": 15200
}
→ Valida caja abierta
→ Calcula totales desde payments
→ Genera cash_closures (inmutable)
→ Calcula diferencia
→ Marca caja como closed
```

### 4. Consultar Cierre
```
GET /api/cash-closures/:cashRegisterId
→ Obtiene cierre con totales y diferencia
```

---

## 🧪 Criterios de Aceptación

### ✅ Completados

1. ✅ Se puede abrir caja para un vendedor
2. ✅ Registrar pagos asociados a caja
3. ✅ Cerrar caja correctamente
4. ✅ Diferencia calculada correctamente (`closing_amount - total_income`)
5. ✅ Caja cerrada no se puede modificar (inmutable)
6. ✅ Auditoría completa (todos los pagos quedan asociados a caja)
7. ✅ Nada de Sprint 4 o 5 se rompe
8. ✅ Multi-tenant funcionando en todos los endpoints

---

## 📝 Notas de Implementación

### Inmutabilidad de Cierres
- ✅ **No hay endpoints PUT/DELETE para `cash_closures`**
- ✅ Los cierres son inmutables por diseño
- ✅ Si hay error en el cierre, se hace rollback completo

### Inmutabilidad de Cajas Cerradas
- ✅ **No hay endpoints PUT/DELETE para `cash_registers` cuando están cerradas**
- ✅ Las cajas cerradas son inmutables por diseño
- ✅ Solo se pueden consultar, no modificar

### Cálculo de Totales
- ✅ Los totales siempre se calculan desde `payments_sprint5`
- ✅ La caja es un agregador, no fuente de verdad
- ✅ Función SQL `calculate_cash_totals()` disponible

### Integración con Sprint 5
- ✅ El endpoint de pagos ahora requiere caja abierta
- ✅ Los pagos se asocian automáticamente a la caja
- ✅ No se rompe la funcionalidad de cuentas corrientes

---

## 🚀 Preparación para Próximos Sprints

Este sprint deja preparado:

- ✅ Base para reportes de caja
- ✅ Base para cierre diario consolidado
- ✅ Base para auditoría de ingresos
- ✅ Base para egresos de caja (futuro)

**No implementado todavía:**
- ❌ Egresos de caja
- ❌ Cierre diario consolidado (múltiples vendedores)
- ❌ Reportes avanzados
- ❌ Frontend

---

## ✅ Estado Final

**Sprint 6 completado exitosamente.**

- ✅ Todas las entidades implementadas
- ✅ Todos los endpoints funcionando
- ✅ Validaciones completas
- ✅ Helpers reutilizables
- ✅ Migración aplicada
- ✅ Integración con Sprint 5 (no bloqueante)
- ✅ Código limpio y documentado
- ✅ Listo para Sprint 7 (Reportes y Analytics)

---

## 🔒 Seguridad y Auditoría

### Principios Aplicados

1. ✅ **Nunca editar cierres**
   - No hay endpoints PUT/DELETE para `cash_closures`
   - Los cierres son inmutables

2. ✅ **Nunca recalcular ingresos manualmente**
   - Los totales siempre se calculan desde `payments_sprint5`
   - La caja es agregador, no fuente de verdad

3. ✅ **Todo ingreso viene de payments**
   - No hay ingresos manuales fuera del sistema de pagos
   - Todos los pagos quedan asociados a caja

4. ✅ **Caja = agregador, no fuente de verdad**
   - Los totales se calculan desde pagos
   - El cierre es un snapshot inmutable

5. ✅ **Todo es auditable e inmutable**
   - Cierres inmutables
   - Cajas cerradas inmutables
   - Trazabilidad completa

6. ✅ **Multi-tenant estricto**
   - Todas las queries filtran por `tenant_id`
   - Validaciones en todos los endpoints

---

**Fin del documento**
