# Script específico para asignar rol 'manager' al usuario test3@toludev.com
# ID: d313f235-0b29-46fa-9e34-6396c1ae991d

$BaseUrl = "http://localhost:3000"
$UserId = "d313f235-0b29-46fa-9e34-6396c1ae991d"
$Role = "manager"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Asignar Rol a Usuario" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Usuario: test3@toludev.com" -ForegroundColor Yellow
Write-Host "ID: $UserId" -ForegroundColor Gray
Write-Host "Rol a asignar: $Role" -ForegroundColor Yellow
Write-Host ""

# Paso 1: Obtener token de admin
Write-Host "⚠️  PASO 1: Necesitas hacer login como admin primero" -ForegroundColor Yellow
Write-Host ""
Write-Host "Ejecuta este comando para obtener el token:" -ForegroundColor Cyan
Write-Host ""
Write-Host '$loginResponse = Invoke-RestMethod -Uri "' -NoNewline -ForegroundColor Gray
Write-Host "$BaseUrl/api/auth/login" -NoNewline -ForegroundColor White
Write-Host '" -Method POST -ContentType "application/json" -Body ''{"email":"admin@example.com","password":"tu_password"}''' -ForegroundColor Gray
Write-Host '$adminToken = $loginResponse.session.access_token' -ForegroundColor Gray
Write-Host ""
Write-Host "O ingresa el token directamente:" -ForegroundColor Cyan
$adminToken = Read-Host "Token del admin"

# Limpiar el token de caracteres de control y espacios
$adminToken = $adminToken -replace "[\x00-\x1F\x7F]", ""  # Remover caracteres de control
$adminToken = $adminToken.Trim()  # Remover espacios al inicio y final

if ([string]::IsNullOrWhiteSpace($adminToken)) {
    Write-Host "❌ Token requerido" -ForegroundColor Red
    exit 1
}

# Validar que el token tenga formato básico de JWT (tiene puntos)
if ($adminToken -notmatch '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') {
    Write-Host "⚠️  Advertencia: El token no parece tener formato JWT válido" -ForegroundColor Yellow
    Write-Host "   ¿Estás seguro de que es el access_token correcto? (S/N)" -ForegroundColor Yellow
    $confirm = Read-Host
    if ($confirm -ne "S" -and $confirm -ne "s" -and $confirm -ne "Y" -and $confirm -ne "y") {
        Write-Host "❌ Operación cancelada" -ForegroundColor Red
        exit 1
    }
}

# Paso 2: Asignar rol
Write-Host ""
Write-Host "PASO 2: Asignando rol '$Role' al usuario..." -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

$body = @{
    role = $Role
} | ConvertTo-Json -Compress

try {
    # Validar que el servidor esté disponible
    Write-Host "Verificando conexión con el servidor..." -ForegroundColor Gray
    $testConnection = try {
        Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method OPTIONS -TimeoutSec 5 -ErrorAction Stop
        $true
    } catch {
        $false
    }
    
    if (-not $testConnection) {
        Write-Host "⚠️  No se pudo conectar con el servidor en $BaseUrl" -ForegroundColor Yellow
        Write-Host "   ¿Está el servidor corriendo?" -ForegroundColor Yellow
    }
    
    Write-Host "Enviando solicitud..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/admin/users/$UserId/role" -Method PATCH -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host ""
    Write-Host "✅ ¡Rol asignado correctamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usuario:" -ForegroundColor Cyan
    Write-Host "  ID: $($response.user.id)" -ForegroundColor Gray
    Write-Host "  Email: test3@toludev.com" -ForegroundColor Gray
    Write-Host "  Rol: $($response.user.role)" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  IMPORTANTE - Próximos Pasos" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. El usuario test3@toludev.com debe hacer LOGOUT" -ForegroundColor Yellow
    Write-Host "2. Luego hacer LOGIN nuevamente" -ForegroundColor Yellow
    Write-Host "3. El nuevo token JWT incluirá el rol 'manager'" -ForegroundColor Yellow
    Write-Host "4. Ahora podrá confirmar pagos en /api/payments/:id/confirm" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Error al asignar rol:" -ForegroundColor Red
    Write-Host ""
    
    # Intentar obtener detalles del error
    $errorMessage = $_.Exception.Message
    $statusCode = $null
    
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode.value__
        Write-Host "  Código de estado: $statusCode" -ForegroundColor Red
    }
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "  Error: $($errorDetails.error)" -ForegroundColor Red
            if ($errorDetails.details) {
                Write-Host "  Detalles: $($errorDetails.details)" -ForegroundColor Red
            }
            if ($errorDetails.message) {
                Write-Host "  Mensaje: $($errorDetails.message)" -ForegroundColor Red
            }
        } catch {
            Write-Host "  $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "  $errorMessage" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Posibles causas:" -ForegroundColor Yellow
    
    if ($statusCode -eq 401) {
        Write-Host "  ❌ Token inválido o expirado" -ForegroundColor Red
        Write-Host "     → Haz login nuevamente para obtener un token fresco" -ForegroundColor Gray
    } elseif ($statusCode -eq 403) {
        Write-Host "  ❌ El usuario no tiene permisos de admin" -ForegroundColor Red
        Write-Host "     → Usa un token de un usuario con rol 'admin' o 'super_admin'" -ForegroundColor Gray
    } elseif ($statusCode -eq 404) {
        Write-Host "  ❌ Usuario no encontrado" -ForegroundColor Red
        Write-Host "     → Verifica que el userId sea correcto: $UserId" -ForegroundColor Gray
    } elseif ($statusCode -eq 400) {
        Write-Host "  ❌ Datos inválidos" -ForegroundColor Red
        Write-Host "     → Verifica que el rol sea válido: $Role" -ForegroundColor Gray
    } elseif ($null -eq $statusCode) {
        Write-Host "  ❌ No se pudo conectar con el servidor" -ForegroundColor Red
        Write-Host "     → Verifica que el servidor esté corriendo en $BaseUrl" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "Para obtener un token válido, ejecuta:" -ForegroundColor Cyan
    Write-Host '  $loginResponse = Invoke-RestMethod -Uri "' -NoNewline -ForegroundColor Gray
    Write-Host "$BaseUrl/api/auth/login" -NoNewline -ForegroundColor White
    Write-Host '" -Method POST -ContentType "application/json" -Body ''{"email":"admin@example.com","password":"tu_password"}''' -ForegroundColor Gray
    Write-Host '  $adminToken = $loginResponse.session.access_token' -ForegroundColor Gray
    Write-Host '  Write-Host $adminToken' -ForegroundColor Gray
    Write-Host ""
    
    exit 1
}

