# 🧪 Testing: Sistema de Compras - Edge Cases y Validaciones

**Fecha:** Diciembre 2024  
**Sprint:** ERP - Proveedores → Compras → Costos → Margen

---

## 📋 Flujo Completo a Probar

### 1. Flujo Happy Path

```
1. Crear Proveedor
   ↓
2. Crear Compra (DRAFT)
   ↓
3. Editar Compra (DRAFT) ✅ Permitido
   ↓
4. Confirmar Compra (DRAFT → CONFIRMED)
   ↓
5. Recibir Compra (CONFIRMED → RECEIVED)
   ↓
6. Verificar:
   - Stock actualizado
   - Costo actualizado (promedio ponderado)
   - Movimiento de stock creado
   - Movimiento de caja creado (si hay caja abierta)
```

---

## 🔍 Edge Cases a Validar

### Edge Case 1: Producto Sin Costo Previo

**Escenario:**
- Producto nuevo sin costo (`products.cost = NULL`)
- Primera compra del producto

**Comportamiento Esperado:**
- ✅ La compra se crea normalmente
- ✅ Al recibir, el costo se establece directamente con el `unitCost` de la compra
- ✅ No se calcula promedio (no hay costo previo)
- ✅ Fórmula: `costo_nuevo = unitCost_compra`

**Validación:**
```sql
-- Antes de recibir
SELECT cost FROM products WHERE id = 'product-id';
-- Resultado: NULL

-- Después de recibir compra con unitCost = 2000.00
SELECT cost FROM products WHERE id = 'product-id';
-- Resultado: 2000.00
```

---

### Edge Case 2: Producto Con Stock Cero Pero Con Costo

**Escenario:**
- Producto con `stock = 0` pero `cost = 1500.00`
- Nueva compra con `unitCost = 2000.00`

**Comportamiento Esperado:**
- ✅ Se usa el costo de la compra directamente
- ✅ No se calcula promedio (stock = 0)
- ✅ Fórmula: `costo_nuevo = unitCost_compra`

---

### Edge Case 3: Caja Cerrada

**Escenario:**
- No hay caja abierta (`cash_boxes.status = 'closed'` o no existe)
- Se recibe una compra

**Comportamiento Esperado:**
- ✅ La compra se recibe normalmente
- ✅ Stock y costos se actualizan
- ⚠️ El movimiento de caja NO se crea automáticamente
- ✅ Se puede crear manualmente después cuando se abra la caja

**Validación:**
```typescript
// En createCashMovementFromPurchase()
if (!cashBox) {
  return { created: false, reason: "No hay caja abierta" };
}
// La compra se recibe igual, solo no se crea el movimiento
```

---

### Edge Case 4: Idempotencia en Receive

**Escenario:**
- Compra en estado `received`
- Intentar recibirla nuevamente

**Comportamiento Esperado:**
- ❌ Debe fallar con error 400
- ❌ Mensaje: "La compra ya fue recibida" o similar
- ✅ No debe actualizar stock ni costos nuevamente
- ✅ No debe crear movimientos duplicados

**Validación:**
```typescript
// En canReceivePurchase()
if (purchase.status === "received") {
  return { canReceive: false, reason: "La compra ya fue recibida" };
}
```

---

### Edge Case 5: Editar Compra Confirmada

**Escenario:**
- Compra en estado `confirmed` o `received`
- Intentar editarla (PUT)

**Comportamiento Esperado:**
- ❌ Debe fallar con error 400
- ❌ Mensaje: "Solo se pueden editar compras en estado draft"
- ✅ Solo `draft` es editable

**Validación:**
```typescript
// En PUT /api/purchases/:id
if (existingPurchase.status !== "draft") {
  return errorResponse("Solo se pueden editar compras en estado draft", 400);
}
```

---

### Edge Case 6: Cancelar Compra Recibida

**Escenario:**
- Compra en estado `received`
- Intentar cancelarla (DELETE)

**Comportamiento Esperado:**
- ❌ Debe fallar con error 400
- ❌ Mensaje: "No se puede cancelar una compra que ya fue recibida"
- ✅ Solo `draft` y `confirmed` pueden cancelarse

**Validación:**
```typescript
// En DELETE /api/purchases/:id
if (existingPurchase.status === "received") {
  return errorResponse("No se puede cancelar una compra que ya fue recibida", 400);
}
```

---

### Edge Case 7: Recibir Compra en Draft

**Escenario:**
- Compra en estado `draft`
- Intentar recibirla directamente (sin confirmar)

**Comportamiento Esperado:**
- ❌ Debe fallar con error 400
- ❌ Mensaje: "La compra debe estar confirmada antes de recibirla"
- ✅ Solo `confirmed` puede recibirse

**Validación:**
```typescript
// En canReceivePurchase()
if (purchase.status === "draft") {
  return { canReceive: false, reason: "La compra debe estar confirmada antes de recibirla" };
}
```

---

### Edge Case 8: Costo Promedio Ponderado

**Escenario:**
- Producto con `stock = 20` y `cost = 1000.00`
- Compra de `quantity = 10` con `unitCost = 1500.00`

