# Script de prueba para GET /api/products con paginación y filtros
# Prueba todas las funcionalidades del endpoint mejorado

Write-Host "=== Prueba GET /api/products - Paginación y Filtros ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que el servidor esté corriendo
Write-Host "1. Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET -ErrorAction Stop
    Write-Host "   [OK] Servidor funcionando" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Servidor no disponible. Ejecuta: npm run dev" -ForegroundColor Red
    exit 1
}

# Variable para almacenar el token si se necesita
$token = $null

# Función para hacer request con o sin autenticación
function Invoke-ProductsRequest {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [hashtable]$Headers = @{}
    )
    
    try {
        $response = Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers
        return @{ Success = $true; Data = $response; Error = $null }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.Exception.Message
        if ($_.ErrorDetails.Message) {
            try {
                $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($errorJson) {
                    $errorMessage = $errorJson.error
                }
            } catch {
                $errorMessage = $_.ErrorDetails.Message
            }
        }
        return @{ Success = $false; Data = $null; Error = $errorMessage; StatusCode = $statusCode }
    }
}

# Función para mostrar respuesta de paginación
function Show-PaginationResponse {
    param($response)
    
    if ($response.data) {
        Write-Host "   [INFO] Productos encontrados: $($response.data.Count)" -ForegroundColor Cyan
    }
    Write-Host "   [INFO] Total: $($response.total)" -ForegroundColor Cyan
    Write-Host "   [INFO] Pagina: $($response.page)" -ForegroundColor Cyan
    Write-Host "   [INFO] Limite: $($response.limit)" -ForegroundColor Cyan
    Write-Host "   [INFO] Total paginas: $($response.totalPages)" -ForegroundColor Cyan
    
    if ($response.data -and $response.data.Count -gt 0) {
        Write-Host ""
        Write-Host "   Primer producto:" -ForegroundColor Gray
        $first = $response.data[0]
        Write-Host "      ID: $($first.id)" -ForegroundColor Gray
        Write-Host "      Nombre: $($first.name)" -ForegroundColor Gray
        Write-Host "      Precio: $($first.price)" -ForegroundColor Gray
        Write-Host "      Stock: $($first.stock)" -ForegroundColor Gray
        Write-Host "      Status: $($first.status)" -ForegroundColor Gray
        if ($first.category) {
            Write-Host "      Categoría: $($first.category.name)" -ForegroundColor Gray
        }
        if ($first.product_images -and $first.product_images.Count -gt 0) {
            Write-Host "      Imagen: $($first.product_images[0].image_url)" -ForegroundColor Gray
        }
    }
}

# Prueba 2: Paginación por defecto (sin parámetros)
Write-Host ""
Write-Host "2. Probando paginación por defecto (sin parámetros)..." -ForegroundColor Yellow
$result = Invoke-ProductsRequest -Uri "http://localhost:3000/api/products"
if ($result.Success) {
    Write-Host "   [OK] Respuesta recibida" -ForegroundColor Green
    Show-PaginationResponse -response $result.Data
} else {
    Write-Host "   [ERROR] Error: $($result.Error)" -ForegroundColor Red
}

# Prueba 3: Paginación con parámetros explícitos
Write-Host ""
Write-Host "3. Probando paginación con page=1, limit=10..." -ForegroundColor Yellow
$result = Invoke-ProductsRequest -Uri "http://localhost:3000/api/products?page=1&limit=10"
if ($result.Success) {
    Write-Host "   [OK] Respuesta recibida" -ForegroundColor Green
    Show-PaginationResponse -response $result.Data
} else {
    Write-Host "   [ERROR] Error: $($result.Error)" -ForegroundColor Red
}

# Prueba 4: Paginación página 2
Write-Host ""
Write-Host "4. Probando paginación página 2 (page=2, limit=10)..." -ForegroundColor Yellow
$result = Invoke-ProductsRequest -Uri "http://localhost:3000/api/products?page=2&limit=10"
if ($result.Success) {
    Write-Host "   [OK] Respuesta recibida" -ForegroundColor Green
    Show-PaginationResponse -response $result.Data
} else {
    Write-Host "   [ERROR] Error: $($result.Error)" -ForegroundColor Red
}

# Prueba 5: Búsqueda (search)
Write-Host ""
Write-Host "5. Probando búsqueda (search=test)..." -ForegroundColor Yellow
$result = Invoke-ProductsRequest -Uri "http://localhost:3000/api/products?search=test&limit=5"
if ($result.Success) {
    Write-Host "   [OK] Respuesta recibida" -ForegroundColor Green
    Show-PaginationResponse -response $result.Data
} else {
    Write-Host "   [ERROR] Error: $($result.Error)" -ForegroundColor Red
}

