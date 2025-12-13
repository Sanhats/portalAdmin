# 📱 Documentación para Frontend - Ecommerce Admin API

**Versión:** 1.0.0  
**Fecha:** Diciembre 2024  
**Base URL:** `https://portal-admin-black.vercel.app/api` (reemplaza con tu URL de Vercel)

---

## 🚀 Inicio Rápido

### 1. URL Base de la API

```
https://https://portal-admin-black.vercel.app/api
```

**Nota:** Reemplaza `portal-admin-black.vercel.app` con la URL real de tu deploy en Vercel.

### 2. Autenticación

La mayoría de los endpoints requieren autenticación mediante **Bearer Token**.

#### Flujo de Autenticación:

1. **Login** → Obtener token
2. **Guardar token** → LocalStorage/SessionStorage
3. **Incluir token** → En headers de todas las requests protegidas

---

## 🔐 Autenticación

### POST /api/auth/login

**Endpoint:** `POST https://portal-admin-black.vercel.app/api/auth/login`

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "admin"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": 1234567890,
    "expires_in": 3600
  }
}
```

**Ejemplo (JavaScript/TypeScript):**
```typescript
async function login(email: string, password: string) {
  const response = await fetch('https://portal-admin-black.vercel.app/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('Error en login');
  }

  const data = await response.json();
  
  // Guardar token
  localStorage.setItem('access_token', data.session.access_token);
  localStorage.setItem('user', JSON.stringify(data.user));
  
  return data;
}
```

---

## 📦 Productos

### GET /api/products

**Listar productos con filtros y paginación**

**Endpoint:** `GET https://portal-admin-black.vercel.app/api/products`

**Query Parameters:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Productos por página (default: 10)
- `categoryId` (opcional): Filtrar por categoría (UUID)
- `isFeatured` (opcional): `true` para productos destacados
- `search` (opcional): Buscar en nombre y descripción

**Ejemplo:**
```
GET /api/products?page=1&limit=10&isFeatured=true&search=laptop
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Laptop HP",
      "slug": "laptop-hp",
      "description": "Laptop de alta gama",
      "price": "1299.99",
      "stock": 10,
      "is_featured": true,
      "category_id": "uuid",
      "created_at": "2024-12-01T00:00:00.000Z",
      "categories": {
        "id": "uuid",
        "name": "Electrónicos",
        "slug": "electronicos"
      },
      "product_images": [
        {
          "id": "uuid",
          "image_url": "https://..."
        }
      ],
      "variants": [
        {
          "id": "uuid",
          "name": "Color",
          "value": "Negro"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

**Ejemplo (React/TypeScript):**
```typescript
interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  stock: number;
  is_featured: boolean;
  category_id: string | null;
  created_at: string;
  categories: {
    id: string;
    name: string;
    slug: string;
  } | null;
  product_images: Array<{
    id: string;
    image_url: string;
  }>;
  variants: Array<{
    id: string;
    name: string;
    value: string;
  }>;
}

interface ProductsResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function getProducts(params?: {
  page?: number;
  limit?: number;
  categoryId?: string;
  isFeatured?: boolean;
  search?: string;
}): Promise<ProductsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.categoryId) queryParams.append('categoryId', params.categoryId);
  if (params?.isFeatured) queryParams.append('isFeatured', 'true');
  if (params?.search) queryParams.append('search', params.search);

  const response = await fetch(
    `https://portal-admin-black.vercel.app/api/products?${queryParams.toString()}`
  );

  if (!response.ok) {
    throw new Error('Error al obtener productos');
  }

  return response.json();
}
```

---

### GET /api/products/{id}

**Obtener un producto por ID**

**Endpoint:** `GET https://tu-proyecto.vercel.app/api/products/{id}`

**Ejemplo:**
```typescript
async function getProduct(id: string): Promise<Product> {
  const response = await fetch(
    `https://tu-proyecto.vercel.app/api/products/${id}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Producto no encontrado');
    }
    throw new Error('Error al obtener producto');
  }

  return response.json();
}
```

---

### POST /api/products

**Crear un nuevo producto** (requiere autenticación)

**Endpoint:** `POST https://tu-proyecto.vercel.app/api/products`

**Request:**
```json
{
  "name": "Laptop HP",
  "slug": "laptop-hp",
  "description": "Laptop de alta gama",
  "price": "1299.99",
  "stock": 10,
  "isFeatured": false,
  "categoryId": "uuid-categoria",
  "variants": [
    {
      "name": "Color",
      "value": "Negro"
    }
  ],
  "images": [
    {
      "imageUrl": "https://example.com/image.jpg"
    }
  ]
}
```

