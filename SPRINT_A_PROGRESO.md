# 🟦 SPRINT A — Consolidación de Ventas Internas - Progreso

## ✅ Completado

### 1. Estados de venta extendidos
- ✅ Schema actualizado con nuevos estados: `in_progress`, `completed`, `refunded`
- ✅ Constraint de base de datos actualizado para incluir todos los estados
- ✅ Archivo de constantes creado (`src/lib/sale-constants.ts`) con funciones de validación
- ✅ Estados existentes preservados: `draft`, `confirmed`, `cancelled`, `paid`

### 2. Snapshot de productos vendidos
- ✅ Schema de `sale_items` actualizado con campos de snapshot:
  - `product_name` - Nombre del producto al momento de la venta
  - `product_sku` - SKU del producto al momento de la venta
  - `variant_name` - Nombre de la variante si aplica
  - `variant_value` - Valor de la variante si aplica
  - `unit_cost` - Costo unitario para cálculo de margen
  - `unit_tax` - Impuesto unitario
  - `unit_discount` - Descuento unitario
  - `stock_impacted` - Cantidad de stock que se descontó
- ✅ Helper function `getProductSnapshot()` creada
- ✅ Helper function `prepareSaleItems()` creada para preparar items con snapshot
- ✅ Endpoint POST /api/sales actualizado para guardar snapshot

### 3. Totales persistidos
- ✅ Schema de `sales` actualizado con campos:
  - `subtotal` - Subtotal sin impuestos ni descuentos
  - `taxes` - Total de impuestos
  - `discounts` - Total de descuentos
  - `cost_amount` - Costo total para cálculo de margen
- ✅ Helper function `calculateSaleTotals()` creada
- ✅ Endpoint POST /api/sales actualizado para calcular y persistir totales

### 4. Migración SQL
- ✅ Archivo `drizzle/migration_sprint_a_consolidation.sql` creado
- ✅ Incluye inicialización de datos existentes
- ✅ Comentarios de documentación incluidos

## 🔄 Pendiente

### 3. Control de stock por venta (consolidación)
- ⏳ Verificar que el endpoint de confirmación guarde `stock_impacted` en `sale_items`
- ⏳ Actualizar endpoint de cancelación para usar `stock_impacted` del snapshot
- ⏳ Verificar que los movimientos de stock se registren correctamente

### Actualizaciones de endpoints
- ⏳ Actualizar endpoint PUT /api/sales/:id para usar nuevos helpers
- ⏳ Actualizar endpoint POST /api/sales/:id/confirm para guardar snapshot completo
- ⏳ Actualizar endpoint GET /api/sales/:id para incluir nuevos campos en la respuesta

### Validaciones
- ⏳ Actualizar validaciones para permitir estados `in_progress`, `completed`, `refunded`
- ⏳ Actualizar lógica de transiciones de estado

## 📝 Notas

- Los estados existentes (`draft`, `confirmed`, `cancelled`, `paid`) siguen funcionando
- El snapshot se guarda automáticamente al crear una venta
- Los totales se calculan automáticamente si no se proporcionan
- La migración SQL es idempotente (se puede ejecutar múltiples veces sin problemas)

## 🚀 Próximos pasos

1. Ejecutar la migración SQL en la base de datos
2. Actualizar endpoints restantes para usar los nuevos helpers
3. Probar el flujo completo de creación de ventas con snapshot
4. Verificar que el control de stock funcione correctamente con `stock_impacted`