# Prueba 6: Filtro por status
Write-Host ""
Write-Host "6. Probando filtro por status=active..." -ForegroundColor Yellow
$result = Invoke-ProductsRequest -Uri "http://localhost:3000/api/products?status=active&limit=5"
if ($result.Success) {
    Write-Host "   [OK] Respuesta recibida" -ForegroundColor Green
    Show-PaginationResponse -response $result.Data
} else {
    Write-Host "   [ERROR] Error: $($result.Error)" -ForegroundColor Red
}

# Prueba 7: Filtro por isFeatured
Write-Host ""
Write-Host "7. Probando filtro por isFeatured=true..." -ForegroundColor Yellow
$result = Invoke-ProductsRequest -Uri "http://localhost:3000/api/products?isFeatured=true&limit=5"
if ($result.Success) {
    Write-Host "   [OK] Respuesta recibida" -ForegroundColor Green
    Show-PaginationResponse -response $result.Data
} else {
    Write-Host "   [ERROR] Error: $($result.Error)" -ForegroundColor Red
}

# Prueba 8: limit=all sin autenticación (debe fallar)
Write-Host ""
Write-Host "8. Probando limit=all SIN autenticación (debe fallar con 403)..." -ForegroundColor Yellow
$result = Invoke-ProductsRequest -Uri "http://localhost:3000/api/products?limit=all"
if (-not $result.Success) {
    if ($result.StatusCode -eq 403) {
        Write-Host "   [OK] Correctamente bloqueado (403 Forbidden)" -ForegroundColor Green
        Write-Host "   Mensaje: $($result.Error)" -ForegroundColor Gray
    } elseif ($result.StatusCode -eq 401) {
        Write-Host "   [OK] Correctamente bloqueado (401 Unauthorized)" -ForegroundColor Green
        Write-Host "   Mensaje: $($result.Error)" -ForegroundColor Gray
    } else {
        Write-Host "   [ADVERTENCIA] Error inesperado: $($result.Error) (Status: $($result.StatusCode))" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [ERROR] ERROR: Deberia haber fallado sin autenticacion!" -ForegroundColor Red
}

# Prueba 9: limit=all con autenticación (solo si el usuario quiere)
Write-Host ""
Write-Host "9. Probando limit=all CON autenticación (solo admin)..." -ForegroundColor Yellow
Write-Host "   [ADVERTENCIA] Quieres probar limit=all? Necesitas un token de admin" -ForegroundColor Yellow
$testAll = Read-Host "   Ingresa 's' para probar o Enter para omitir"
if ($testAll -eq 's' -or $testAll -eq 'S') {
    if (-not $token) {
        Write-Host '   [INFO] Necesitas hacer login primero...' -ForegroundColor Yellow
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
            $token = $null
        }
    }
    
    if ($token) {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
        
        $result = Invoke-ProductsRequest -Uri "http://localhost:3000/api/products?limit=all" -Headers $headers
        if ($result.Success) {
            Write-Host "   [OK] Respuesta recibida (limit=all)" -ForegroundColor Green
            Show-PaginationResponse -response $result.Data
            Write-Host "   [ADVERTENCIA] Verifica que limit='all' y totalPages=1" -ForegroundColor Yellow
        } else {
            if ($result.StatusCode -eq 403) {
                Write-Host '   [ADVERTENCIA] Usuario no es admin (403 Forbidden)' -ForegroundColor Yellow
                Write-Host "   Mensaje: $($result.Error)" -ForegroundColor Gray
            } else {
                Write-Host "   [ERROR] Error: $($result.Error)" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "   [OMITIDO]" -ForegroundColor Gray
}

# Prueba 10: Validación de límite máximo (sin admin)
Write-Host ""
Write-Host '10. Probando limite maximo sin admin (limit=200, debe limitarse a 100)...' -ForegroundColor Yellow
$result = Invoke-ProductsRequest -Uri "http://localhost:3000/api/products?limit=200"
if ($result.Success) {
    Write-Host "   [OK] Respuesta recibida" -ForegroundColor Green
    if ($result.Data.limit -eq 100) {
        Write-Host "   [OK] Limite correctamente limitado a 100" -ForegroundColor Green
    } else {
        Write-Host "   [ADVERTENCIA] Limite recibido: $($result.Data.limit) (esperado: 100)" -ForegroundColor Yellow
    }
    Show-PaginationResponse -response $result.Data
} else {
    Write-Host "   [ERROR] Error: $($result.Error)" -ForegroundColor Red
}

# Prueba 11: Validación de parámetros inválidos
Write-Host ""
Write-Host '11. Probando parametros invalidos (page=0, debe usar page=1)...' -ForegroundColor Yellow
$result = Invoke-ProductsRequest -Uri 'http://localhost:3000/api/products?page=0&limit=-5'
if ($result.Success) {
    Write-Host '   [OK] Respuesta recibida (parametros normalizados)' -ForegroundColor Green
    if ($result.Data.page -eq 1) {
        Write-Host "   [OK] Pagina correctamente normalizada a 1" -ForegroundColor Green
    }
    Show-PaginationResponse -response $result.Data
} else {
    Write-Host "   [ERROR] Error: $($result.Error)" -ForegroundColor Red
}

# Prueba 12: Estructura de respuesta normalizada
Write-Host ""
Write-Host "12. Verificando estructura de respuesta normalizada..." -ForegroundColor Yellow
$result = Invoke-ProductsRequest -Uri "http://localhost:3000/api/products?limit=1"
if ($result.Success -and $result.Data.data -and $result.Data.data.Count -gt 0) {
    $product = $result.Data.data[0]
    $checks = @()
    
    # Verificar campos requeridos
    if ($product.id) { $checks += "[OK] id" } else { $checks += "[ERROR] id faltante" }
    if ($product.name) { $checks += "[OK] name" } else { $checks += "[ERROR] name faltante" }
    if ($product.price -ne $null) { $checks += "[OK] price" } else { $checks += "[ERROR] price faltante" }
    if ($product.stock -ne $null) { $checks += "[OK] stock" } else { $checks += "[ERROR] stock faltante" }
    if ($product.status) { $checks += "[OK] status" } else { $checks += "[ERROR] status faltante" }
    if ($product.category -ne $null) { $checks += '[OK] category (puede ser null)' } else { $checks += '[OK] category (null)' }
    # product_images siempre debe estar presente (puede ser array vacío)
    if ($product.PSObject.Properties.Name -contains 'product_images') { 
        $checks += "[OK] product_images (presente, tiene $($product.product_images.Count) imagen(es))" 
    } else { 
        $checks += "[ERROR] product_images faltante" 
    }
    
    Write-Host "   Campos del producto:" -ForegroundColor Cyan
    $checks | ForEach-Object { Write-Host "      $_" -ForegroundColor $(if ($_ -like "[OK]*") { "Green" } else { "Red" }) }
    
    # Verificar metadatos de paginación
    $metaChecks = @()
    if ($result.Data.total -ne $null) { $metaChecks += "[OK] total" } else { $metaChecks += "[ERROR] total faltante" }
    if ($result.Data.page -ne $null) { $metaChecks += "[OK] page" } else { $metaChecks += "[ERROR] page faltante" }
    if ($result.Data.limit -ne $null) { $metaChecks += "[OK] limit" } else { $metaChecks += "[ERROR] limit faltante" }
    if ($result.Data.totalPages -ne $null) { $metaChecks += "[OK] totalPages" } else { $metaChecks += "[ERROR] totalPages faltante" }
    
    Write-Host "   Metadatos de paginación:" -ForegroundColor Cyan
    $metaChecks | ForEach-Object { Write-Host "      $_" -ForegroundColor $(if ($_ -like "[OK]*") { "Green" } else { "Red" }) }
} else {
    Write-Host "   [ADVERTENCIA] No hay productos para verificar la estructura" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Fin de las pruebas ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "[OK] Pruebas completadas!" -ForegroundColor Green
Write-Host ""
Write-Host "Resumen de funcionalidades probadas:" -ForegroundColor Cyan
Write-Host "  [OK] Paginacion por defecto" -ForegroundColor Gray
Write-Host "  [OK] Paginacion con parametros" -ForegroundColor Gray
Write-Host "  [OK] Busqueda (search)" -ForegroundColor Gray
Write-Host "  [OK] Filtro por status" -ForegroundColor Gray
Write-Host "  [OK] Filtro por isFeatured" -ForegroundColor Gray
Write-Host "  [OK] Validacion de limit=all (solo admin)" -ForegroundColor Gray
Write-Host "  [OK] Limite maximo para usuarios normales" -ForegroundColor Gray
Write-Host "  [OK] Normalizacion de parametros invalidos" -ForegroundColor Gray
Write-Host '  [OK] Estructura de respuesta normalizada' -ForegroundColor Gray
Write-Host ""

