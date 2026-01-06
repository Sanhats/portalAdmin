# Script para asignar rol a un usuario
# Uso: .\assign-user-role.ps1 -UserId "d313f235-0b29-46fa-9e34-6396c1ae991d" -Role "manager"

param(
    [Parameter(Mandatory=$true)]
    [string]$UserId,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet("admin", "super_admin", "manager", "cashier", "user")]
    [string]$Role,
    
    [string]$BaseUrl = "http://localhost:3000"
)

# Cargar variables de entorno desde .env.local si existe
if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local"
    foreach ($line in $envContent) {
        if ($line -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Obtener token de admin (necesitas hacer login primero)
Write-Host "⚠️  IMPORTANTE: Necesitas un token de admin para asignar roles" -ForegroundColor Yellow
Write-Host "1. Haz login con un usuario admin:" -ForegroundColor Cyan
Write-Host "   POST $BaseUrl/api/auth/login" -ForegroundColor Gray
Write-Host "   Body: { `"email`": `"admin@...`", `"password`": `"..."` }" -ForegroundColor Gray
Write-Host ""
$adminToken = Read-Host "2. Ingresa el access_token del admin"

if ([string]::IsNullOrWhiteSpace($adminToken)) {
    Write-Host "❌ Token requerido" -ForegroundColor Red
    exit 1
}

# Asignar rol
Write-Host ""
Write-Host "Asignando rol '$Role' al usuario $UserId..." -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

$body = @{
    role = $Role
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/admin/users/$UserId/role" -Method PATCH -Headers $headers -Body $body
    
    Write-Host ""
    Write-Host "✅ Rol asignado correctamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usuario:" -ForegroundColor Cyan
    Write-Host "  ID: $($response.user.id)" -ForegroundColor Gray
    Write-Host "  Rol: $($response.user.role)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📝 Nota: El usuario debe hacer logout y login nuevamente para que el nuevo rol se refleje en el token JWT" -ForegroundColor Yellow
} catch {
    Write-Host ""
    Write-Host "❌ Error al asignar rol:" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "  $($errorDetails.error)" -ForegroundColor Red
        if ($errorDetails.details) {
            Write-Host "  Detalles: $($errorDetails.details)" -ForegroundColor Red
        }
    } else {
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}

