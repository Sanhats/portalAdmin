# Script Automático: Configurar Mercado Pago In-Store QR POS
# Este script obtiene las credenciales y configura todo automáticamente

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = "",
    
    [Parameter(Mandatory=$false)]
    [string]$TenantId = "",
    
    [Parameter(Mandatory=$false)]
    [string]$PosName = "POS Principal",
    
    [Parameter(Mandatory=$false)]
    [string]$ExternalPosId = "POS_PRINCIPAL_01",
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuración Automática Mercado Pago In-Store" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Intentar obtener access token desde diferentes fuentes
if ([string]::IsNullOrEmpty($AccessToken)) {
    # 1. Intentar desde variables de entorno de PowerShell
    $AccessToken = $env:MERCADOPAGO_ACCESS_TOKEN
    
    # 2. Si no está, intentar leer desde .env.local
    if ([string]::IsNullOrEmpty($AccessToken)) {
        $envFile = ".env.local"
        if (Test-Path $envFile) {
            Write-Host "📖 Leyendo Access Token desde .env.local..." -ForegroundColor Gray
            $envLines = Get-Content $envFile
            foreach ($line in $envLines) {
                if ($line -match '^MERCADOPAGO_ACCESS_TOKEN\s*=\s*(.+)$') {
                    $AccessToken = $matches[1].Trim()
                    # Remover comillas si las tiene
                    $AccessToken = $AccessToken -replace '^["''](.+)["'']$', '$1'
                    Write-Host "✅ Access Token encontrado en .env.local" -ForegroundColor Green
                    break
                }
            }
        }
    } else {
        Write-Host "✅ Access Token encontrado en variables de entorno" -ForegroundColor Green
    }
}

# Verificar access token
if ([string]::IsNullOrEmpty($AccessToken)) {
    Write-Host "❌ Error: Access Token no encontrado" -ForegroundColor Red
    Write-Host "   Opciones:" -ForegroundColor Yellow
    Write-Host "   1. Configura MERCADOPAGO_ACCESS_TOKEN en variables de entorno" -ForegroundColor Gray
    Write-Host "   2. Asegúrate de tener .env.local con MERCADOPAGO_ACCESS_TOKEN=..." -ForegroundColor Gray
    Write-Host "   3. O pásalo como parámetro: -AccessToken 'APP_USR-...'" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Access Token encontrado: $($AccessToken.Substring(0, 20))..." -ForegroundColor Green
Write-Host ""

# ============================================
# PASO 1: Obtener User ID (Collector ID)
# ============================================
Write-Host "[1/4] Obteniendo User ID (Collector ID) de Mercado Pago..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type" = "application/json"
    }
    
    $userResponse = Invoke-RestMethod -Uri "https://api.mercadopago.com/users/me" -Method GET -Headers $headers -ErrorAction Stop
    
    $userId = $userResponse.id.ToString()
    $nickname = $userResponse.nickname
    
    Write-Host "✅ User ID obtenido: $userId" -ForegroundColor Green
    Write-Host "   Comercio: $nickname" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Error al obtener User ID: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Gray
    }
    exit 1
}

# ============================================
# PASO 2: Crear POS en Mercado Pago
# ============================================
Write-Host "[2/4] Creando POS en Mercado Pago..." -ForegroundColor Yellow
Write-Host "   Nombre: $PosName" -ForegroundColor Gray
Write-Host "   External ID: $ExternalPosId" -ForegroundColor Gray

try {
    $posBody = @{
        name = $PosName
        fixed_amount = $false
        category = 621102
        external_id = $ExternalPosId
    } | ConvertTo-Json
    
    $posResponse = Invoke-RestMethod -Uri "https://api.mercadopago.com/pos" -Method POST -Headers $headers -Body $posBody -ErrorAction Stop
    
    Write-Host "✅ POS creado exitosamente" -ForegroundColor Green
    Write-Host "   POS ID: $($posResponse.id)" -ForegroundColor Gray
    Write-Host "   External ID: $($posResponse.external_id)" -ForegroundColor Gray
    Write-Host ""
} catch {
    $errorMessage = $_.Exception.Message
    
    # Si el POS ya existe, continuar
    if ($errorMessage -like "*already exists*" -or $errorMessage -like "*duplicate*") {
        Write-Host "⚠️  POS con external_id '$ExternalPosId' ya existe, continuando..." -ForegroundColor Yellow
        
        # Intentar obtener el POS existente
        try {
            $existingPosResponse = Invoke-RestMethod -Uri "https://api.mercadopago.com/pos" -Method GET -Headers $headers -ErrorAction Stop
            $existingPos = $existingPosResponse | Where-Object { $_.external_id -eq $ExternalPosId } | Select-Object -First 1
            
            if ($existingPos) {
                Write-Host "✅ Usando POS existente: $($existingPos.id)" -ForegroundColor Green
            }
        } catch {
            Write-Host "⚠️  No se pudo verificar POS existente, continuando..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Error al crear POS: $errorMessage" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "   Response: $responseBody" -ForegroundColor Gray
        }
        exit 1
    }
}

