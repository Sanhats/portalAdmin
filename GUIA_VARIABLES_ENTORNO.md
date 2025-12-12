# 🔐 Guía: Cómo Obtener las Variables de Entorno de Supabase

Esta guía te ayudará a obtener todas las variables de entorno necesarias desde tu proyecto de Supabase.

---

## 📋 Variables Necesarias

Necesitas configurar estas variables en tu archivo `.env.local`:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` (nuevo - para autenticación)
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `DATABASE_URL`

---

## 🔍 Paso a Paso

### 1. Accede a tu Proyecto Supabase

1. Ve a [https://app.supabase.com](https://app.supabase.com)
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto (o créalo si aún no lo tienes)

---

### 2. Obtener `NEXT_PUBLIC_SUPABASE_URL`

1. En el dashboard de tu proyecto, ve a **Settings** (⚙️) en el menú lateral
2. Selecciona **"API"**
3. En la sección **"Project URL"**, copia la URL
4. Esta es tu `NEXT_PUBLIC_SUPABASE_URL`

**Ejemplo:** `https://ufbzpcdnqwutlvhwhzts.supabase.co`

---

### 3. Obtener `SUPABASE_SERVICE_ROLE_KEY`

1. En la misma página de **Settings → API**
2. Busca la sección **"Project API keys"**
3. Encuentra la clave **"service_role"** (⚠️ **NO uses la clave "anon" o "public"**)
4. Haz clic en el ícono de "eye" (👁️) para revelar la clave
5. Copia esta clave completa

**⚠️ IMPORTANTE:** Esta clave tiene permisos completos. **NUNCA** la expongas en el frontend o en código público.

---

### 5. Obtener `DATABASE_URL`

#### Opción A: Desde Connection String (Recomendado)

1. Ve a **Settings → Database**
2. Busca la sección **"Connection string"** o **"Connection pooling"**
3. Selecciona la pestaña **"URI"** o **"Connection string"**
4. Verás una URL como: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
5. Reemplaza `[YOUR-PASSWORD]` con la contraseña de tu base de datos
6. Copia la URL completa

#### Opción B: Construirla Manualmente

Si conoces tu contraseña y project ref:

1. **Obtén tu Project Reference:**
   - Está en tu `NEXT_PUBLIC_SUPABASE_URL`
   - Ejemplo: Si tu URL es `https://ufbzpcdnqwutlvhwhzts.supabase.co`
   - Tu Project Ref es: `ufbzpcdnqwutlvhwhzts`

2. **Obtén tu Database Password:**
   - Ve a **Settings → Database**
   - Busca **"Database password"** o **"Reset database password"**
   - Si la olvidaste, puedes resetearla

3. **Construye la URL:**
   ```
   postgresql://postgres:TU_PASSWORD@db.TU_PROJECT_REF.supabase.co:5432/postgres
   ```

**Ejemplo completo:**
```
postgresql://postgres:MiPassword123@db.ufbzpcdnqwutlvhwhzts.supabase.co:5432/postgres
```

---

## 📝 Archivo `.env.local` Final

Crea un archivo `.env.local` en la raíz de tu proyecto con este contenido:

```env
NEXT_PUBLIC_SUPABASE_URL="https://ufbzpcdnqwutlvhwhzts.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.ufbzpcdnqwutlvhwhzts.supabase.co:5432/postgres"
```

**Nota:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` es necesaria para el sistema de autenticación.

---

## ✅ Verificación

Para verificar que todo está correcto:

1. **Verifica que el archivo existe:** `.env.local` en la raíz del proyecto
2. **Verifica que no está en Git:** El archivo `.gitignore` debe incluir `.env*.local`
3. **Reinicia el servidor:** Si ya estaba corriendo, reinícialo para cargar las nuevas variables

---

## 🔒 Seguridad

- ✅ **SÍ:** Usa `.env.local` para desarrollo local
- ✅ **SÍ:** Agrega `.env.local` a `.gitignore`
- ❌ **NO:** Subas estas variables a Git
- ❌ **NO:** Compartas estas claves públicamente
- ❌ **NO:** Uses `service_role_key` en el frontend

---

## 🆘 Problemas Comunes

### "No puedo ver mi contraseña de base de datos"
- Ve a **Settings → Database → Reset database password**
- Establece una nueva contraseña
- Actualiza tu `DATABASE_URL` con la nueva contraseña

### "La conexión falla" o "ENOTFOUND"

**Error común:** `Error: getaddrinfo ENOTFOUND db.[PROJECT_REF].supabase.co`

**Solución:** Usa **Connection Pooling** en lugar de conexión directa:

1. Ve a **Settings → Database** en Supabase
2. Busca la sección **"Connection pooling"**
3. Selecciona la pestaña **"Session mode"** o **"Transaction mode"**
4. Copia la **URI** que aparece ahí

**Formato de Connection Pooling:**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

O alternativamente:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[PROJECT_REF].pooler.supabase.com:6543/postgres
```

**Nota:** El puerto para connection pooling es **6543**, no 5432.

**Otras verificaciones:**
- Verifica que la contraseña en `DATABASE_URL` esté correcta
- Asegúrate de que el Project Ref sea correcto
- Verifica que no haya espacios extra en las variables
- Asegúrate de que la contraseña no tenga caracteres especiales que necesiten ser codificados (URL encoding)

### "No encuentro el service_role_key"
- Asegúrate de estar en **Settings → API**
- Busca la sección **"Project API keys"**
- Haz clic en el ícono de ojo para revelar la clave

---

## 📚 Recursos Adicionales

- [Documentación oficial de Supabase](https://supabase.com/docs)
- [Guía de Connection Strings](https://supabase.com/docs/guides/database/connecting-to-postgres)

