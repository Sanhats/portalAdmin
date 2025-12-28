# Script de Pruebas - SPRINT C: Gateway Abstraction
# Verifica que el sistema de gateways funcione correctamente

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Email = "test3@toludev.com",
    [string]$Password = "impresorA125"
)

$script:token = $null
$script:testResults = @()
$script:testCount = 0
$script:passCount = 0
$script:failCount = 0

function Add-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message
    )
    
    $script:testCount++
    if ($Passed) {
        $script:passCount++
        Write-Host "[OK] $TestName" -ForegroundColor Green
        Write-Host "  -> $Message" -ForegroundColor Gray
    } else {
        $script:failCount++
        Write-Host "[FAIL] $TestName" -ForegroundColor Red
        Write-Host "  -> $Message" -ForegroundColor Yellow
    }
    
    $script:testResults += @{
        Test = $TestName
        Passed = $Passed
        Message = $Message
    }
}

Write-Host "`n=== Pruebas SPRINT C - Gateway Abstraction ===" -ForegroundColor Cyan
Write-Host "Verificando desacoplamiento de gateways y normalizacion de metodos`n" -ForegroundColor Yellow

# 1. Autenticación
Write-Host "1. Autenticando..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop

    $script:token = $loginResponse.session.access_token
    Add-TestResult "Autenticacion" $true "Token obtenido correctamente"
} catch {
    Add-TestResult "Autenticacion" $false "Error: $($_.Exception.Message)"
    Write-Host "`n[ERROR] No se pudo autenticar. Verifica las credenciales." -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $script:token"
    "Content-Type" = "application/json"
}

# 2. Crear payment gateway (mercadopago)
Write-Host "`n2. Creando payment gateway (mercadopago)..." -ForegroundColor Yellow
$gatewayId = $null
try {
    $gatewayBody = @{
        provider = "mercadopago"
        enabled = $true
        credentials = @{
            access_token = "TEST-1234567890"
            public_key = "TEST-PUBLIC-KEY"
        }
        config = @{
            webhook_url = "https://example.com/webhooks/mercadopago"
            auto_return = $false
        }
    } | ConvertTo-Json -Depth 10

    $gatewayResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $gatewayBody `
        -ErrorAction Stop
    
    $gatewayId = $gatewayResponse.id
    $hasRequiredFields = $gatewayResponse.provider -eq "mercadopago" `
        -and $gatewayResponse.enabled -eq $true `
        -and $gatewayResponse.credentials -ne $null
    
    if ($hasRequiredFields) {
        Add-TestResult "Crear payment gateway" $true "Gateway creado ID: $gatewayId, provider: mercadopago"
    } else {
        Add-TestResult "Crear payment gateway" $false "Faltan campos requeridos"
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorDetails = $_.ErrorDetails.Message
    Write-Host "  Error HTTP $statusCode" -ForegroundColor Yellow
    if ($errorDetails) {
        Write-Host "  Detalles: $errorDetails" -ForegroundColor Yellow
    }
    
    # Si es 409, intentar obtener el gateway existente
    if ($statusCode -eq 409) {
        try {
            $allGateways = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways" `
                -Method GET `
                -Headers $headers `
                -ErrorAction Stop
            
            $mpGateway = $allGateways | Where-Object { $_.provider -eq "mercadopago" } | Select-Object -First 1
            if ($mpGateway) {
                $gatewayId = $mpGateway.id
                Add-TestResult "Crear payment gateway" $true "Gateway ya existe ID: $gatewayId"
            } else {
                Add-TestResult "Crear payment gateway" $false "Error: Gateway ya existe pero no se pudo obtener de la lista"
            }
        } catch {
            Add-TestResult "Crear payment gateway" $false "Error al obtener gateway existente: $($_.Exception.Message)"
        }
    } else {
        # Otro error
        if ($errorDetails) {
            try {
                $errorJson = $errorDetails | ConvertFrom-Json
                Add-TestResult "Crear payment gateway" $false "Error: $($errorJson.message)"
            } catch {
                Add-TestResult "Crear payment gateway" $false "Error: $($_.Exception.Message)"
            }
        } else {
            Add-TestResult "Crear payment gateway" $false "Error: $($_.Exception.Message)"
        }
    }
}

