# 💻 Ejemplos de Requests HTTP en PowerShell

En PowerShell, `curl` es un alias de `Invoke-WebRequest` que no acepta la misma sintaxis que curl de Unix. Aquí tienes ejemplos correctos:

---

## 🔧 Método 1: Usar `Invoke-WebRequest` (PowerShell nativo)

### GET - Listar categorías
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/categories" -Method GET | Select-Object -ExpandProperty Content
```

### GET - Listar productos
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/products" -Method GET | Select-Object -ExpandProperty Content
```

### GET - Con parámetros de consulta
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/products?page=1&limit=5" -Method GET | Select-Object -ExpandProperty Content
```

### POST - Crear categoría
```powershell
$body = @{
    name = "Electrónicos"
    slug = "electronicos"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/categories" -Method POST -Body $body -ContentType "application/json" | Select-Object -ExpandProperty Content
```

### POST - Crear producto
```powershell
$body = @{
    name = "Laptop Gaming"
    slug = "laptop-gaming"
    description = "Potente laptop para gaming"
    price = "1299.99"
    stock = 5
    isFeatured = $true
    variants = @(
        @{ name = "RAM"; value = "16GB" }
    )
    images = @(
        @{ imageUrl = "https://ejemplo.com/laptop.jpg" }
    )
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json" | Select-Object -ExpandProperty Content
```

### PUT - Actualizar producto
```powershell
$productId = "TU-UUID-AQUI"
$body = @{
    price = "999.99"
    stock = 10
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/products/$productId" -Method PUT -Body $body -ContentType "application/json" | Select-Object -ExpandProperty Content
```

### DELETE - Eliminar producto
```powershell
$productId = "TU-UUID-AQUI"
Invoke-WebRequest -Uri "http://localhost:3000/api/products/$productId" -Method DELETE | Select-Object -ExpandProperty Content
```

---

## 🔧 Método 2: Usar `Invoke-RestMethod` (Más simple, retorna JSON parseado)

### GET - Listar categorías
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/categories" -Method GET
```

### GET - Listar productos
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET
```

### POST - Crear categoría
```powershell
$body = @{
    name = "Electrónicos"
    slug = "electronicos"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/categories" -Method POST -Body $body -ContentType "application/json"
```

### POST - Crear producto
```powershell
$body = @{
    name = "Laptop Gaming"
    slug = "laptop-gaming"
    price = "1299.99"
    stock = 5
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
```

---

## 🔧 Método 3: Usar `curl.exe` (Si tienes curl instalado)

Si tienes curl.exe instalado, puedes usarlo directamente:

```powershell
curl.exe -X GET http://localhost:3000/api/categories

curl.exe -X POST http://localhost:3000/api/products `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"Test\",\"slug\":\"test\",\"price\":\"50.00\"}'
```

---

## 📝 Funciones Helper (Recomendado)

Crea estas funciones en tu perfil de PowerShell o en un archivo `.ps1`:

```powershell
# Función para hacer GET requests
function Get-Api {
    param(
        [string]$Endpoint,
        [hashtable]$QueryParams = @{}
    )
    
    $uri = "http://localhost:3000$Endpoint"
    
    if ($QueryParams.Count -gt 0) {
        $queryString = ($QueryParams.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "&"
        $uri += "?$queryString"
    }
    
    Invoke-RestMethod -Uri $uri -Method GET
}

# Función para hacer POST requests
function Post-Api {
    param(
        [string]$Endpoint,
        [hashtable]$Body
    )
    
    $jsonBody = $Body | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Uri "http://localhost:3000$Endpoint" -Method POST -Body $jsonBody -ContentType "application/json"
}

# Función para hacer PUT requests
function Put-Api {
    param(
        [string]$Endpoint,
        [hashtable]$Body
    )
    
    $jsonBody = $Body | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Uri "http://localhost:3000$Endpoint" -Method PUT -Body $jsonBody -ContentType "application/json"
}

# Función para hacer DELETE requests
function Delete-Api {
    param(
        [string]$Endpoint
    )
    
    Invoke-RestMethod -Uri "http://localhost:3000$Endpoint" -Method DELETE
}
```

### Uso de las funciones:

```powershell
# GET categorías
Get-Api -Endpoint "/api/categories"

# GET productos con filtros
Get-Api -Endpoint "/api/products" -QueryParams @{ page = 1; limit = 10 }

# POST crear categoría
Post-Api -Endpoint "/api/categories" -Body @{
    name = "Electrónicos"
    slug = "electronicos"
}

# POST crear producto
Post-Api -Endpoint "/api/products" -Body @{
    name = "Laptop"
    slug = "laptop"
    price = "999.99"
    stock = 5
}

# PUT actualizar producto
Put-Api -Endpoint "/api/products/TU-UUID" -Body @{
    price = "899.99"
}

# DELETE eliminar producto
Delete-Api -Endpoint "/api/products/TU-UUID"
```

---

## 🐛 Solución de Errores

### Error: "No se encuentra ningún parámetro que coincida con el nombre del parámetro 'X'"
**Solución:** Usa `-Method` en lugar de `-X`:
```powershell
# ❌ Incorrecto
curl -X POST ...

# ✅ Correcto
Invoke-RestMethod -Uri "..." -Method POST
```

### Error: "El término '-H' no se reconoce"
**Solución:** Usa `-ContentType` en lugar de `-H`:
```powershell
# ❌ Incorrecto
curl -H "Content-Type: application/json" ...

# ✅ Correcto
Invoke-RestMethod -ContentType "application/json" ...
```

### Error 500 en el servidor
**Posibles causas:**
1. Variables de entorno no cargadas
2. Error de conexión con Supabase
3. Error en la consulta SQL

**Solución:** Revisa los logs del servidor Next.js para ver el error específico.

---

## 🎯 Ejemplos Rápidos

### Listar categorías
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/categories"
```

### Crear categoría
```powershell
$body = @{ name = "Test"; slug = "test" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/api/categories" -Method POST -Body $body -ContentType "application/json"
```

### Listar productos
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/products"
```

### Crear producto simple
```powershell
$body = @{
    name = "Producto Test"
    slug = "producto-test"
    price = "50.00"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json"
```