**Comportamiento Esperado:**
- ✅ Calcular promedio ponderado
- ✅ Fórmula: `(20 * 1000 + 10 * 1500) / (20 + 10) = 1166.67`
- ✅ Nuevo costo: `1166.67`
- ✅ Nuevo stock: `30`

**Validación:**
```typescript
// En calculateWeightedAverageCost()
const totalCurrentValue = 20 * 1000; // 20000
const totalPurchaseValue = 10 * 1500; // 15000
const totalStock = 20 + 10; // 30
const weightedAverageCost = (20000 + 15000) / 30; // 1166.67
```

---

### Edge Case 9: Múltiples Items en una Compra

**Escenario:**
- Compra con 3 items diferentes
- Cada item actualiza un producto diferente

**Comportamiento Esperado:**
- ✅ Todos los productos se actualizan correctamente
- ✅ Si uno falla, la compra NO se marca como `received`
- ✅ Rollback parcial (la compra queda en `confirmed` para reintentar)

**Validación:**
```typescript
// En POST /api/purchases/:id/receive
const failedUpdates = stockUpdates.filter(u => !u.success);
if (failedUpdates.length > 0) {
  // No actualizar estado de compra
  return errorResponse("Error al actualizar algunos productos", 500);
}
```

---

### Edge Case 10: Eliminar Proveedor con Compras

**Escenario:**
- Proveedor tiene compras asociadas
- Intentar eliminarlo

**Comportamiento Esperado:**
- ❌ Debe fallar con error 400
- ❌ Mensaje: "No se puede eliminar el proveedor porque tiene compras asociadas"
- ✅ Solo se puede eliminar si no tiene compras

**Validación:**
```typescript
// En DELETE /api/suppliers/:id
const { data: purchases } = await supabase
  .from("purchases")
  .select("id")
  .eq("supplier_id", params.id)
  .limit(1);

if (purchases && purchases.length > 0) {
  return errorResponse("No se puede eliminar el proveedor porque tiene compras asociadas", 400);
}
```

---

## ✅ Checklist de Validaciones

### Validaciones de Estado

- [ ] Solo `draft` puede editarse
- [ ] Solo `confirmed` puede recibirse
- [ ] Solo `draft` y `confirmed` pueden cancelarse
- [ ] No se puede recibir compra dos veces (idempotencia)
- [ ] No se puede recibir compra en `draft`

### Validaciones de Stock y Costos

- [ ] Stock se incrementa correctamente
- [ ] Costo se actualiza con promedio ponderado (si hay stock/costo previo)
- [ ] Costo se establece directamente (si no hay stock/costo previo)
- [ ] Movimientos de stock se crean con `purchase_id`
- [ ] Movimientos de stock tienen `reason` descriptivo

### Validaciones de Caja

- [ ] Movimiento de caja se crea solo si hay caja abierta
- [ ] Movimiento de caja es tipo `expense`
- [ ] Movimiento de caja tiene referencia a `purchase_id`
- [ ] Movimiento de caja tiene monto correcto

### Validaciones de Integridad

- [ ] No se puede eliminar proveedor con compras
- [ ] Foreign keys funcionan correctamente
- [ ] Soft delete en proveedores funciona
- [ ] Multi-tenant se respeta en todas las operaciones

---

## 🧪 Script de Testing

**Archivo:** `test-purchases-system.ps1`

**Uso:**
```powershell
.\test-purchases-system.ps1
```

**Cubre:**
- ✅ Flujo completo
- ✅ Edge cases principales
- ✅ Validaciones de estado
- ✅ Verificación de stock y costos
- ✅ Verificación de movimientos

---

## 📊 Casos de Prueba Recomendados

### Test Case 1: Flujo Completo Básico
1. Crear proveedor
2. Crear compra con 1 item
3. Confirmar compra
4. Recibir compra
5. Verificar stock y costo

### Test Case 2: Producto Sin Costo
1. Identificar producto sin costo
2. Crear compra para ese producto
3. Recibir compra
4. Verificar que costo se estableció

### Test Case 3: Promedio Ponderado
1. Producto con stock y costo existente
2. Crear compra con costo diferente
3. Recibir compra
4. Verificar cálculo de promedio

### Test Case 4: Idempotencia
1. Recibir compra
2. Intentar recibirla nuevamente
3. Verificar que falla

### Test Case 5: Caja Cerrada
1. Cerrar todas las cajas
2. Recibir compra
3. Verificar que compra se recibió
4. Verificar que NO se creó movimiento de caja

### Test Case 6: Múltiples Items
1. Crear compra con 3 items diferentes
2. Recibir compra
3. Verificar que todos los productos se actualizaron

---

## 🎯 Resultados Esperados

Después de ejecutar todos los tests:

- ✅ **Flujo completo:** Funciona end-to-end
- ✅ **Edge cases:** Todos manejados correctamente
- ✅ **Validaciones:** Todas las reglas de negocio respetadas
- ✅ **Integridad:** No hay inconsistencias en datos
- ✅ **Trazabilidad:** Todos los movimientos tienen referencias correctas

---

**Estado:** ✅ Listo para testing  
**Siguiente paso:** Ejecutar `test-purchases-system.ps1` y validar resultados
