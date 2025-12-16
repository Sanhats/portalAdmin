Write-Host "=== Prueba SPRINT 9 - Destacados y visibilidad (is_featured / status) ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que el servidor esté corriendo
Write-Host "1. Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET -ErrorAction Stop
    Write-Host "   [OK] Servidor funcionando" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Servidor no disponible. Ejecuta: npm run dev" -ForegroundColor Red
    exit 1
}

# 2. Obtener token de admin (login)
Write-Host ""
Write-Host "2. Obteniendo token de admin (login)..." -ForegroundColor Yellow
$email = Read-Host "   Ingresa el email del admin"
$password = Read-Host "   Ingresa la contraseña" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

try {
    $loginBody = @{
        email = $email
        password = $plainPassword
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $login.session.access_token
    Write-Host "   [OK] Login exitoso!" -ForegroundColor Green
    Write-Host ("   Usuario: {0}" -f $login.user.email) -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Error en login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$authHeaders = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

# 3. Buscar un producto activo para probar is_featured
Write-Host ""
Write-Host "3. Buscando un producto con status=active para probar is_featured..." -ForegroundColor Yellow

try {
    $listaActivos = Invoke-RestMethod -Uri "http://localhost:3000/api/products?status=active&limit=5" -Method GET
    $productosActivos = $listaActivos.data

    if (-not $productosActivos -or $productosActivos.Count -eq 0) {
        Write-Host "   [ADVERTENCIA] No se encontraron productos con status=active." -ForegroundColor Yellow
        exit 0
    }

    $producto = $productosActivos[0]
    Write-Host "   Producto seleccionado:" -ForegroundColor Cyan
    Write-Host ("      ID: {0}" -f $producto.id) -ForegroundColor Gray
    Write-Host ("      Nombre: {0}" -f $producto.name) -ForegroundColor Gray
    Write-Host ("      is_featured (actual): {0}" -f $producto.is_featured) -ForegroundColor Gray
    Write-Host ("      status (actual): {0}" -f $producto.status) -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] No se pudo obtener productos activos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 4. Alternar is_featured con PATCH /api/products/:id
Write-Host ""
Write-Host "4. Alternando is_featured con PATCH /api/products/:id ..." -ForegroundColor Yellow

$nuevoFeatured = -not [bool]$producto.is_featured
$bodyToggle = @{
    is_featured = $nuevoFeatured
} | ConvertTo-Json

try {
    $respuesta = Invoke-RestMethod -Uri ("http://localhost:3000/api/products/{0}" -f $producto.id) `
        -Method PATCH -Body $bodyToggle -Headers $authHeaders

    Write-Host "   [OK] Respuesta de PATCH:" -ForegroundColor Green
    $respuesta | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Gray

    Write-Host "   Valores devueltos:" -ForegroundColor Cyan

    Write-Host ("      is_featured: {0}" -f $respuesta.is_featured) -ForegroundColor Gray
    Write-Host ("      is_active:   {0}" -f $respuesta.is_active) -ForegroundColor Gray
    Write-Host ("      is_visible:  {0}" -f $respuesta.is_visible) -ForegroundColor Gray
    Write-Host ("      status:      {0}" -f $respuesta.status) -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Error al actualizar is_featured: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# 5. Verificar con GET /api/products/:id
Write-Host ""
Write-Host "5. Verificando GET /api/products/:id..." -ForegroundColor Yellow

try {
    $detalle = Invoke-RestMethod -Uri ("http://localhost:3000/api/products/{0}" -f $producto.id) -Method GET

    Write-Host "   Producto (detalle):" -ForegroundColor Cyan
    Write-Host ("      is_featured: {0}" -f $detalle.is_featured) -ForegroundColor Gray
    Write-Host ("      is_active:   {0}" -f $detalle.is_active) -ForegroundColor Gray
    Write-Host ("      is_visible:  {0}" -f $detalle.is_visible) -ForegroundColor Gray
    Write-Host ("      status:      {0}" -f $detalle.status) -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Error al obtener detalle del producto: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Probar filtro GET /products?isFeatured=true&status=active
Write-Host ""
Write-Host "6. Probando GET /api/products?isFeatured=true&status=active..." -ForegroundColor Yellow

try {
    $destacados = Invoke-RestMethod -Uri "http://localhost:3000/api/products?isFeatured=true&status=active&limit=10" -Method GET
    $listaDestacados = $destacados.data

    Write-Host ("   Se encontraron {0} productos destacados activos." -f ($listaDestacados.Count)) -ForegroundColor Cyan
    $listaDestacados | ForEach-Object {
        Write-Host ("      ID: {0} | Nombre: {1} | is_featured: {2} | status: {3}" -f $_.id, $_.name, $_.is_featured, $_.status) -ForegroundColor Gray
    }
} catch {
    Write-Host "   [ERROR] Error al obtener productos destacados: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Fin prueba destacados y visibilidad ===" -ForegroundColor Cyan
Write-Host ""


