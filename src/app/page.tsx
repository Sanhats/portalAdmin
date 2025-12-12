export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>🛍️ Ecommerce Backend API</h1>
      <p>Backend API para sistema de ecommerce</p>
      
      <h2>Endpoints Disponibles:</h2>
      <ul>
        <li>
          <strong>GET /api/categories</strong> - Listar categorías
        </li>
        <li>
          <strong>POST /api/categories</strong> - Crear categoría
        </li>
        <li>
          <strong>GET /api/products</strong> - Listar productos (con filtros y paginación)
        </li>
        <li>
          <strong>GET /api/products/[id]</strong> - Obtener producto por ID
        </li>
        <li>
          <strong>POST /api/products</strong> - Crear producto
        </li>
        <li>
          <strong>PUT /api/products/[id]</strong> - Actualizar producto
        </li>
        <li>
          <strong>DELETE /api/products/[id]</strong> - Eliminar producto
        </li>
      </ul>
      
      <h2>Documentación:</h2>
      <p>
        Ver <code>ENDPOINTS_PRODUCTOS.md</code> para documentación completa de los endpoints.
      </p>
    </main>
  );
}

