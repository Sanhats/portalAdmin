# 🟦 SPRINT H — Inteligencia Comercial y Alertas Operativas

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo del Sprint

Convertir los datos de margen en señales accionables, permitiendo al comerciante:

- ✅ Detectar productos problemáticos
- ✅ Detectar ventas sin costos
- ✅ Mostrar alertas claras al usuario
- ✅ Tomar decisiones informadas sobre rentabilidad

**Enfoque:** Alertas operativas simples, sin complejidad contable ni fiscal.

---

## 📦 Alcance del Sprint

### ✅ INCLUYE

- ✅ Alertas de productos por margen (negativo y bajo)
- ✅ Alertas de ventas sin costos
- ✅ Endpoint unificado de alertas
- ✅ Umbral configurable de margen bajo

### ❌ NO INCLUYE

- ❌ Notificaciones externas (email, push, etc.)
- ❌ Lógica contable ni fiscal
- ❌ Alertas de stock (ya existe en otro módulo)
- ❌ Alertas de pagos pendientes (ya existe en otro módulo)

---

## 🔧 Backend — Implementación

### H.B1 — Alertas de productos por margen ✅

**Endpoint:** `GET /api/reports/alerts/products`

**Query params:**
- `lowMarginThreshold` (opcional): Umbral de margen bajo en porcentaje (default: 20)
- `from` (opcional): Fecha de inicio en formato `YYYY-MM-DD`
- `to` (opcional): Fecha de fin en formato `YYYY-MM-DD`
- `tenantId` (opcional): ID del tenant (o usar header `x-tenant-id`)

**Ejemplo de uso:**
```
GET /api/reports/alerts/products?lowMarginThreshold=15&from=2024-01-01&to=2024-12-31
```

**Respuesta:**

```json
[
  {
    "productId": "product-uuid-1",
    "productName": "Remera",
    "sku": "REM-001",
    "avgMarginPercent": -5.2,
    "avgMarginAmount": -500,
    "totalSold": 35,
    "revenue": 210000,
    "cost": 220500,
    "alertType": "NEGATIVE_MARGIN"
  },
  {
    "productId": "product-uuid-2",
    "productName": "Pantalón",
    "sku": "PAN-001",
    "avgMarginPercent": 12.5,
    "avgMarginAmount": 1500,
    "totalSold": 40,
    "revenue": 240000,
    "cost": 210000,
    "alertType": "LOW_MARGIN"
  }
]
```

**Reglas:**
- ✅ Margen negativo: `margin < 0`
- ✅ Margen bajo: `0 <= marginPercent < lowMarginThreshold`
- ✅ Ordenado por margen ascendente (peores primero)
- ✅ Solo productos con ventas (`totalSold > 0`)

**Tipos de alerta:**
- `NEGATIVE_MARGIN`: Producto con margen negativo (pérdida)
- `LOW_MARGIN`: Producto con margen bajo pero positivo

---

### H.B2 — Alertas de ventas sin costos ✅

**Endpoint:** `GET /api/reports/alerts/sales-without-cost`

**Query params:**
- `from` (opcional): Fecha de inicio en formato `YYYY-MM-DD`
- `to` (opcional): Fecha de fin en formato `YYYY-MM-DD`
- `tenantId` (opcional): ID del tenant (o usar header `x-tenant-id`)

**Ejemplo de uso:**
```
GET /api/reports/alerts/sales-without-cost?from=2024-01-01&to=2024-12-31
```

**Respuesta:**

```json
[
  {
    "saleId": "sale-uuid",
    "saleDate": "2024-01-10",
    "saleStatus": "confirmed",
    "productId": "product-uuid",
    "productName": "Zapatillas",
    "productSku": "ZAP-001",
    "quantity": 1,
    "unitPrice": 50000,
    "unitCost": null,
    "productCost": null
  }
]
```

**Reglas:**
- ✅ Detecta items donde `unit_cost` es `NULL` o `0`
- ✅ Verifica que el producto tampoco tenga costo en la BD
- ✅ Solo ventas `confirmed` o `paid`
- ✅ Ordenado por fecha descendente (más recientes primero)

**Objetivo:**
- Detectar datos incompletos
- Permitir corrección desde frontend
- Mejorar calidad de datos para cálculos de margen

---

### H.B3 — Endpoint unificado de alertas ✅

**Endpoint:** `GET /api/reports/alerts`

**Query params:**
- `lowMarginThreshold` (opcional): Umbral de margen bajo (default: 20)
- `from` (opcional): Fecha de inicio en formato `YYYY-MM-DD`
- `to` (opcional): Fecha de fin en formato `YYYY-MM-DD`
- `tenantId` (opcional): ID del tenant (o usar header `x-tenant-id`)