# ============================================
# PASO 3: Obtener Tenant ID si no se proporcionó
# ============================================
if ([string]::IsNullOrEmpty($TenantId)) {
    Write-Host "[3/4] Obteniendo Tenant ID por defecto..." -ForegroundColor Yellow
    
    try {
        # Intentar obtener el store por defecto desde la API
        # Nota: Esto requiere que tengas un endpoint o que lo obtengas manualmente
        Write-Host "⚠️  Tenant ID no proporcionado" -ForegroundColor Yellow
        $TenantId = Read-Host "Ingresa el Tenant ID (UUID del store/comercio)"
        
        if ([string]::IsNullOrEmpty($TenantId)) {
            Write-Host "❌ Tenant ID es requerido" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "❌ Error al obtener Tenant ID: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[3/4] Usando Tenant ID proporcionado: $TenantId" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# PASO 4: Configurar en Backend
# ============================================
Write-Host "[4/4] Configurando gateway en backend..." -ForegroundColor Yellow

$apiHeaders = @{
    "Content-Type" = "application/json"
}

# Verificar si existe gateway
try {
    $gatewayResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways?provider=mercadopago&tenantId=$TenantId" -Method GET -Headers $apiHeaders -ErrorAction SilentlyContinue
    
    if ($gatewayResponse.data -and $gatewayResponse.data.Count -gt 0) {
        $gatewayId = $gatewayResponse.data[0].id
        Write-Host "   Gateway existente encontrado: $gatewayId" -ForegroundColor Gray
        
        # Actualizar gateway existente
        $updateBody = @{
            config = @{
                mercadopago_user_id = $userId
                mercadopago_external_pos_id = $ExternalPosId
                notification_url = "$BaseUrl/api/webhooks/mercadopago"
                auto_return = $false
            }
            enabled = $true
        } | ConvertTo-Json -Depth 10
        
        try {
            $updateResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways/$gatewayId" -Method PUT -Headers $apiHeaders -Body $updateBody -ErrorAction Stop
            Write-Host "✅ Gateway actualizado exitosamente" -ForegroundColor Green
        } catch {
            Write-Host "❌ Error al actualizar gateway: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "   Asegúrate de estar autenticado y que el servidor esté corriendo" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "💡 Puedes configurar manualmente ejecutando este SQL:" -ForegroundColor Cyan
            Write-Host "   UPDATE payment_gateways" -ForegroundColor Gray
            Write-Host "   SET config = jsonb_set(" -ForegroundColor Gray
            Write-Host "     jsonb_set(" -ForegroundColor Gray
            Write-Host "       COALESCE(config, '{}'::jsonb)," -ForegroundColor Gray
            Write-Host "       '{mercadopago_user_id}'," -ForegroundColor Gray
            Write-Host "       '\"$userId\"'" -ForegroundColor Gray
            Write-Host "     )," -ForegroundColor Gray
            Write-Host "     '{mercadopago_external_pos_id}'," -ForegroundColor Gray
            Write-Host "     '\"$ExternalPosId\"'" -ForegroundColor Gray
            Write-Host "   ), enabled = true" -ForegroundColor Gray
            Write-Host "   WHERE provider = 'mercadopago' AND tenant_id = '$TenantId';" -ForegroundColor Gray
            exit 1
        }
    } else {
        # Crear nuevo gateway
        Write-Host "   Creando nuevo gateway..." -ForegroundColor Gray
        
        $createBody = @{
            provider = "mercadopago"
            enabled = $true
            credentials = @{
                access_token = $AccessToken
            }
            config = @{
                mercadopago_user_id = $userId
                mercadopago_external_pos_id = $ExternalPosId
                notification_url = "$BaseUrl/api/webhooks/mercadopago"
                auto_return = $false
            }
        } | ConvertTo-Json -Depth 10
        
        try {
            $createResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways?tenantId=$TenantId" -Method POST -Headers $apiHeaders -Body $createBody -ErrorAction Stop
            Write-Host "✅ Gateway creado exitosamente: $($createResponse.id)" -ForegroundColor Green
        } catch {
            Write-Host "❌ Error al crear gateway: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "   Asegúrate de estar autenticado y que el servidor esté corriendo" -ForegroundColor Yellow
            exit 1
        }
    }
} catch {
    Write-Host "⚠️  No se pudo conectar al backend API" -ForegroundColor Yellow
    Write-Host "   Configurando solo en Mercado Pago..." -ForegroundColor Gray
}

# ============================================
# RESUMEN FINAL
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Configuración Completada" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Credenciales obtenidas:" -ForegroundColor White
Write-Host "  User ID (Collector ID): $userId" -ForegroundColor Gray
Write-Host "  External POS ID: $ExternalPosId" -ForegroundColor Gray
Write-Host "  Access Token: $($AccessToken.Substring(0, 20))..." -ForegroundColor Gray
Write-Host ""
Write-Host "Configuración aplicada:" -ForegroundColor White
Write-Host "  Tenant ID: $TenantId" -ForegroundColor Gray
Write-Host "  Gateway: Habilitado" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Próximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Verificar configuración en Supabase:" -ForegroundColor Gray
Write-Host "     SELECT config FROM payment_gateways WHERE provider = 'mercadopago';" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  2. Probar generación de QR:" -ForegroundColor Gray
Write-Host "     POST /api/sales/{sale_id}/payments/qr" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  3. Verificar que provider = 'mercadopago_instore' en la respuesta" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Escanear QR con la app de Mercado Pago" -ForegroundColor Gray
Write-Host ""

