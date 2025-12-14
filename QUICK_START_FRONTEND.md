# ⚡ Quick Start - Frontend

**Para el equipo de frontend - Inicio rápido en 5 minutos**

---

## 🎯 Información Esencial

### URL Base de la API
```
https://portal-admin-black.vercel.app/api
```
**⚠️ IMPORTANTE:** Reemplaza `tu-proyecto.vercel.app` con la URL real de tu deploy en Vercel.

---

## 🔐 Paso 1: Autenticación

### Login
```typescript
const response = await fetch('https://tu-proyecto.vercel.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password123'
  })
});

const data = await response.json();
const token = data.session.access_token;

// Guardar token
localStorage.setItem('access_token', token);
```

### Usar Token en Requests
```typescript
const token = localStorage.getItem('access_token');

fetch('https://tu-proyecto.vercel.app/api/products', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## 📦 Paso 2: Endpoints Principales

### Obtener Productos (Público)
```typescript
// Listar todos
GET /api/products

// Con filtros
GET /api/products?page=1&limit=10&isFeatured=true&search=laptop
```

### Obtener Producto por ID (Público)
```typescript
GET /api/products/{id}
```

### Crear Producto (Requiere Auth)
```typescript
POST /api/products
Headers: { Authorization: 'Bearer {token}' }
Body: {
  name: "Producto",
  slug: "producto",
  price: "99.99",
  stock: 10,
  images: [{ imageUrl: "https://..." }]
}
```

### Actualizar Producto (Requiere Auth)
```typescript
PUT /api/products/{id}
Headers: { Authorization: 'Bearer {token}' }
Body: { price: "89.99", stock: 15 }
```

### Eliminar Producto (Requiere Auth)
```typescript
DELETE /api/products/{id}
Headers: { Authorization: 'Bearer {token}' }
```

### Obtener Categorías (Público)
```typescript
GET /api/categories
```

### Subir Imagen (Requiere Auth)
```typescript
POST /api/upload
Headers: { Authorization: 'Bearer {token}' }
Body: FormData con campo 'file'
```

---

## 💻 Cliente API Listo para Usar

Copia y pega este código en tu proyecto:

```typescript
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('access_token');
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
    localStorage.setItem('access_token', data.session.access_token);
    return data;
  }

  // Products
  async getProducts(params?: {
    page?: number;
    limit?: number;
    categoryId?: string;
    categorySlug?: string;
    isFeatured?: boolean;
    search?: string;
  }) {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    return this.request(`/products?${query.toString()}`);
  }

  async getProduct(id: string) {
    return this.request(`/products/${id}`);
  }

  async createProduct(product: any) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: string, updates: any) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProduct(id: string) {
    return this.request(`/products/${id}`, { method: 'DELETE' });
  }

  // Categories
  async getCategories() {
    return this.request('/categories');
  }

  // Upload
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const token = this.getToken();
    
    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al subir imagen');
    }

    return response.json();
  }
}

// Uso:
const api = new ApiClient('https://tu-proyecto.vercel.app/api');

// Login
await api.login('admin@example.com', 'password123');

// Obtener productos
// Obtener productos con paginación
const products = await api.getProducts({ page: 1, limit: 10 });

// Filtrar productos por categoría (usando UUID)
const productsByCategory = await api.getProducts({ 
  categoryId: 'uuid-de-categoria',
  page: 1,
  limit: 10 
});

// Filtrar productos por categoría (usando slug - recomendado)
const productsBySlug = await api.getProducts({ 
  categorySlug: 'electronicos',
  page: 1,
  limit: 10 
});

// Filtrar productos destacados
const featuredProducts = await api.getProducts({ 
  isFeatured: true,
  page: 1,
  limit: 10 
});

// Buscar productos
const searchResults = await api.getProducts({ 
  search: 'laptop',
  page: 1,
  limit: 10 
});

// Crear producto
const newProduct = await api.createProduct({
  name: 'Nuevo Producto',
  slug: 'nuevo-producto',
  price: '99.99',
});
```

---

## 📚 Documentación Completa

Para más detalles, ejemplos y tipos TypeScript completos, ver:
- **`DOCUMENTACION_FRONTEND.md`** - Documentación completa con todos los detalles
- **`API_REFERENCE.md`** - Referencia completa de la API
- **`openapi.json`** - Especificación OpenAPI 3.0

---

## ⚠️ Notas Importantes

1. **Reemplaza la URL:** Cambia `tu-proyecto.vercel.app` por portal-admin-black.vercel.app
2. **Token expira:** El token tiene un tiempo de expiración, implementa refresh si es necesario
3. **CORS:** Si tienes problemas de CORS, contacta al equipo backend
4. **Validaciones:** Valida datos en frontend antes de enviar

---

**¡Listo para comenzar! 🚀**