**Ejemplo de uso:**
```
GET /api/reports/alerts?lowMarginThreshold=15
```

**Respuesta:**

```json
{
  "summary": {
    "productsWithLowMargin": 5,
    "productsWithNegativeMargin": 2,
    "salesWithoutCost": 3
  },
  "products": [
    {
      "productId": "...",
      "productName": "Remera",
      "sku": "REM-001",
      "avgMarginPercent": -5.2,
      "avgMarginAmount": -500,
      "totalSold": 35,
      "revenue": 210000,
      "cost": 220500,
      "alertType": "NEGATIVE_MARGIN"
    }
  ],
  "salesWithoutCost": [
    {
      "saleId": "...",
      "saleDate": "2024-01-10",
      "saleStatus": "confirmed",
      "productId": "...",
      "productName": "Zapatillas",
      "productSku": "ZAP-001",
      "quantity": 1,
      "unitPrice": 50000,
      "unitCost": null,
      "productCost": null
    }
  ]
}
```

**Ventajas:**
- ✅ Un solo request para obtener todas las alertas
- ✅ Resumen numérico para dashboard
- ✅ Datos completos para detalle
- ✅ Mejor performance (menos requests)

---

## 🧱 Implementación Técnica

### Helpers Reutilizados

- ✅ `getProductMargins()` - De `margin-helpers.ts`
- ✅ Cálculos de margen existentes

### Nuevos Helpers

- ✅ `getProductAlerts()` - Alertas de productos por margen
- ✅ `getSalesWithoutCost()` - Ventas sin costos
- ✅ `getAllAlerts()` - Endpoint unificado

### Performance

- ✅ Optimizado para hasta 10k ventas
- ✅ Queries eficientes con índices
- ✅ Agrupación en memoria para cálculos
- ✅ Ordenamiento eficiente

---

## 📡 Endpoints Disponibles

### 1. GET /api/reports/alerts/products

**Alertas de productos por margen**

**Query params:**
- `lowMarginThreshold` (opcional, default: 20): Porcentaje de margen bajo
- `from` (opcional): `YYYY-MM-DD`
- `to` (opcional): `YYYY-MM-DD`
- `tenantId` (opcional)

**Response:**
```json
[
  {
    "productId": "...",
    "productName": "...",
    "sku": "...",
    "avgMarginPercent": 12.5,
    "avgMarginAmount": 1500,
    "totalSold": 35,
    "revenue": 240000,
    "cost": 210000,
    "alertType": "LOW_MARGIN" | "NEGATIVE_MARGIN"
  }
]
```

### 2. GET /api/reports/alerts/sales-without-cost

**Alertas de ventas sin costos**

**Query params:**
- `from` (opcional): `YYYY-MM-DD`
- `to` (opcional): `YYYY-MM-DD`
- `tenantId` (opcional)

**Response:**
```json
[
  {
    "saleId": "...",
    "saleDate": "2024-01-10",
    "saleStatus": "confirmed",
    "productId": "...",
    "productName": "...",
    "productSku": "...",
    "quantity": 1,
    "unitPrice": 50000,
    "unitCost": null,
    "productCost": null
  }
]
```

### 3. GET /api/reports/alerts

**Endpoint unificado de alertas**

**Query params:**
- `lowMarginThreshold` (opcional, default: 20)
- `from` (opcional): `YYYY-MM-DD`
- `to` (opcional): `YYYY-MM-DD`
- `tenantId` (opcional)

**Response:**
```json
{
  "summary": {
    "productsWithLowMargin": 5,
    "productsWithNegativeMargin": 2,
    "salesWithoutCost": 3
  },
  "products": [...],
  "salesWithoutCost": [...]
}
```

---

## 🔐 Seguridad

- ✅ Todos los endpoints requieren autenticación Bearer token
- ✅ Multi-tenant: filtrado por `tenant_id`
- ✅ Validación de parámetros (fechas, umbrales)
- ✅ Solo ventas confirmadas/pagadas se analizan

---

## 📊 Casos de Uso

### Caso 1: Detectar productos problemáticos

```typescript
// Obtener productos con margen bajo o negativo
const response = await fetch(
  `/api/reports/alerts/products?lowMarginThreshold=15`,
  { headers: { Authorization: `Bearer ${token}` } }
);

const alerts = await response.json();

// Mostrar alertas en dashboard
alerts.forEach(alert => {
  if (alert.alertType === "NEGATIVE_MARGIN") {
    console.warn(`⚠️ ${alert.productName} tiene margen negativo: ${alert.avgMarginPercent}%`);
  } else if (alert.alertType === "LOW_MARGIN") {
    console.info(`ℹ️ ${alert.productName} tiene margen bajo: ${alert.avgMarginPercent}%`);
  }
});
```

