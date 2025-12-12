# 🔐 Configurar Autenticación Admin - Guía Completa

Esta guía te ayudará a configurar la autenticación para proteger los endpoints de administración.

---

## 📍 Paso 1: Activar Supabase Auth

1. **Accede a tu proyecto en Supabase Dashboard:**
   - Ve a [https://app.supabase.com](https://app.supabase.com)
   - Selecciona tu proyecto

2. **Navega a Authentication:**
   - En el menú lateral, haz clic en **"Authentication"** (🔐)
   - Auth ya está activado por defecto en Supabase

3. **Configurar Providers (Opcional):**
   - Por ahora, usaremos **Email/Password** que ya está habilitado
   - Puedes configurar otros providers después si lo necesitas

---

## 👤 Paso 2: Crear Usuario Admin Manualmente

### Opción A: Desde el Dashboard de Supabase

1. **Ve a Authentication → Users:**
   - En el menú lateral, **Authentication → Users**

2. **Crear nuevo usuario:**
   - Haz clic en **"Add user"** o **"Crear usuario"**
   - Selecciona **"Create new user"**

3. **Completar datos:**
   - **Email:** `admin@ecommerce.com` (o el que prefieras)
   - **Password:** Crea una contraseña segura
   - **Auto Confirm User:** ✅ Marca esta opción (para que no necesite verificar email)

4. **Guardar:**
   - Haz clic en **"Create user"**

5. **Anotar información:**
   - Guarda el email y contraseña del admin
   - Necesitarás estos datos para hacer login

---

### Opción B: Crear usuario desde la API (Programático)

Puedes crear el usuario admin desde el código usando el `service_role_key`:

```typescript
// Script de creación (ejecutar una vez)
import { supabase } from './lib/supabase';

const { data, error } = await supabase.auth.admin.createUser({
  email: 'admin@ecommerce.com',
  password: 'TuPasswordSeguro123!',
  email_confirm: true, // Auto-confirmar
  user_metadata: {
    role: 'admin'
  }
});
```

---

## 🔒 Paso 3: Configurar Políticas RLS (Row Level Security)

Las políticas RLS protegen las tablas a nivel de base de datos.

### 3.1 Habilitar RLS en las Tablas

1. **Ve a Table Editor en Supabase:**
   - Dashboard → **Table Editor**

2. **Para cada tabla, habilitar RLS:**
   - `categories`
   - `products`
   - `product_images`
   - `variants`

3. **Habilitar RLS:**
   - Haz clic en cada tabla
   - Ve a la pestaña **"Policies"** o **"Políticas"**
   - Haz clic en **"Enable RLS"** si no está habilitado

---

### 3.2 Política de Lectura Pública (SELECT)

**Para `categories` y `products`:** Permitir lectura pública (para el catálogo)

```sql
-- Política: Public Read Access
CREATE POLICY "Public Read Access"
ON categories FOR SELECT
USING (true);

CREATE POLICY "Public Read Access"
ON products FOR SELECT
USING (true);

CREATE POLICY "Public Read Access"
ON product_images FOR SELECT
USING (true);

CREATE POLICY "Public Read Access"
ON variants FOR SELECT
USING (true);
```

---

### 3.3 Política de Escritura Solo para Admin (INSERT, UPDATE, DELETE)

**Para todas las tablas:** Solo usuarios autenticados pueden escribir

```sql
-- Política: Admin Write Access (INSERT)
CREATE POLICY "Admin Write Access"
ON categories FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin Write Access"
ON products FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin Write Access"
ON product_images FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin Write Access"
ON variants FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Política: Admin Write Access (UPDATE)
CREATE POLICY "Admin Update Access"
ON categories FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin Update Access"
ON products FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin Update Access"
ON product_images FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin Update Access"
ON variants FOR UPDATE
USING (auth.role() = 'authenticated');

-- Política: Admin Write Access (DELETE)
CREATE POLICY "Admin Delete Access"
ON categories FOR DELETE
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin Delete Access"
ON products FOR DELETE
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin Delete Access"
ON product_images FOR DELETE
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin Delete Access"
ON variants FOR DELETE
USING (auth.role() = 'authenticated');
```

---

### 3.4 Aplicar Políticas en Supabase

1. **Ve a SQL Editor:**
   - Dashboard → **SQL Editor**

2. **Ejecutar las políticas:**
   - Copia y pega las políticas SQL de arriba
   - Ejecuta cada bloque de políticas
   - Verifica que no haya errores

3. **Verificar políticas:**
   - Ve a cada tabla → **Policies**
   - Deberías ver las políticas creadas

---

## ⚠️ Nota Importante sobre RLS y service_role_key

**IMPORTANTE:** Cuando usas `service_role_key` en el backend, **bypasea RLS**. Esto significa que:

- ✅ El backend puede hacer cualquier operación (necesario para el middleware)
- ⚠️ Las políticas RLS protegen contra acceso directo a la BD desde el frontend
- ✅ El middleware de Next.js validará los tokens antes de permitir requests

**Flujo de seguridad:**
1. Frontend → Request con token Bearer
2. Middleware Next.js → Valida token
3. Si válido → Endpoint usa `service_role_key` (bypasea RLS)
4. Si inválido → Middleware rechaza el request

---

## 🧪 Verificar Configuración

### Verificar usuario admin:

1. Ve a **Authentication → Users**
2. Deberías ver tu usuario admin creado
3. Verifica que esté confirmado (email_confirm = true)

### Verificar políticas RLS:

1. Ve a cada tabla → **Policies**
2. Deberías ver las políticas creadas
3. RLS debe estar habilitado

---

## 📝 Resumen de Configuración

| Configuración | Estado |
|---------------|--------|
| Supabase Auth | ✅ Activado por defecto |
| Usuario Admin | ⚠️ Crear manualmente |
| RLS Habilitado | ⚠️ Habilitar en cada tabla |
| Políticas de Lectura | ⚠️ Crear (públicas) |
| Políticas de Escritura | ⚠️ Crear (solo authenticated) |

---

## 🆘 Solución de Problemas

### Error: "new row violates row-level security policy"
**Solución:** Verifica que las políticas estén creadas correctamente y que RLS esté habilitado.

### Error: "User not found"
**Solución:** Verifica que el usuario admin esté creado y confirmado.

### Las políticas no se aplican
**Solución:** Asegúrate de que RLS esté habilitado en cada tabla antes de crear las políticas.

---

## 📚 Referencias

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security#policies)

---

**Una vez completada esta configuración, el middleware de Next.js protegerá los endpoints.**

