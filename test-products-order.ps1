Write-Host "=== Prueba SPRINT 9 - Orden manual de productos (PUT /api/products/order) ===" -ForegroundColor Cyan
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

# 2. Obtener algunos productos para probar el orden
Write-Host ""
Write-Host "2. Obteniendo primeros productos para probar el orden..." -ForegroundColor Yellow
try {
    $lista = Invoke-RestMethod -Uri "http://localhost:3000/api/products?limit=5" -Method GET
    $productos = $lista.data

    if (-not $productos -or $productos.Count -lt 2) {
        Write-Host "   [ADVERTENCIA] Se necesitan al menos 2 productos para probar el orden." -ForegroundColor Yellow
        exit 0
    }

    Write-Host "   Productos actuales (ID, Nombre, Position):" -ForegroundColor Cyan
    $productos | ForEach-Object {
        Write-Host ("      ID: {0}  |  Nombre: {1}  |  Position: {2}" -f $_.id, $_.name, ($_.position)) -ForegroundColor Gray
    }
} catch {
    Write-Host "   [ERROR] No se pudieron obtener productos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Preparar nuevo orden (invertir el orden de los primeros N productos)
Write-Host ""
Write-Host "3. Preparando nuevo orden (invertir orden de los primeros productos)..." -ForegroundColor Yellow

# Tomar los productos actuales ordenados por position (si todos son 0, usar el orden actual)
$productosOrdenados = $productos | Sort-Object position, name

Write-Host "   Orden actual:" -ForegroundColor Cyan
$i = 1
$productosOrdenados | ForEach-Object {
    Write-Host ("      Pos {0}: {1} (ID: {2}, Position actual: {3})" -f $i, $_.name, $_.id, $_.position) -ForegroundColor Gray
    $i++
}

# Crear un nuevo orden invertido
$nuevoOrden = @()
$posicion = 1
($productosOrdenados | Sort-Object position -Descending) | ForEach-Object {
    $nuevoOrden += @{
        id = $_.id
        position = $posicion
    }
    $posicion++
}

Write-Host ""
Write-Host "   Nuevo orden propuesto:" -ForegroundColor Cyan
$nuevoOrden | ForEach-Object {
    Write-Host ("      ID: {0}  ->  nueva position: {1}" -f $_.id, $_.position) -ForegroundColor Gray
}

$confirm = Read-Host "   Confirmar y enviar PUT /api/products/order con este orden? (s/N)"
if ($confirm -ne "s" -and $confirm -ne "S") {
    Write-Host "   [OMITIDO] No se envió la actualización de orden." -ForegroundColor Yellow
    exit 0
}

# 4. Obtener token de admin (login)
Write-Host ""
Write-Host "4. Obteniendo token de admin (login)..." -ForegroundColor Yellow
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
} catch {
    Write-Host "   [ERROR] Error en login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 5. Enviar PUT /api/products/order
Write-Host ""
Write-Host "5. Enviando PUT /api/products/order..." -ForegroundColor Yellow

$body = @{
    products = $nuevoOrden
} | ConvertTo-Json -Depth 5

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

try {
    $respuesta = Invoke-RestMethod -Uri "http://localhost:3000/api/products/order" -Method PUT -Body $body -Headers $headers
    Write-Host "   [OK] Respuesta:" -ForegroundColor Green
    $respuesta | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor Gray
} catch {
    Write-Host "   [ERROR] Error al actualizar el orden: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# 6. Verificar orden actualizado en GET /products
Write-Host ""
Write-Host "6. Verificando orden actualizado en GET /api/products..." -ForegroundColor Yellow

try {
    # Obtener todos los productos para verificar el orden completo
    $listaActualizada = Invoke-RestMethod -Uri "http://localhost:3000/api/products?limit=100" -Method GET
    $productosActualizados = $listaActualizada.data

    # Buscar los productos que se actualizaron
    $idsActualizados = $nuevoOrden | ForEach-Object { $_.id }
    
    Write-Host "   Productos que se actualizaron (verificando sus posiciones):" -ForegroundColor Cyan
    foreach ($item in $nuevoOrden) {
        $producto = $productosActualizados | Where-Object { $_.id -eq $item.id }
        if ($producto) {
            $esperado = $item.position
            $actual = $producto.position
            $icono = if ($actual -eq $esperado) { "[OK]" } else { "[ERROR]" }
            $color = if ($actual -eq $esperado) { "Green" } else { "Red" }
            Write-Host ("      $icono {0} (ID: {1}) - Position esperada: {2}, Position actual: {3}" -f $producto.name, $producto.id, $esperado, $actual) -ForegroundColor $color
        } else {
            Write-Host ("      [ERROR] No se encontró el producto con ID: {0}" -f $item.id) -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "   Primeros 10 productos tal como los devuelve la API (ordenados por position ASC, created_at DESC):" -ForegroundColor Cyan
    $j = 1
    $productosActualizados | Select-Object -First 10 | ForEach-Object {
        Write-Host ("      Pos {0}: {1} (ID: {2}, Position: {3})" -f $j, $_.name, $_.id, $_.position) -ForegroundColor Gray
        $j++
    }
    
    # Verificar si hay productos con la misma posición
    Write-Host ""
    Write-Host "   Verificando productos con posiciones duplicadas:" -ForegroundColor Cyan
    $posicionesDuplicadas = $productosActualizados | Group-Object position | Where-Object { $_.Count -gt 1 }
    if ($posicionesDuplicadas) {
        Write-Host "   [ADVERTENCIA] Se encontraron productos con la misma posición:" -ForegroundColor Yellow
        $posicionesDuplicadas | ForEach-Object {
            Write-Host ("      Position {0}: {1} productos" -f $_.Name, $_.Count) -ForegroundColor Yellow
            $_.Group | ForEach-Object {
                Write-Host ("         - {0} (ID: {1})" -f $_.name, $_.id) -ForegroundColor Gray
            }
        }
        Write-Host "   Nota: Cuando hay productos con la misma posición, se ordenan por created_at DESC" -ForegroundColor Gray
    } else {
        Write-Host "   [OK] No hay productos con posiciones duplicadas en los primeros productos" -ForegroundColor Green
    }
} catch {
    Write-Host "   [ERROR] Error al obtener productos actualizados: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Fin prueba orden de productos ===" -ForegroundColor Cyan
Write-Host ""