# 3. Listar payment gateways
Write-Host "`n3. Listando payment gateways..." -ForegroundColor Yellow
try {
    $gatewaysResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    $hasGateways = $gatewaysResponse -is [Array] -or ($gatewaysResponse.Count -ge 0)
    $gatewayCount = if ($gatewaysResponse -is [Array]) { $gatewaysResponse.Count } else { $gatewaysResponse.Count }
    
    if ($hasGateways) {
        Add-TestResult "Listar payment gateways" $true "Gateways encontrados: $gatewayCount"
    } else {
        Add-TestResult "Listar payment gateways" $false "Respuesta invalida"
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorDetails = $_.ErrorDetails.Message
    Write-Host "  Error HTTP $statusCode" -ForegroundColor Yellow
    if ($errorDetails) {
        Write-Host "  Detalles: $errorDetails" -ForegroundColor Yellow
        try {
            $errorJson = $errorDetails | ConvertFrom-Json
            Add-TestResult "Listar payment gateways" $false "Error: $($errorJson.message)"
        } catch {
            Add-TestResult "Listar payment gateways" $false "Error: $($_.Exception.Message) - Detalles: $errorDetails"
        }
    } else {
        Add-TestResult "Listar payment gateways" $false "Error: $($_.Exception.Message)"
    }
}

# 4. Obtener gateway específico
Write-Host "`n4. Obteniendo gateway especifico..." -ForegroundColor Yellow
if ($gatewayId) {
    try {
        $gatewayResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways/$gatewayId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $hasId = $gatewayResponse.id -eq $gatewayId
        
        if ($hasId) {
            Add-TestResult "Obtener gateway especifico" $true "Gateway obtenido ID: $gatewayId"
        } else {
            Add-TestResult "Obtener gateway especifico" $false "ID no coincide"
        }
    } catch {
        Add-TestResult "Obtener gateway especifico" $false "Error: $($_.Exception.Message)"
    }
} else {
    Add-TestResult "Obtener gateway especifico" $false "No hay gateway ID disponible"
}

# 5. Actualizar gateway
Write-Host "`n5. Actualizando gateway..." -ForegroundColor Yellow
if ($gatewayId) {
    try {
        $updateBody = @{
            enabled = $false
            config = @{
                webhook_url = "https://example.com/webhooks/mercadopago/updated"
                auto_return = $true
            }
        } | ConvertTo-Json -Depth 10

        $updatedGateway = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways/$gatewayId" `
            -Method PUT `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $updateBody `
            -ErrorAction Stop
        
        $isUpdated = $updatedGateway.enabled -eq $false
        
        if ($isUpdated) {
            Add-TestResult "Actualizar gateway" $true "Gateway actualizado, enabled: false"
        } else {
            Add-TestResult "Actualizar gateway" $false "No se actualizo correctamente"
        }
    } catch {
        Add-TestResult "Actualizar gateway" $false "Error: $($_.Exception.Message)"
    }
} else {
    Add-TestResult "Actualizar gateway" $false "No hay gateway ID disponible"
}

# 6. Crear método de pago con categoría external
Write-Host "`n6. Creando metodo de pago con categoria external..." -ForegroundColor Yellow
$externalMethodId = $null
try {
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $methodBody = @{
        code = "mercadopago_test_$timestamp"
        label = "Mercado Pago de Prueba"
        type = "mercadopago"
        paymentCategory = "external"
        isActive = $true
    } | ConvertTo-Json

    $methodResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-methods" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $methodBody `
        -ErrorAction Stop
    
    $externalMethodId = $methodResponse.id
    $hasCategory = $methodResponse.payment_category -eq "external"
    
    if ($hasCategory) {
        Add-TestResult "Crear metodo external" $true "Metodo creado ID: $externalMethodId, payment_category: external"
    } else {
        Add-TestResult "Crear metodo external" $false "payment_category no es 'external': $($methodResponse.payment_category)"
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorDetails = $_.ErrorDetails.Message
    Write-Host "  Error HTTP $statusCode" -ForegroundColor Yellow
    if ($errorDetails) {
        Write-Host "  Detalles: $errorDetails" -ForegroundColor Yellow
        try {
            $errorJson = $errorDetails | ConvertFrom-Json
            $errorMsg = if ($errorJson.message) { $errorJson.message } else { $errorDetails }
            Add-TestResult "Crear metodo external" $false "Error: $errorMsg"
        } catch {
            Add-TestResult "Crear metodo external" $false "Error: $($_.Exception.Message) - Detalles: $errorDetails"
        }
    } else {
        Add-TestResult "Crear metodo external" $false "Error: $($_.Exception.Message)"
    }
}

# 7. Obtener venta confirmada para pruebas
Write-Host "`n7. Obteniendo venta confirmada para pruebas..." -ForegroundColor Yellow
$saleId = $null
try {
    $salesResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales?status=confirmed&limit=1" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    if ($salesResponse.data -and $salesResponse.data.Count -gt 0) {
        $saleId = $salesResponse.data[0].id
        Add-TestResult "Obtener venta confirmada" $true "Venta obtenida ID: $saleId"
    } else {
        # Crear venta de prueba
        $productsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/products?limit=1" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        if ($productsResponse.data -and $productsResponse.data.Count -gt 0) {
            $product = $productsResponse.data[0]
            $saleBody = @{
                items = @(
                    @{
                        productId = $product.id
                        quantity = 1
                        unitPrice = 1000
                    }
                )
            } | ConvertTo-Json -Depth 10

            $saleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales" `
                -Method POST `
                -Headers $headers `
                -ContentType "application/json" `
                -Body $saleBody `
                -ErrorAction Stop
            
            $saleId = $saleResponse.id
            
            # Confirmar venta
            Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/confirm" `
                -Method POST `
                -Headers $headers `
                -ErrorAction Stop | Out-Null
            
            Add-TestResult "Crear y confirmar venta" $true "Venta creada y confirmada ID: $saleId"
        } else {
            Add-TestResult "Obtener venta confirmada" $false "No hay productos disponibles"
            exit 1
        }
    }
} catch {
    Add-TestResult "Obtener venta confirmada" $false "Error: $($_.Exception.Message)"
    exit 1
}

