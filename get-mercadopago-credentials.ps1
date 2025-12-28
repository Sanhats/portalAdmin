# Script: Obtener Credenciales de Mercado Pago
# Este script solo obtiene las credenciales sin configurar el backend

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ExternalPosId = "POS_PRINCIPAL_01",
    
    [Parameter(Mandatory=$false)]
    [string]$PosName = "POS Principal"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Obtener Credenciales Mercado Pago" -ForegroundColor Cyan
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
            Write-Host "Leyendo Access Token desde .env.local..." -ForegroundColor Gray
            $envLines = Get-Content $envFile
            foreach ($line in $envLines) {
                if ($line -match '^MERCADOPAGO_ACCESS_TOKEN\s*=\s*(.+)$') {
                    $AccessToken = $matches[1].Trim()
                    # Remover comillas si las tiene (simples o dobles)
                    if ($AccessToken.StartsWith('"') -and $AccessToken.EndsWith('"')) {
                        $AccessToken = $AccessToken.Substring(1, $AccessToken.Length - 2)
                    }
                    if ($AccessToken.StartsWith("'") -and $AccessToken.EndsWith("'")) {
                        $AccessToken = $AccessToken.Substring(1, $AccessToken.Length - 2)
                    }
                    Write-Host "Access Token encontrado en .env.local" -ForegroundColor Green
                    break
                }
            }
        }
    } else {
        Write-Host "Access Token encontrado en variables de entorno" -ForegroundColor Green
    }
}

# Verificar access token
if ([string]::IsNullOrEmpty($AccessToken)) {
    Write-Host "ERROR: Access Token no encontrado" -ForegroundColor Red
    Write-Host "   Opciones:" -ForegroundColor Yellow
    Write-Host "   1. Configura MERCADOPAGO_ACCESS_TOKEN en variables de entorno" -ForegroundColor Gray
    Write-Host "   2. Asegúrate de tener .env.local con MERCADOPAGO_ACCESS_TOKEN=..." -ForegroundColor Gray
    Write-Host "   3. O pásalo como parámetro: -AccessToken 'APP_USR-...'" -ForegroundColor Gray
    exit 1
}

Write-Host "Access Token: $($AccessToken.Substring(0, 20))..." -ForegroundColor Green
Write-Host ""

# Obtener User ID
Write-Host "[1/2] Obteniendo User ID (Collector ID)..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type" = "application/json"
    }
    
    $userResponse = Invoke-RestMethod -Uri "https://api.mercadopago.com/users/me" -Method GET -Headers $headers -ErrorAction Stop
    
    $userId = $userResponse.id.ToString()
    $nickname = $userResponse.nickname
    $email = $userResponse.email
    
    Write-Host "User ID obtenido exitosamente" -ForegroundColor Green
    Write-Host ""
} catch {
        Write-Host "ERROR al obtener User ID: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Gray
    }
    exit 1
}

# Crear o verificar POS
Write-Host "[2/2] Creando/Verificando POS..." -ForegroundColor Yellow

$existingPos = $null

# Primero listar POS existentes para verificar formato
Write-Host "   Listando POS existentes..." -ForegroundColor Gray
try {
    $existingPosResponse = Invoke-RestMethod -Uri "https://api.mercadopago.com/pos" -Method GET -Headers $headers -ErrorAction Stop
    if ($existingPosResponse) {
        Write-Host "   POS existentes encontrados: $($existingPosResponse.Count)" -ForegroundColor Gray
        $existingPos = $existingPosResponse | Where-Object { $_.external_id -eq $ExternalPosId } | Select-Object -First 1
        if ($existingPos) {
            Write-Host "   POS con external_id '$ExternalPosId' ya existe, usando existente" -ForegroundColor Yellow
            Write-Host "POS existente encontrado" -ForegroundColor Green
            Write-Host ""
        }
    }
} catch {
    Write-Host "   No se pudieron listar POS existentes (continuando...)" -ForegroundColor Gray
}

