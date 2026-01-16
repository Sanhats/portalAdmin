# Sprint I — Inteligencia comercial y contexto

## 🎯 Objetivo

Proveer contexto histórico y sugerencias para que el frontend pueda guiar decisiones, sin automatizar ni imponer reglas.

## 📦 Entregables

### I.B1 — Historial de costos por producto

**Endpoint:** `GET /api/products/:id/cost-history`

**Funcionalidad:**
Devuelve la evolución del costo del producto basada en compras recibidas.

**Respuesta esperada:**
```json
[
  {
    "date": "2024-01-10",
    "purchaseId": "...",
    "purchaseDate": "2024-01-10T10:30:00Z",
    "quantity": 10,
    "unitCost": 1500,
    "avgCostAfter": 1500,
    "supplierName": "Proveedor ABC"
  },
  {
    "date": "2024-02-05",
    "purchaseId": "...",
    "purchaseDate": "2024-02-05T14:20:00Z",
    "quantity": 20,
    "unitCost": 1800,
    "avgCostAfter": 1700,
    "supplierName": "Proveedor ABC"
  }
]
```

**Reglas:**
- Ordenado por fecha ascendente
- Solo compras con status `received`
- Multi-tenant (validación de tenant_id)
- Read-only (no modifica datos)
- Calcula costo promedio ponderado después de cada compra
- Incluye nombre del proveedor cuando está disponible

**Autenticación:**
- Requiere Bearer token
- Valida que el producto pertenezca al tenant

**Errores:**
- `404`: Producto no encontrado
- `403`: El producto no pertenece al tenant
- `401`: No autorizado

---

### I.B2 — Sugerencia de precio por margen objetivo

**Endpoint:** `GET /api/products/:id/price-suggestion`

**Query params:**
- `targetMargin` (opcional, default: 20) - Margen objetivo en porcentaje (0-100)

**Respuesta:**
```json
{
  "currentCost": 1700,
  "currentPrice": 2000,
  "currentMarginPercent": 15.0,
  "targetMarginPercent": 20,
  "suggestedPrice": 2125,
  "difference": 125
}
```

**Reglas:**
- No guarda nada (read-only)
- No modifica precios
- Es solo informativo
- Usa costo actual del producto (`products.cost`)
- Si el producto no tiene costo, devuelve `currentCost: null` y mantiene el precio actual
- Fórmula de precio sugerido: `precio = costo / (1 - margen_objetivo / 100)`
- Ejemplo: costo = 1000, margen = 20% → precio = 1000 / 0.80 = 1250

**Autenticación:**
- Requiere Bearer token
- Valida que el producto pertenezca al tenant

**Errores:**
- `404`: Producto no encontrado
- `403`: El producto no pertenece al tenant
- `400`: targetMargin inválido (debe ser entre 0 y 100)
- `401`: No autorizado

---

### I.B3 — Contexto de alerta (causa raíz)

**Endpoint:** `GET /api/reports/alerts/context`

**Query params:**
- `productId` (requerido) - UUID del producto
- `alertType` (requerido) - Tipo de alerta: `LOW_MARGIN` o `NEGATIVE_MARGIN`
- `tenantId` (opcional) - Si no se proporciona, usa store por defecto

**Funcionalidad:**
Explica por qué existe una alerta, analizando el historial de costos y precios.

**Ejemplo de respuesta:**
```json
{
  "productId": "...",
  "productName": "Remera",
  "alertType": "LOW_MARGIN",
  "reason": "COST_INCREASE",
  "details": {
    "previousCost": 1500,
    "currentCost": 1700,
    "variationPercent": 13.3,
    "lastPurchaseDate": "2024-02-05",
    "suggestedPrice": 2125
  }
}
```

**Tipos de `reason`:**
- `COST_INCREASE`: El costo aumentó significativamente (>5%) y el precio no se actualizó
- `PRICE_NOT_UPDATED`: El precio no se actualizó después de compras recientes
- `MISSING_COST`: El producto no tiene costo cargado
- `NEGATIVE_MARGIN`: El margen es negativo (precio < costo)
- `UNKNOWN`: No se pudo determinar la causa (caso raro)

**Lógica de determinación de razón:**
1. Si no hay costo → `MISSING_COST`
2. Si `alertType === "NEGATIVE_MARGIN"` → `NEGATIVE_MARGIN`
3. Si hay historial de costos:
   - Compara costo actual con costo anterior
   - Si variación > 5% → `COST_INCREASE`
   - Si variación ≤ 5% → `PRICE_NOT_UPDATED`
