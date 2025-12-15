# ✅ SPRINT 2 — Modo Carga Rápida - COMPLETADO

**Fecha:** Diciembre 2024  
**Estado:** ✅ **COMPLETADO**

---

## 🎯 Objetivo

Soportar creación ultra simple sin romper reglas.

---

## ✅ Cambios Implementados

### 1. **Defaults Inteligentes**

- ✅ **`is_visible = false` por defecto** (producto NO publicado automáticamente)
- ✅ **`is_active = true` por defecto** (producto activo)
- ✅ **`stock = 0` por defecto** (si no se especifica)

### 2. **Campos Opcionales**

- ✅ **`description`** → Opcional (puede ser null)
- ✅ **`categoryId`** → Opcional (puede ser null)
- ✅ **`stock`** → Opcional (default: 0)
- ✅ **`isActive`** → Opcional (default: true)
- ✅ **`isVisible`** → Opcional (default: false)

### 3. **Validaciones Flexibles**

- ✅ Solo campos mínimos requeridos: `sku`, `nameInternal`, `price`
- ✅ Resto de campos tienen valores por defecto inteligentes

---

## 📦 Payload Típico

### Mínimo (solo campos requeridos):
```json
{
  "sku": "ABC123",
  "nameInternal": "Remera negra M",
  "price": 12000
}
```

### Con stock:
```json
{
  "sku": "ABC123",
  "nameInternal": "Remera negra M",
  "price": 12000,
  "stock": 10
}
```

### Completo (todos los campos opcionales):
```json
{
  "sku": "ABC123",
  "nameInternal": "Remera negra M",
  "price": 12000,
  "stock": 10,
  "categoryId": "b85c7cd6-08d3-4f49-ac78-b97ecbda25bb",
  "description": "Remera de algodón negra talla M",
  "isActive": true,
  "isVisible": false
}
```

---

## 🔒 Reglas Implementadas

| Regla | Valor | Descripción |
|-------|-------|-------------|
| `is_visible` | `false` por defecto | Producto NO publicado automáticamente |
| `is_active` | `true` por defecto | Producto activo desde el inicio |
| `stock` | `0` por defecto | Stock inicial en cero si no se especifica |
| `description` | Opcional | Puede ser null o no enviarse |
| `categoryId` | Opcional | Puede ser null o no enviarse |

---

## ✅ Criterio de Éxito

- ✅ **Carga en 1 request**
  - Solo requiere 3 campos: `sku`, `nameInternal`, `price`
  - Todo lo demás tiene valores por defecto

- ✅ **No publica el producto**
  - `is_visible = false` por defecto
  - El producto queda en estado "borrador" listo para editar

- ✅ **Listo para editar después**
  - El producto se crea con `is_active = true`
  - Puede editarse con `PUT /api/products/:id`
  - Puede publicarse cambiando `is_visible = true`

---

## 📝 Ejemplo de Uso

### Crear producto (carga rápida):
```bash
POST /api/products
{
  "sku": "ABC123",
  "nameInternal": "Remera negra M",
  "price": 12000,
  "stock": 10
}
```

### Respuesta:
```json
{
  "id": "9987429d-b2cd-4bf4-8d99-0e441e136e5d",
  "sku": "ABC123",
  "name_internal": "Remera negra M",
  "price": "12000",
  "stock": 10,
  "category_id": null,
  "description": null,
  "is_active": true,
  "is_visible": false,  // ← NO publicado
  "created_at": "2024-12-15T23:15:05.185516"
}
```

### Publicar el producto después:
```bash
PUT /api/products/9987429d-b2cd-4bf4-8d99-0e441e136e5d
{
  "isVisible": true
}
```

---

## 🔄 Diferencias con SPRINT 1

| Aspecto | SPRINT 1 | SPRINT 2 |
|---------|----------|----------|
| `is_visible` default | `true` | `false` ✅ |
| `description` | No soportado | Opcional ✅ |
| Objetivo | Crear producto básico | Carga rápida sin publicar ✅ |

---

## 📁 Archivos Modificados

1. ✅ `src/validations/product-sprint1.ts` - Schema actualizado con defaults del SPRINT 2
2. ✅ `src/app/api/products/route.ts` - Endpoint actualizado con `is_visible = false` por defecto
3. ✅ `src/db/schema.ts` - Schema de Drizzle actualizado

---

## 🎉 Estado Final

**SPRINT 2 COMPLETADO** ✅

El endpoint `POST /api/products` ahora soporta carga rápida:
- ✅ Solo 3 campos requeridos
- ✅ Producto NO publicado automáticamente (`is_visible = false`)
- ✅ Listo para editar y publicar después