# Crear nuevo POS si no existe
if (-not $existingPos) {
    Write-Host "   Creando nuevo POS..." -ForegroundColor Gray
    try {
        # Formato correcto según documentación de Mercado Pago
        $posBody = @{
            name = $PosName
            fixed_amount = $false
            category = 621102
            external_id = $ExternalPosId
        } | ConvertTo-Json -Depth 10
        
        Write-Host "   Body de la solicitud:" -ForegroundColor Gray
        Write-Host $posBody -ForegroundColor DarkGray
        
        $posResponse = Invoke-RestMethod -Uri "https://api.mercadopago.com/pos" -Method POST -Headers $headers -Body $posBody -ErrorAction Stop
        
        Write-Host "POS creado exitosamente" -ForegroundColor Green
        Write-Host "   POS ID: $($posResponse.id)" -ForegroundColor Gray
        Write-Host "   External ID: $($posResponse.external_id)" -ForegroundColor Gray
        Write-Host ""
    } catch {
        $errorMessage = $_.Exception.Message
        
        if ($errorMessage -like "*already exists*" -or $errorMessage -like "*duplicate*") {
            Write-Host "ADVERTENCIA: POS con external_id '$ExternalPosId' ya existe" -ForegroundColor Yellow
            
            # Obtener POS existente
            try {
                $existingPosResponse = Invoke-RestMethod -Uri "https://api.mercadopago.com/pos" -Method GET -Headers $headers -ErrorAction Stop
                $existingPos = $existingPosResponse | Where-Object { $_.external_id -eq $ExternalPosId } | Select-Object -First 1
                
                if ($existingPos) {
                    Write-Host "POS existente encontrado" -ForegroundColor Green
                    Write-Host ""
                }
            } catch {
                Write-Host "ADVERTENCIA: No se pudo verificar POS existente" -ForegroundColor Yellow
            }
        } else {
        Write-Host "ERROR al crear POS: $errorMessage" -ForegroundColor Red
        try {
            $errorResponse = $_.Exception.Response
            if ($errorResponse) {
                $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "   Detalles del error:" -ForegroundColor Yellow
                Write-Host "   $responseBody" -ForegroundColor Gray
                
                # Intentar parsear JSON si es posible
                try {
                    $errorJson = $responseBody | ConvertFrom-Json
                    if ($errorJson.message) {
                        Write-Host "   Mensaje: $($errorJson.message)" -ForegroundColor Yellow
                    }
                    if ($errorJson.cause) {
                        Write-Host "   Causa: $($errorJson.cause | ConvertTo-Json -Compress)" -ForegroundColor Yellow
                    }
                } catch {
                    # No es JSON, mostrar texto plano
                }
            }
        } catch {
            Write-Host "   No se pudo obtener detalles del error" -ForegroundColor Gray
        }
        
        Write-Host ""
        Write-Host "Posibles causas:" -ForegroundColor Yellow
        Write-Host "  1. El external_id '$ExternalPosId' ya existe" -ForegroundColor Gray
        Write-Host "  2. El access token no tiene permisos para crear POS" -ForegroundColor Gray
        Write-Host "  3. Datos inválidos en la solicitud" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Intenta con un external_id diferente o verifica el POS existente" -ForegroundColor Cyan
            exit 1
        }
    }
}

# Mostrar resumen
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Credenciales Obtenidas" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Información del Comercio:" -ForegroundColor White
Write-Host "  Nombre: $nickname" -ForegroundColor Gray
Write-Host "  Email: $email" -ForegroundColor Gray
Write-Host ""
Write-Host "Credenciales para Backend:" -ForegroundColor White
Write-Host "  MERCADOPAGO_USER_ID=$userId" -ForegroundColor Yellow
Write-Host "  MERCADOPAGO_EXTERNAL_POS_ID=$ExternalPosId" -ForegroundColor Yellow
Write-Host ""
Write-Host 'SQL para configurar en Supabase:' -ForegroundColor White
Write-Host ('  UPDATE payment_gateways') -ForegroundColor DarkGray
Write-Host ('  SET config = jsonb_set(') -ForegroundColor DarkGray
Write-Host ('    jsonb_set(') -ForegroundColor DarkGray
Write-Host ('      COALESCE(config, {}::jsonb),') -ForegroundColor DarkGray
Write-Host ('      {mercadopago_user_id},') -ForegroundColor DarkGray
Write-Host ('      {0}' -f $userId) -ForegroundColor DarkGray
Write-Host ('    ),') -ForegroundColor DarkGray
Write-Host ('    {mercadopago_external_pos_id},') -ForegroundColor DarkGray
Write-Host ('      {0}' -f $ExternalPosId) -ForegroundColor DarkGray
Write-Host ('  ), enabled = true') -ForegroundColor DarkGray
Write-Host ('  WHERE provider = mercadopago AND tenant_id = TU_TENANT_ID;') -ForegroundColor DarkGray
Write-Host ""
Write-Host 'Alternativa: ejecuta el script completo' -ForegroundColor White
Write-Host ('  .\setup-mercadopago-instore.ps1 -TenantId TU_TENANT_ID') -ForegroundColor Yellow
Write-Host ""