**Nota:** También puedes usar `product_images` en lugar de `images` (ambos formatos son compatibles):
```json
{
  "name": "Laptop HP",
  "product_images": [
    {
      "imageUrl": "https://example.com/image.jpg"
    }
  ]
}
```

**Ejemplo:**
```typescript
interface CreateProductInput {
  name: string;
  slug: string;
  description?: string | null;
  price: string | number;
  stock?: number;
  isFeatured?: boolean;
  categoryId?: string | null;
  variants?: Array<{
    name: string;
    value: string;
  }>;
  images?: Array<{
    imageUrl: string;
  }>;
}

async function createProduct(product: CreateProductInput): Promise<Product> {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    throw new Error('No autenticado');
  }

  const response = await fetch(
    'https://tu-proyecto.vercel.app/api/products',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(product),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al crear producto');
  }

  return response.json();
}
```

---

### PUT /api/products/{id}

**Actualizar un producto** (requiere autenticación)

**Endpoint:** `PUT https://tu-proyecto.vercel.app/api/products/{id}`

**Request:** (todos los campos son opcionales)
```json
{
  "price": "1199.99",
  "stock": 15,
  "isFeatured": true
}
```

**Ejemplo:**
```typescript
async function updateProduct(
  id: string,
  updates: Partial<CreateProductInput>
): Promise<Product> {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    throw new Error('No autenticado');
  }

  const response = await fetch(
    `https://tu-proyecto.vercel.app/api/products/${id}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al actualizar producto');
  }

  return response.json();
}
```

---

### DELETE /api/products/{id}

**Eliminar un producto** (requiere autenticación)

**Endpoint:** `DELETE https://tu-proyecto.vercel.app/api/products/{id}`

**Ejemplo:**
```typescript
async function deleteProduct(id: string): Promise<void> {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    throw new Error('No autenticado');
  }

  const response = await fetch(
    `https://tu-proyecto.vercel.app/api/products/${id}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Error al eliminar producto');
  }
}
```

---

## 📁 Categorías

### GET /api/categories

**Obtener todas las categorías**

**Endpoint:** `GET https://tu-proyecto.vercel.app/api/categories`

**Response 200:**
```json
[
  {
    "id": "uuid",
    "name": "Electrónicos",
    "slug": "electronicos",
    "created_at": "2024-12-01T00:00:00.000Z"
  }
]
```

**Ejemplo:**
```typescript
interface Category {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

async function getCategories(): Promise<Category[]> {
  const response = await fetch(
    'https://tu-proyecto.vercel.app/api/categories'
  );

  if (!response.ok) {
    throw new Error('Error al obtener categorías');
  }

  return response.json();
}
```

---

### POST /api/categories

**Crear una categoría** (requiere autenticación)

**Endpoint:** `POST https://tu-proyecto.vercel.app/api/categories`

**Request:**
```json
{
  "name": "Electrónicos",
  "slug": "electronicos"
}
```

**Ejemplo:**
```typescript
async function createCategory(category: {
  name: string;
  slug: string;
}): Promise<Category[]> {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    throw new Error('No autenticado');
  }

  const response = await fetch(
    'https://tu-proyecto.vercel.app/api/categories',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(category),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al crear categoría');
  }

  return response.json();
}
```

---

## 📤 Upload de Imágenes

### POST /api/upload

**Subir una imagen** (requiere autenticación)

**Endpoint:** `POST https://tu-proyecto.vercel.app/api/upload`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: Archivo de imagen (JPEG, PNG, WebP, GIF, máximo 5MB)

**Response 201:**
```json
{
  "success": true,
  "file": {
    "id": "products/1234567890-abc123.jpg",
    "fileName": "1234567890-abc123.jpg",
    "filePath": "products/1234567890-abc123.jpg",
    "url": "https://supabase.co/storage/v1/object/public/product-images/products/1234567890-abc123.jpg",
    "size": 102400,
    "type": "image/jpeg"
  }
}
```

**Ejemplo:**
```typescript
async function uploadImage(file: File): Promise<{
  success: boolean;
  file: {
    id: string;
    fileName: string;
    filePath: string;
    url: string;
    size: number;
    type: string;
  };
}> {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    throw new Error('No autenticado');
  }

  // Validar tipo de archivo
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Tipo de archivo no permitido');
  }

  // Validar tamaño (5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('El archivo no puede ser mayor a 5MB');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    'https://tu-proyecto.vercel.app/api/upload',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al subir imagen');
  }

  return response.json();
}
```