### Caso 2: Detectar ventas sin costos

```typescript
// Obtener ventas sin costos
const response = await fetch(
  `/api/reports/alerts/sales-without-cost`,
  { headers: { Authorization: `Bearer ${token}` } }
);

const salesWithoutCost = await response.json();

// Mostrar lista para corrección
salesWithoutCost.forEach(sale => {
  console.log(`Venta ${sale.saleId}: ${sale.productName} sin costo`);
  // Frontend puede permitir editar el costo de la venta
});
```

### Caso 3: Dashboard de alertas

```typescript
// Obtener todas las alertas en un solo request
const response = await fetch(
  `/api/reports/alerts`,
  { headers: { Authorization: `Bearer ${token}` } }
);

const alerts = await response.json();

// Mostrar resumen
console.log(`Resumen de alertas:`);
console.log(`- Productos con margen bajo: ${alerts.summary.productsWithLowMargin}`);
console.log(`- Productos con margen negativo: ${alerts.summary.productsWithNegativeMargin}`);
console.log(`- Ventas sin costo: ${alerts.summary.salesWithoutCost}`);

// Mostrar detalles
alerts.products.forEach(product => {
  // Mostrar en tabla de productos problemáticos
});

alerts.salesWithoutCost.forEach(sale => {
  // Mostrar en lista de ventas a corregir
});
```

---

## ⚠️ Consideraciones Importantes

### Umbral de Margen Bajo

- **Default:** 20%
- **Configurable:** El usuario puede ajustar según su negocio
- **Recomendación:** Ajustar según industria (retail: 20-30%, servicios: 40-50%)

### Ventas sin Costo

- Se detectan items donde:
  - `sale_items.unit_cost` es `NULL` o `0`
  - Y `products.cost` también es `NULL` o `0`
- **Objetivo:** Permitir completar datos faltantes

### Performance

- Optimizado para hasta 10k ventas
- Si hay más ventas, considerar paginación o filtros de fecha más estrictos
- Los cálculos se hacen en memoria después de obtener datos de BD

---

## 📝 Archivos Creados

### Nuevos Archivos

- `src/lib/alert-helpers.ts` - Helpers para alertas
- `src/app/api/reports/alerts/products/route.ts` - Endpoint de alertas de productos
- `src/app/api/reports/alerts/sales-without-cost/route.ts` - Endpoint de ventas sin costo
- `src/app/api/reports/alerts/route.ts` - Endpoint unificado
- `SPRINT_H_ALERTAS_INTELIGENCIA.md` - Documentación

---

## ✅ Checklist de Implementación

- [x] Helper para alertas de productos por margen
- [x] Helper para alertas de ventas sin costos
- [x] Helper para endpoint unificado
- [x] Endpoint GET /api/reports/alerts/products
- [x] Endpoint GET /api/reports/alerts/sales-without-cost
- [x] Endpoint GET /api/reports/alerts (unificado)
- [x] Umbral configurable de margen bajo
- [x] Filtrado por rango de fechas
- [x] Multi-tenant respetado
- [x] Autenticación requerida
- [x] Validación de parámetros
- [x] Documentación completa

---

## 🎯 Próximos Pasos (Frontend)

### Dashboard de Alertas

- Mostrar resumen numérico de alertas
- Lista de productos problemáticos
- Lista de ventas sin costo
- Filtros y ordenamiento

### Visualización de Alertas

- **Productos:**
  - Tabla con productos y sus márgenes
  - Indicadores visuales (rojo para negativo, amarillo para bajo)
  - Acción: Ver detalle del producto o editar precio/costo

- **Ventas sin costo:**
  - Lista de ventas con items sin costo
  - Acción: Editar costo de la venta o producto

### Acciones Sugeridas

- Completar costos faltantes
- Ajustar precios de productos con bajo margen
- Revisar productos con margen negativo
- Analizar tendencias de margen

---

## 🎉 Estado Final

**✅ SPRINT H COMPLETADO**

- ✅ Backend implementado
- ✅ Endpoints funcionando
- ✅ Alertas correctamente categorizadas
- ✅ Documentación completa

**Listo para:**
- ✅ Integración con frontend
- ✅ Dashboard de alertas
- ✅ Visualización de productos problemáticos
- ✅ Corrección de datos incompletos

---

**Fecha:** Diciembre 2024  
**Siguiente paso:** Implementar frontend para visualización de alertas