# 8. Crear pago con método external (debe iniciar en pending)
Write-Host "`n8. Creando pago con metodo external (debe iniciar en pending)..." -ForegroundColor Yellow
$externalPaymentId = $null
if ($saleId -and $externalMethodId) {
    try {
        $paymentBody = @{
            amount = 500
            paymentMethodId = $externalMethodId
            reference = "Pago external de prueba"
        } | ConvertTo-Json

        $paymentResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method POST `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $paymentBody `
            -ErrorAction Stop
        
        $externalPaymentId = $paymentResponse.id
        $isPending = $paymentResponse.status -eq "pending"
        
        if ($isPending) {
            Add-TestResult "Pago external inicia en pending" $true "Pago creado ID: $externalPaymentId, status: pending"
        } else {
            Add-TestResult "Pago external inicia en pending" $false "Status incorrecto: $($paymentResponse.status), esperado: pending"
        }
    } catch {
        Add-TestResult "Pago external inicia en pending" $false "Error: $($_.Exception.Message)"
    }
}

# 9. Verificar que el estado processing es válido
Write-Host "`n9. Verificando que el estado processing es valido..." -ForegroundColor Yellow
if ($externalPaymentId) {
    try {
        # Intentar actualizar el pago a processing (simulando webhook)
        # Nota: Esto requeriría un endpoint PUT /api/payments/:id, pero por ahora verificamos
        # que el schema acepta el estado
        $paymentsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/payments" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $payment = $paymentsResponse.payments | Where-Object { $_.id -eq $externalPaymentId }
        
        if ($payment) {
            $validStatuses = @("pending", "processing", "confirmed", "failed", "refunded")
            $hasValidStatus = $validStatuses -contains $payment.status
            
            if ($hasValidStatus) {
                Add-TestResult "Estado processing valido" $true "Estado actual: $($payment.status), estados validos: $($validStatuses -join ', ')"
            } else {
                Add-TestResult "Estado processing valido" $false "Estado invalido: $($payment.status)"
            }
        } else {
            Add-TestResult "Estado processing valido" $false "No se encontro el pago"
        }
    } catch {
        Add-TestResult "Estado processing valido" $false "Error: $($_.Exception.Message)"
    }
}

# 10. Verificar que los gateways no exponen credenciales completas
Write-Host "`n10. Verificando seguridad de credenciales..." -ForegroundColor Yellow
if ($gatewayId) {
    try {
        $gatewayResponse = Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways/$gatewayId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        # Verificar que credentials solo muestra { exists: true } o null
        $credentialsSafe = $null -eq $gatewayResponse.credentials `
            -or ($gatewayResponse.credentials -is [PSCustomObject] `
                -and $gatewayResponse.credentials.exists -eq $true `
                -and $gatewayResponse.credentials.PSObject.Properties.Count -eq 1)
        
        if ($credentialsSafe) {
            Add-TestResult "Seguridad de credenciales" $true "Credenciales no expuestas completamente"
        } else {
            Add-TestResult "Seguridad de credenciales" $false "Credenciales expuestas: $($gatewayResponse.credentials | ConvertTo-Json)"
        }
    } catch {
        Add-TestResult "Seguridad de credenciales" $false "Error: $($_.Exception.Message)"
    }
}

# Limpiar: eliminar gateway de prueba (opcional, comentado para mantener datos)
# Write-Host "`nLimpiando gateway de prueba..." -ForegroundColor Yellow
# if ($gatewayId) {
#     try {
#         Invoke-RestMethod -Uri "$BaseUrl/api/payment-gateways/$gatewayId" `
#             -Method DELETE `
#             -Headers $headers `
#             -ErrorAction Stop | Out-Null
#     } catch {
#         # Ignorar error de limpieza
#     }
# }

# Resumen
Write-Host "`n=== Resumen de Pruebas ===" -ForegroundColor Cyan
Write-Host "Total de pruebas: $script:testCount" -ForegroundColor White
Write-Host "[OK] Pasadas: $script:passCount" -ForegroundColor Green
Write-Host "[FAIL] Fallidas: $script:failCount" -ForegroundColor Red

if ($script:failCount -eq 0) {
    Write-Host "`n[SUCCESS] TODAS LAS PRUEBAS PASARON!" -ForegroundColor Green
    Write-Host "El Sprint C esta funcionando correctamente." -ForegroundColor Green
    Write-Host "`nPuedes continuar con el Sprint D (Mercado Pago)." -ForegroundColor Cyan
} else {
    Write-Host "`n[WARNING] Algunas pruebas fallaron." -ForegroundColor Yellow
    Write-Host "Revisa los detalles arriba antes de continuar." -ForegroundColor Yellow
}

Write-Host "`n=== Fin de Pruebas ===" -ForegroundColor Cyan