4. Si no hay historial suficiente → `PRICE_NOT_UPDATED`

**Autenticación:**
- Requiere Bearer token
- Valida que el producto pertenezca al tenant

**Errores:**
- `404`: Producto no encontrado
- `403`: El producto no pertenece al tenant
- `400`: Parámetros inválidos (productId o alertType faltantes/inválidos)
- `401`: No autorizado

---

## 🧱 Implementación técnica

### Archivos creados/modificados

1. **`src/lib/cost-history-helpers.ts`** (nuevo)
   - `getProductCostHistory()`: Obtiene historial de costos basado en compras recibidas
   - `getPriceSuggestion()`: Calcula sugerencia de precio por margen objetivo
   - `getAlertContext()`: Analiza causa raíz de una alerta

2. **`src/app/api/products/[id]/cost-history/route.ts`** (nuevo)
   - Endpoint GET para historial de costos

3. **`src/app/api/products/[id]/price-suggestion/route.ts`** (nuevo)
   - Endpoint GET para sugerencia de precio

4. **`src/app/api/reports/alerts/context/route.ts`** (nuevo)
   - Endpoint GET para contexto de alertas

### Helpers reutilizados

- `getProductMargins()` de `src/lib/margin-helpers.ts` (usado indirectamente por alertas)
- Helpers de autenticación: `extractBearerToken()`, `validateBearerToken()`
- Helpers de respuesta: `jsonResponse()`, `errorResponse()`, `handleUnexpectedError()`

### Cálculo de costo promedio ponderado

El historial de costos calcula el costo promedio después de cada compra usando la fórmula:

```
costo_promedio_despues = (stock_actual * costo_actual + cantidad_compra * costo_compra) / (stock_actual + cantidad_compra)
```

Esto simula el comportamiento del sistema de costos basado en compras recibidas.

### Cálculo de precio sugerido

Para un margen objetivo del X%, el precio sugerido se calcula como:

```
precio_sugerido = costo / (1 - X / 100)
```

Ejemplos:
- Costo: 1000, Margen: 20% → Precio: 1000 / 0.80 = 1250
- Costo: 1000, Margen: 30% → Precio: 1000 / 0.70 = 1428.57

---

## ✅ Criterios de aceptación

- [x] Historial de costos correcto y ordenado
- [x] Sugerencia de precio consistente con fórmula estándar
- [x] Contexto claro y trazable (causa raíz identificable)
- [x] Sin lógica duplicada con frontend
- [x] Sin automatismos peligrosos (todo es read-only)
- [x] Multi-tenant correctamente aplicado
- [x] Validación de autenticación y permisos
- [x] Manejo de errores apropiado

---

## 🔄 Flujo de uso típico

1. **Frontend detecta alerta de margen bajo:**
   - Llama a `GET /api/reports/alerts/products` (Sprint H)
   - Obtiene lista de productos con alertas

2. **Frontend quiere entender la causa:**
   - Para cada producto con alerta, llama a `GET /api/reports/alerts/context?productId=...&alertType=LOW_MARGIN`
   - Recibe la razón y detalles

3. **Frontend quiere ver historial:**
   - Llama a `GET /api/products/:id/cost-history`
   - Muestra gráfico o tabla de evolución de costos

4. **Frontend quiere sugerencia de precio:**
   - Llama a `GET /api/products/:id/price-suggestion?targetMargin=20`
   - Muestra sugerencia al usuario
   - Usuario decide si actualizar el precio manualmente

---

## 📝 Notas importantes

- **Read-only**: Todos los endpoints son de solo lectura. No modifican datos.
- **No automatismos**: El frontend debe tomar las decisiones. El backend solo provee información.
- **Performance**: Los endpoints están optimizados para consultas rápidas, pero pueden ser lentos con muchos productos/compras. Considerar paginación o caching en el futuro si es necesario.
- **Compatibilidad**: Compatible con todos los sprints anteriores (ERP, Margen, Alertas).

---

## 🚀 Próximos pasos sugeridos

1. **Frontend**: Integrar estos endpoints en la UI de alertas
2. **Testing**: Crear script de pruebas para validar los cálculos
3. **Mejoras futuras**:
   - Caching de sugerencias de precio
   - Historial de precios (similar al historial de costos)
   - Alertas proactivas cuando el costo aumenta significativamente