---

## ⚠️ Manejo de Errores

### Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado exitosamente |
| 400 | Bad Request - Datos inválidos o faltantes |
| 401 | Unauthorized - Token inválido o faltante |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

### Formato de Errores

**Error de Validación (400):**
```json
{
  "error": "Datos inválidos",
  "details": [
    {
      "path": ["name"],
      "message": "El nombre es requerido"
    }
  ]
}
```

**Error de Autenticación (401):**
```json
{
  "error": "No autorizado. Token Bearer requerido."
}
```

**Error de Recurso No Encontrado (404):**
```json
{
  "error": "Producto no encontrado"
}
```

### Ejemplo de Manejo de Errores

```typescript
async function handleApiRequest<T>(
  request: () => Promise<Response>
): Promise<T> {
  try {
    const response = await request();

    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 401) {
        // Token expirado o inválido
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        // Redirigir a login
        window.location.href = '/login';
        throw new Error('Sesión expirada');
      }

      throw new Error(error.error || 'Error en la solicitud');
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error desconocido');
  }
}

// Uso:
const products = await handleApiRequest<ProductsResponse>(() =>
  fetch('https://tu-proyecto.vercel.app/api/products')
);
```

---

## 🔧 Utilidades Recomendadas

### 1. Cliente API (TypeScript)

```typescript
class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('access_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('access_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        throw new Error('Sesión expirada');
      }

      const error = await response.json();
      throw new Error(error.error || 'Error en la solicitud');
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{
      success: boolean;
      user: any;
      session: { access_token: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.setToken(data.session.access_token);
    return data;
  }

  // Products
  async getProducts(params?: {
    page?: number;
    limit?: number;
    categoryId?: string;
    isFeatured?: boolean;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return this.request<ProductsResponse>(
      `/products?${queryParams.toString()}`
    );
  }

  async getProduct(id: string) {
    return this.request<Product>(`/products/${id}`);
  }

  async createProduct(product: CreateProductInput) {
    return this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: string, updates: Partial<CreateProductInput>) {
    return this.request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProduct(id: string) {
    return this.request<void>(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  // Categories
  async getCategories() {
    return this.request<Category[]>('/categories');
  }

  async createCategory(category: { name: string; slug: string }) {
    return this.request<Category[]>('/categories', {
      method: 'POST',
      body: JSON.stringify(category),
    });
  }

  // Upload
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<{
      success: boolean;
      file: {
        id: string;
        fileName: string;
        filePath: string;
        url: string;
        size: number;
        type: string;
      };
    }>('/upload', {
      method: 'POST',
      headers: {
        // No incluir Content-Type, el navegador lo establece automáticamente con boundary
      },
      body: formData,
    });
  }
}

// Uso:
const api = new ApiClient('https://tu-proyecto.vercel.app/api');

// Login
await api.login('admin@example.com', 'password123');

// Obtener productos
const products = await api.getProducts({ page: 1, limit: 10 });

// Crear producto
const newProduct = await api.createProduct({
  name: 'Nuevo Producto',
  slug: 'nuevo-producto',
  price: '99.99',
});
```

---

## 📝 Notas Importantes

1. **Autenticación:**
   - El token expira después de cierto tiempo (verificar `expires_in` en la respuesta de login)
   - Implementa refresh token si es necesario
   - Guarda el token de forma segura (no en cookies sin httpOnly en producción)

2. **CORS:**
   - Si tienes problemas de CORS, contacta al equipo backend para configurar los orígenes permitidos

3. **Rate Limiting:**
   - Respeta los límites de rate limiting si están implementados
   - Implementa retry con backoff exponencial

4. **Validaciones:**
   - Valida datos en el frontend antes de enviar
   - Los errores de validación del backend incluyen detalles específicos

5. **Imágenes:**
   - Las URLs de imágenes son públicas y pueden usarse directamente en `<img src>`
   - Valida tipo y tamaño de archivo antes de subir

---

## 🔗 Recursos Adicionales

- **OpenAPI Specification:** Ver `openapi.json` para especificación completa
- **API Reference Completa:** Ver `API_REFERENCE.md` para documentación detallada
- **Validaciones:** Ver `VALIDACIONES_ZOD.md` para esquemas de validación

---

## 📞 Soporte

Si tienes preguntas o problemas:
1. Revisa la documentación completa en `API_REFERENCE.md`
2. Verifica la especificación OpenAPI en `openapi.json`
3. Contacta al equipo backend

---

**Última actualización:** Diciembre 2024  
**Versión de la API:** 1.0.0


