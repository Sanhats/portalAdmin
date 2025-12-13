# 🚀 Guía de Deploy - Ecommerce Admin API

**Estado:** ✅ Proyecto listo para deploy  
**Última actualización:** Diciembre 2024

---

## ✅ Verificaciones Pre-Deploy

### 1. Build Exitoso

El proyecto debe compilar sin errores:

```bash
npm run build
```

**Resultado esperado:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages
```

### 2. Variables de Entorno

Asegúrate de tener todas las variables de entorno configuradas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (Connection Pooling URL)

Ver `GUIA_VARIABLES_ENTORNO.md` para más detalles.

---

## 🌐 Opciones de Deploy

### Opción 1: Vercel (Recomendado)

Vercel es la plataforma oficial de Next.js y ofrece la mejor integración.

#### Pasos:

1. **Instalar Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Configurar Variables de Entorno:**
   - Ve a tu proyecto en Vercel Dashboard
   - Settings → Environment Variables
   - Agrega todas las variables de `.env.local`

5. **Redeploy:**
   ```bash
   vercel --prod
   ```

#### Ventajas:
- ✅ Deploy automático desde Git
- ✅ SSL automático
- ✅ CDN global
- ✅ Optimizaciones de Next.js automáticas

---

### Opción 2: Netlify

#### Pasos:

1. **Instalar Netlify CLI:**
   ```bash
   npm i -g netlify-cli
   ```

2. **Login:**
   ```bash
   netlify login
   ```

3. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

4. **Configurar Build Settings:**
   - Build command: `npm run build`
   - Publish directory: `.next`

5. **Configurar Variables de Entorno:**
   - Netlify Dashboard → Site settings → Environment variables

---

### Opción 3: Railway

#### Pasos:

1. **Conectar Repositorio:**
   - Ve a [Railway.app](https://railway.app)
   - New Project → Deploy from GitHub

2. **Configurar Build:**
   - Build Command: `npm run build`
   - Start Command: `npm start`

3. **Configurar Variables de Entorno:**
   - Variables → Add variables

---

### Opción 4: Docker (Self-Hosted)

#### Crear Dockerfile:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### Actualizar next.config.js:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
```

#### Build y Run:

```bash
docker build -t ecommerce-admin .
docker run -p 3000:3000 --env-file .env.local ecommerce-admin
```

---

## 🔒 Seguridad en Producción

### 1. Variables de Entorno

- ✅ **NUNCA** subas `.env.local` a Git
- ✅ Usa variables de entorno del proveedor de hosting
- ✅ Usa diferentes credenciales para producción

### 2. CORS (si es necesario)

Si necesitas configurar CORS, agrega en `next.config.js`:

```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://tu-dominio.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}
```

### 3. Rate Limiting

Considera agregar rate limiting para producción. Puedes usar:
- Vercel Edge Middleware
- Upstash Redis
- Cloudflare Workers

---

## 📋 Checklist Pre-Deploy

- [ ] `npm run build` ejecuta sin errores
- [ ] Todas las variables de entorno configuradas
- [ ] `.env.local` en `.gitignore`
- [ ] Base de datos migrada y funcionando
- [ ] Bucket de Supabase Storage configurado
- [ ] Políticas RLS configuradas en Supabase
- [ ] Endpoints probados localmente
- [ ] Documentación actualizada

---

## 🧪 Testing Post-Deploy

Después del deploy, prueba los siguientes endpoints:

### 1. Health Check (si lo implementas)
```bash
curl https://tu-dominio.com/api/health
```

### 2. Login
```bash
curl -X POST https://tu-dominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

### 3. Obtener Productos (público)
```bash
curl https://tu-dominio.com/api/products
```

### 4. Crear Producto (requiere auth)
```bash
curl -X POST https://tu-dominio.com/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","slug":"test","price":"10.00"}'
```

---

## 🔍 Troubleshooting

### Error: "Module not found"

**Solución:** Asegúrate de que todas las dependencias estén en `dependencies` y no solo en `devDependencies`.

### Error: "Environment variable not found"

**Solución:** Verifica que todas las variables estén configuradas en el dashboard de tu proveedor de hosting.

### Error: "Database connection failed"

**Solución:** 
- Verifica que `DATABASE_URL` use Connection Pooling (puerto 6543)
- Verifica que la IP de tu servidor esté permitida en Supabase

### Error: "CORS error"

**Solución:** Configura CORS en `next.config.js` o en tu proveedor de hosting.

---

## 📚 Recursos

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Deployment](https://vercel.com/docs)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-to-prod)

---

**Última actualización:** Diciembre 2024  
**Estado:** ✅ Listo para deploy

