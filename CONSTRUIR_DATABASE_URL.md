# 🔧 Construir DATABASE_URL Manualmente

Si no puedes encontrar la URL de connection pooling en el dashboard de Supabase, puedes construirla manualmente.

---

## 📋 Información que Necesitas

1. **PROJECT_REF**: Ya lo tienes → `ufbzpcdnqwutlvhwhzts`
2. **PASSWORD**: Tu contraseña de base de datos
3. **REGION**: Necesitas encontrarla (ver abajo)

---

## 🔍 Paso 1: Encontrar tu Región

1. Ve a **Settings → General** (en el menú lateral de Supabase)
2. Busca la sección **"Region"** o **"Project Region"**
3. Verás algo como:
   - `us-east-1` (Norteamérica Este)
   - `us-west-1` (Norteamérica Oeste)
   - `eu-west-1` (Europa Oeste)
   - `ap-southeast-1` (Asia Pacífico)
   - etc.

**Anota tu región:** _______________

---

## 🔍 Paso 2: Obtener tu Contraseña de Base de Datos

1. Ve a **Settings → Database**
2. Busca **"Database password"** o **"Reset database password"**
3. Si no la recuerdas, puedes resetearla

**Tu contraseña:** _______________

---

## 🔨 Paso 3: Construir la URL

### Formato para Session Mode (Recomendado para drizzle-kit):

```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Ejemplo Completo:

Si tu región es `us-east-1` y tu contraseña es `MiPassword123`:

```env
DATABASE_URL="postgresql://postgres.ufbzpcdnqwutlvhwhzts:MiPassword123@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

---

## 📝 Paso 4: Actualizar .env.local

1. Abre tu archivo `.env.local`
2. Reemplaza la línea `DATABASE_URL` con la URL que construiste
3. **IMPORTANTE:** 
   - No dejes espacios alrededor del `=`
   - Mantén las comillas dobles
   - Asegúrate de que la contraseña esté correcta

---

## ✅ Paso 5: Verificar

Ejecuta:

```bash
node verificar-env.js
```

Deberías ver:
```
✅ Connection Pooling (correcto para drizzle-kit)
✅ Puerto correcto para Connection Pooling
```

---

## 🧪 Paso 6: Probar

```bash
npm run db:push
```

¡Debería funcionar! 🎉

---

## 🔐 Notas de Seguridad

- ✅ La contraseña puede tener caracteres especiales
- ⚠️ Si tu contraseña tiene `@`, `#`, `%`, etc., pueden necesitar codificación URL
- ✅ El parámetro `?pgbouncer=true` es importante para connection pooling

---

## 🆘 Si Aún No Funciona

### Error: "getaddrinfo ENOTFOUND"

1. Verifica que la región sea correcta
2. Verifica que el formato sea exacto
3. Asegúrate de usar `pooler.supabase.com` (no `db.`)

### Error: "password authentication failed"

1. Verifica que la contraseña sea correcta
2. Si la resetaste, usa la nueva contraseña
3. Asegúrate de que no haya espacios en la contraseña

### Error: "connection refused"

1. Verifica que el puerto sea `6543` (no `5432`)
2. Verifica que uses `pooler.supabase.com`

---

## 📚 Referencias

- [Supabase Connection Pooling Docs](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Drizzle Kit Connection](https://orm.drizzle.team/docs/get-started-postgresql#drizzle-kit)

