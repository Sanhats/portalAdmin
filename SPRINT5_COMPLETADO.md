# ✅ SPRINT 5 — Actualización y Stock - COMPLETADO

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo

Que el stock sea fuente de verdad con validaciones estrictas y registro de movimientos.

---

## ✅ Endpoints Implementados

### 1. **PATCH /api/products/:id**

**Ruta:** `PATCH /api/products/:id`

**Descripción:** Actualización parcial de producto con validación de stock no negativo.

**Body (JSON):**
```json
{
  "stock": 50,
  "price": 15000,
  "nameInternal": "Nuevo nombre interno",
  "isActive": true,
  "isVisible": false
}
```

**Validaciones:**
- ✅ Stock no puede ser negativo
- ✅ Todos los campos son opcionales (actualización parcial)
- ✅ Valida campos del SPRINT 1/2 (nameInternal, isActive, isVisible)

**Respuesta exitosa (200):**
```json
{
  "id": "...",
  "sku": "PROD-001",
  "name_internal": "Nuevo nombre interno",
  "price": "15000",
  "stock": 50,
  "is_active": true,
  "is_visible": false,
  ...
}
```

**Errores:**
- `400`: ID inválido, datos inválidos, o stock negativo
- `404`: Producto no encontrado
- `500`: Error del servidor

---

### 2. **PATCH /api/products/:id/stock**

**Ruta:** `PATCH /api/products/:id/stock`

**Descripción:** Actualizar solo el stock del producto. Endpoint específico para gestión de inventario.

**Body (JSON):**
```json
{
  "stock": 75,
  "reason": "Ajuste de inventario"
}
```

**Campos:**
- `stock` (requerido): Nuevo valor de stock (número entero no negativo)
- `reason` (opcional): Razón del cambio (máx. 255 caracteres)

**Validaciones:**
- ✅ Stock no puede ser negativo
- ✅ Stock debe ser un número entero
- ✅ Registra movimiento en `stock_movements` (si la tabla existe)

**Respuesta exitosa (200):**
```json
{
  "id": "...",
  "sku": "PROD-001",
  "name_internal": "Producto",
  "stock": 75,
  "price": "15000",
  "is_active": true,
  "is_visible": false,
  "stockChange": {
    "previous": 50,
    "current": 75,
    "difference": 25
  }
}
```

**Errores:**
- `400`: ID inválido, stock negativo, o datos inválidos
- `404`: Producto no encontrado
- `500`: Error del servidor

---

## 🔒 Reglas Implementadas

### **No Permitir Stock Negativo**

- ✅ Validación en ambos endpoints (PATCH /products/:id y PATCH /products/:id/stock)
- ✅ Validación en schema Zod (`.min(0)`)
- ✅ Validación adicional en el código antes de actualizar
- ✅ Mensaje de error claro: "El stock no puede ser negativo"

### **Registrar Movimientos (Opcional)**

- ✅ Tabla `stock_movements` creada en el schema
- ✅ Registro automático de movimientos en PATCH /products/:id/stock
- ✅ Campos registrados:
  - `previous_stock`: Stock anterior
  - `new_stock`: Stock nuevo
  - `difference`: Diferencia (positivo = entrada, negativo = salida)
  - `reason`: Razón del cambio (opcional)
  - `created_at`: Fecha del movimiento

**Nota:** El registro de movimientos es opcional y no falla si la tabla no existe (solo loguea un warning).

### **Preparado para Ventas Futuras**

- ✅ Tabla `stock_movements` lista para registrar ventas
- ✅ Campo `difference` permite identificar entradas/salidas
- ✅ Campo `reason` permite categorizar movimientos (venta, compra, ajuste, etc.)
- ✅ Índices creados para consultas rápidas por producto y fecha

---

## 📦 Estructura de Datos

### **Tabla `stock_movements`**

```sql
{
  id: UUID (PK)
  product_id: UUID (FK → products.id, cascade delete)
  previous_stock: INTEGER (NOT NULL)
  new_stock: INTEGER (NOT NULL)
  difference: INTEGER (NOT NULL)  -- positivo = entrada, negativo = salida
  reason: TEXT (nullable)         -- "venta", "compra", "ajuste", etc.
  created_at: TIMESTAMP (default: NOW())
}
```

**Índices:**
- `stock_movements_product_id_idx` - Para búsquedas por producto
- `stock_movements_created_at_idx` - Para consultas por fecha

---

## ✅ Criterio de Éxito

- ✅ **Stock como fuente de verdad**
  - Validación estricta: no permite stock negativo
  - Actualización controlada mediante endpoints específicos
  - Registro de movimientos para auditoría

- ✅ **No permitir stock negativo**
  - Validado en schema Zod
  - Validado en código antes de actualizar
  - Mensaje de error claro

- ✅ **Registrar movimientos (opcional)**
  - Tabla creada y lista
  - Registro automático en actualizaciones de stock
  - No falla si la tabla no existe (graceful degradation)

- ✅ **Preparado para ventas futuras**
  - Estructura de datos lista
  - Campo `difference` para identificar entradas/salidas
  - Campo `reason` para categorizar movimientos

---

## 📝 Ejemplos de Uso

### Actualizar stock específicamente:

```bash
PATCH /api/products/9987429d-b2cd-4bf4-8d99-0e441e136e5d/stock
{
  "stock": 100,
  "reason": "Reabastecimiento"
}
```

### Actualizar producto parcialmente:

```bash
PATCH /api/products/9987429d-b2cd-4bf4-8d99-0e441e136e5d
{
  "stock": 50,
  "price": 12000,
  "isVisible": true
}
```

### Error: Stock negativo

```bash
PATCH /api/products/9987429d-b2cd-4bf4-8d99-0e441e136e5d/stock
{
  "stock": -10
}

# Respuesta 400:
{
  "error": "El stock no puede ser negativo",
  "details": [...]
}
```

---

## 📁 Archivos Creados/Modificados

1. ✅ `src/app/api/products/[id]/route.ts` - Agregado método PATCH con validación de stock
2. ✅ `src/app/api/products/[id]/stock/route.ts` - Endpoint específico para stock (NUEVO)
3. ✅ `src/validations/product.ts` - Schema actualizado con campos del SPRINT 1/2
4. ✅ `src/db/schema.ts` - Agregada tabla `stock_movements`
5. ✅ `drizzle/migration_sprint5_stock.sql` - Migración SQL (NUEVO)

---

## 🚀 Próximos Pasos

1. **Ejecutar migración SQL:**
   ```sql
   -- Ejecutar en Supabase SQL Editor:
   -- drizzle/migration_sprint5_stock.sql
   ```

2. **Probar los endpoints:**
   - Probar PATCH /api/products/:id
   - Probar PATCH /api/products/:id/stock
   - Verificar que stock negativo sea rechazado
   - Verificar que se registren movimientos (si la tabla existe)

---

## 🎉 Estado Final

**SPRINT 5 COMPLETADO** ✅

Los endpoints permiten:
- ✅ Actualización parcial de productos (PATCH)
- ✅ Actualización específica de stock
- ✅ Validación estricta: stock no negativo
- ✅ Registro de movimientos (opcional)
- ✅ Preparado para ventas futuras

