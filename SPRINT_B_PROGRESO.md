# 🟦 SPRINT B — Normalización de Pagos (Pre-Gateway) - Progreso

## ✅ Completado

### 1. Clasificación de métodos de pago ✅
- ✅ Campo `payment_category` agregado a `payment_methods` ('manual' | 'gateway')
- ✅ Migración SQL que clasifica métodos existentes automáticamente
- ✅ Validaciones actualizadas para aceptar `paymentCategory`
- ✅ Endpoints POST y PUT actualizados para manejar `payment_category`
- ✅ Inferencia automática de `payment_category` basada en `type` si no se proporciona

### 2. Reglas por tipo ✅
- ✅ Helper function `getInitialPaymentStatus()` creada
- ✅ Reglas implementadas:
  - `manual`: puede confirmarse instantáneamente (confirmed)
  - `gateway`: siempre inicia en pending
- ✅ Endpoint POST /api/sales/:id/payments actualizado:
  - El backend decide el estado inicial, no el frontend
  - Valida que gateway no pueda iniciar en confirmed
  - Respeta el estado proporcionado solo si es compatible

### 3. Registro de intención de pago ✅
- ✅ Tabla `payment_intents` creada con campos:
  - `sale_id`, `tenant_id`, `amount`, `gateway`
  - `status` (created, processing, completed, failed)
  - `expires_at`, `external_reference`, `gateway_metadata`
  - `payment_id` (FK al pago creado)
- ✅ Endpoints creados:
  - GET /api/payment-intents - Listar intenciones
  - POST /api/payment-intents - Crear intención
  - GET /api/payment-intents/:id - Obtener intención
  - PUT /api/payment-intents/:id - Actualizar intención
- ✅ Validaciones creadas (`createPaymentIntentSchema`, `updatePaymentIntentSchema`)
- ✅ Índices creados para búsquedas rápidas

### 4. Idempotencia real ✅
- ✅ Campo `idempotency_key` agregado a `payments`
- ✅ Helper function `generateIdempotencyKey()` creada
- ✅ Hash basado en: `sale_id`, `amount`, `method`, `external_reference`
- ✅ Verificación de duplicados en POST /api/sales/:id/payments
- ✅ Si existe un pago con la misma clave, retorna el existente (200) en lugar de crear duplicado
- ✅ Índice único creado para `idempotency_key`

## 📝 Archivos Creados/Modificados

### Nuevos archivos:
- `src/lib/payment-helpers-sprint-b.ts` - Helpers para Sprint B
- `src/validations/payment-intent.ts` - Validaciones para payment_intents
- `src/app/api/payment-intents/route.ts` - Endpoints GET y POST
- `src/app/api/payment-intents/[id]/route.ts` - Endpoints GET y PUT por ID
- `drizzle/migration_sprint_b_payment_normalization.sql` - Migración SQL

### Archivos modificados:
- `src/db/schema.ts` - Schema actualizado con `payment_category`, `payment_intents`, `idempotency_key`
- `src/validations/payment-method.ts` - Validaciones actualizadas
- `src/app/api/payment-methods/route.ts` - POST actualizado para `payment_category`
- `src/app/api/payment-methods/[id]/route.ts` - PUT actualizado para `payment_category`
- `src/app/api/sales/[id]/payments/route.ts` - Reglas de tipo y idempotencia implementadas

## 🧪 Pruebas Recomendadas

1. **Crear método de pago manual:**
   ```bash
   POST /api/payment-methods
   {
     "code": "cash",
     "label": "Efectivo",
     "type": "cash",
     "paymentCategory": "manual"
   }
   ```

2. **Crear método de pago gateway:**
   ```bash
   POST /api/payment-methods
   {
     "code": "qr_mp",
     "label": "QR Mercado Pago",
     "type": "qr",
     "paymentCategory": "gateway"
   }
   ```

3. **Crear pago manual (debe iniciar en confirmed):**
   ```bash
   POST /api/sales/:id/payments
   {
     "amount": 1000,
     "paymentMethodId": "..."
   }
   ```
   Verificar que `status` sea `confirmed` automáticamente.

4. **Crear pago gateway (debe iniciar en pending):**
   ```bash
   POST /api/sales/:id/payments
   {
     "amount": 1000,
     "paymentMethodId": "..."
   }
   ```
   Verificar que `status` sea `pending` automáticamente.

5. **Probar idempotencia:**
   ```bash
   # Crear mismo pago dos veces
   POST /api/sales/:id/payments
   {
     "amount": 1000,
     "method": "cash",
     "externalReference": "TEST-123"
   }
   ```
   La segunda llamada debe retornar el mismo pago (200) en lugar de crear duplicado.

6. **Crear intención de pago:**
   ```bash
   POST /api/payment-intents
   {
     "saleId": "...",
     "amount": 1000,
     "gateway": "mercadopago",
     "expiresAt": "2024-12-31T23:59:59Z"
   }
   ```

## 🚀 Próximos Pasos

1. Ejecutar la migración SQL: `drizzle/migration_sprint_b_payment_normalization.sql`
2. Probar los endpoints con datos reales
3. Continuar con **SPRINT C - Pagos QR / POS (sin proveedor)**

## 📊 Resultado

✅ Backend preparado para cualquier gateway  
✅ Pagos manuales y automáticos separados  
✅ Idempotencia implementada para evitar duplicados  
✅ Sistema de intenciones de pago listo para Mercado Pago  
✅ Cero deuda técnica para integración de gateways

