# 🔗 Cómo Obtener la URL de Connection Pooling desde Supabase

## 📍 Paso a Paso Visual

### 1. Accede a tu Proyecto Supabase

1. Ve a [https://app.supabase.com](https://app.supabase.com)
2. Inicia sesión
3. Selecciona tu proyecto

---

### 2. Navega a Database Settings

1. En el menú lateral izquierdo, haz clic en el ícono de **⚙️ Settings**
2. Luego haz clic en **"Database"** en el submenú

---

### 3. Busca "Connection string" (NO "Connection pooling configuration")

En la página de Database Settings, busca la sección **"Connection string"** (puede estar arriba o abajo de "Connection pooling configuration").

**IMPORTANTE:** Hay DOS secciones diferentes:
- ❌ **"Connection pooling configuration"** - Solo muestra configuración (lo que estás viendo)
- ✅ **"Connection string"** - Aquí están las URLs de conexión

---

### 4. Alternativa: Si no encuentras "Connection string"

Si no ves la sección "Connection string", busca estas secciones alternativas:

1. **"Connection string"** (sección separada)
2. **"Connection info"** 
3. **"Database connection"**
4. O busca pestañas como: **"URI"**, **"JDBC"**, **"Connection pooling"** (con URLs, no solo configuración)

---

### 5. Construir la URL Manualmente (Si no la encuentras)

Si no puedes encontrar la URL en el dashboard, puedes construirla manualmente:

**Formato para Session Mode (Recomendado):**
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Para tu proyecto específico:**
- PROJECT_REF: `ufbzpcdnqwutlvhwhzts` (de tu NEXT_PUBLIC_SUPABASE_URL)
- REGION: Necesitas encontrarla (ver paso 6)
- PASSWORD: Tu contraseña de base de datos

**Ejemplo:**
```
postgresql://postgres.ufbzpcdnqwutlvhwhzts:TU_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 6. Encontrar tu Región

1. Ve a **Settings → General** (no Database)
2. Busca **"Region"** o **"Project Region"**
3. Aparecerá algo como: `us-east-1`, `us-west-1`, `eu-west-1`, etc.
4. Úsala en la URL: `aws-0-[TU_REGION].pooler.supabase.com`

---

### 5. Copia la URL Completa

1. Haz clic en el botón de **copiar** (📋) junto a la URI
2. O selecciona y copia manualmente toda la URL
3. **IMPORTANTE:** Reemplaza `[YOUR-PASSWORD]` con tu contraseña real de base de datos

---

### 6. Formato Final

Tu `DATABASE_URL` debería verse así:

```env
DATABASE_URL="postgresql://postgres.ufbzpcdnqwutlvhwhzts:TU_PASSWORD_REAL@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

**Características importantes:**
- ✅ Usa `postgres.ufbzpcdnqwutlvhwhzts` (con punto después de postgres)
- ✅ Hostname: `aws-0-us-east-1.pooler.supabase.com` (o similar según tu región)
- ✅ Puerto: `6543` (no 5432)
- ✅ Termina con `/postgres`

---

### 7. Si No Encuentras Connection Pooling

Si tu proyecto no muestra la opción de Connection Pooling, puede ser porque:

1. **Estás en un plan gratuito:** Algunas funciones pueden estar limitadas
2. **El proyecto es muy nuevo:** Puede tardar unos minutos en activarse

**Alternativa:** Intenta usar Transaction Mode en lugar de Session Mode.

---

### 8. Actualizar .env.local

1. Abre tu archivo `.env.local`
2. Reemplaza la línea `DATABASE_URL` con la nueva URL de connection pooling
3. Guarda el archivo

---

### 9. Verificar

Ejecuta el script de verificación:

```bash
node verificar-env.js
```

Deberías ver:
```
✅ Connection Pooling (correcto para drizzle-kit)
✅ Puerto correcto para Connection Pooling
```

---

### 10. Probar la Conexión

```bash
npm run db:push
```

¡Debería funcionar ahora! 🎉

---

## 🆘 Si Aún Tienes Problemas

### Error: "No puedo encontrar Connection Pooling"

1. Verifica que estés en **Settings → Database** (no en otra sección)
2. Desplázate hacia abajo en la página
3. Busca cualquier sección que mencione "pooling" o "connection string"

### Error: "La URL no funciona"

1. Verifica que reemplazaste `[YOUR-PASSWORD]` con tu contraseña real
2. Asegúrate de que no haya espacios al inicio o final
3. Verifica que la contraseña no tenga caracteres especiales que necesiten codificación URL

### Error: "No sé cuál es mi contraseña"

1. Ve a **Settings → Database**
2. Busca **"Database password"** o **"Reset database password"**
3. Puedes verla o resetearla desde ahí

---

## 📸 Ubicación Visual en Supabase

```
Supabase Dashboard
├── ⚙️ Settings
    ├── General
    ├── API
    ├── Database  ← AQUÍ
    │   ├── Connection string
    │   ├── Connection pooling  ← AQUÍ ESTÁ
    │   │   ├── Session mode  ← USA ESTA
    │   │   └── Transaction mode
    │   └── ...
    └── ...
```

---

## ✅ Checklist Final

Antes de ejecutar `npm run db:push`, verifica:

- [ ] Obtuviste la URL desde **Connection pooling → Session mode**
- [ ] Reemplazaste `[YOUR-PASSWORD]` con tu contraseña real
- [ ] La URL contiene `pooler.supabase.com`
- [ ] El puerto es `6543`
- [ ] Guardaste el archivo `.env.local`
- [ ] Ejecutaste `node verificar-env.js` y muestra "Connection Pooling"

