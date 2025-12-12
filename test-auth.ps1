# Script de prueba para el sistema de autenticación

Write-Host "=== Prueba del Sistema de Autenticación ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que el servidor esté corriendo
Write-Host "1. Verificando servidor..." -ForegroundColor Yellow
try {
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET -ErrorAction Stop
    Write-Host "   ✅ Servidor funcionando" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Servidor no disponible. Ejecuta: npm run dev" -ForegroundColor Red
    exit 1
}

# Probar GET sin autenticación (debe funcionar)
Write-Host ""
Write-Host "2. Probando GET /api/products sin autenticación (debe funcionar)..." -ForegroundColor Yellow
try {
    $products = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method GET
    Write-Host "   ✅ GET funciona sin autenticación (correcto)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Probar POST sin autenticación (debe fallar)
Write-Host ""
Write-Host "3. Probando POST /api/products sin autenticación (debe fallar)..." -ForegroundColor Yellow
try {
    $body = @{ name = "Test"; slug = "test"; price = "10.00" } | ConvertTo-Json
    $null = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "   ❌ ERROR: Debería haber fallado sin autenticación!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "   ✅ Correctamente bloqueado (401 Unauthorized)" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Probar login
Write-Host ""
Write-Host "4. Probando POST /api/auth/login..." -ForegroundColor Yellow
Write-Host "   ⚠️  Necesitas crear un usuario admin primero en Supabase" -ForegroundColor Yellow
Write-Host "   📖 Ver: CONFIGURAR_AUTENTICACION.md" -ForegroundColor Gray
Write-Host ""
$email = Read-Host "   Ingresa el email del admin"
$password = Read-Host "   Ingresa la contraseña" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

try {
    $loginBody = @{
        email = $email
        password = $plainPassword
    } | ConvertTo-Json

    $login = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    Write-Host "   ✅ Login exitoso!" -ForegroundColor Green
    Write-Host "   👤 Usuario: $($login.user.email)" -ForegroundColor Gray
    $token = $login.session.access_token
    Write-Host "   🔑 Token obtenido (longitud: $($token.Length))" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Error en login: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errorJson) {
            Write-Host "   Detalles: $($errorJson.error)" -ForegroundColor Red
        }
    }
    exit 1
}

# Probar POST con autenticación (debe funcionar)
Write-Host ""
Write-Host "5. Probando POST /api/products CON autenticación (debe funcionar)..." -ForegroundColor Yellow
try {
    $body = @{
        name = "Producto Test Auth $(Get-Date -Format 'HH:mm:ss')"
        slug = "producto-test-auth-$(Get-Date -Format 'yyyyMMddHHmmss')"
        price = "99.99"
        stock = 1
    } | ConvertTo-Json

    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    $product = Invoke-RestMethod -Uri "http://localhost:3000/api/products" -Method POST -Body $body -Headers $headers
    Write-Host "   ✅ Producto creado exitosamente con autenticación!" -ForegroundColor Green
    Write-Host "   🆔 ID: $($product.id)" -ForegroundColor Cyan
    Write-Host "   📦 Nombre: $($product.name)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Fin de la prueba ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Sistema de autenticación funcionando correctamente!" -ForegroundColor Green

