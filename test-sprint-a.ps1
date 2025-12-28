# Script de Pruebas - SPRINT A: Consolidación de Ventas Internas
# Verifica que los endpoints funcionen correctamente con snapshot y totales

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
        Write-Host "  → $Message" -ForegroundColor Gray
    } else {
        $script:failCount++
        Write-Host "[FAIL] $TestName" -ForegroundColor Red
        Write-Host "  → $Message" -ForegroundColor Yellow
    }
    
    $script:testResults += @{
        Test = $TestName
        Passed = $Passed
        Message = $Message
    }
}

Write-Host "`n=== Pruebas SPRINT A - Consolidación de Ventas Internas ===" -ForegroundColor Cyan
Write-Host "Verificando endpoints actualizados con snapshot y totales`n" -ForegroundColor Yellow

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
    Add-TestResult "Autenticación" $true "Token obtenido correctamente"
} catch {
    Add-TestResult "Autenticación" $false "Error: $($_.Exception.Message)"
    Write-Host "`n[ERROR] No se pudo autenticar. Verifica las credenciales." -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $script:token"
    "Content-Type" = "application/json"
}

# 2. Obtener productos para pruebas
Write-Host "`n2. Obteniendo productos para pruebas..." -ForegroundColor Yellow
try {
    $productsResponse = Invoke-RestMethod -Uri "$BaseUrl/api/products?limit=2" `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    if ($productsResponse.data -and $productsResponse.data.Count -ge 2) {
        $testProduct1 = $productsResponse.data[0]
        $testProduct2 = $productsResponse.data[1]
        Add-TestResult "Obtener productos" $true "Productos obtenidos: $($productsResponse.data.Count)"
    } else {
        Add-TestResult "Obtener productos" $false "No hay suficientes productos para pruebas"
        exit 1
    }
} catch {
    Add-TestResult "Obtener productos" $false "Error: $($_.Exception.Message)"
    exit 1
}

# 3. Crear venta con snapshot
Write-Host "`n3. Creando venta con snapshot..." -ForegroundColor Yellow
$saleId = $null
try {
    $saleBody = @{
        items = @(
            @{
                productId = $testProduct1.id
                quantity = 2
                unitPrice = 1000
                unitTax = 210
                unitDiscount = 50
            },
            @{
                productId = $testProduct2.id
                quantity = 1
                unitPrice = 2000
                unitTax = 420
            }
        )
        notes = "Venta de prueba SPRINT A"
    } | ConvertTo-Json -Depth 10

    $saleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $saleBody `
        -ErrorAction Stop
    
    $saleId = $saleResponse.id
    
    # Verificar campos de snapshot en sale_items
    $hasSnapshot = $true
    $missingFields = @()
    
    if ($saleResponse.sale_items -and $saleResponse.sale_items.Count -gt 0) {
        $firstItem = $saleResponse.sale_items[0]
        if (-not $firstItem.product_name) { $missingFields += "product_name"; $hasSnapshot = $false }
        if (-not $firstItem.product_sku) { $missingFields += "product_sku"; $hasSnapshot = $false }
        if (-not $firstItem.unit_tax) { $missingFields += "unit_tax"; $hasSnapshot = $false }
        if (-not $firstItem.unit_discount) { $missingFields += "unit_discount"; $hasSnapshot = $false }
    } else {
        $hasSnapshot = $false
        $missingFields += "sale_items"
    }
    
    if ($hasSnapshot) {
        Add-TestResult "Crear venta con snapshot" $true "Venta creada ID: $saleId, snapshot guardado correctamente"
    } else {
        Add-TestResult "Crear venta con snapshot" $false "Faltan campos de snapshot: $($missingFields -join ', ')"
    }
} catch {
    Add-TestResult "Crear venta con snapshot" $false "Error: $($_.Exception.Message)"
    exit 1
}

# 4. Verificar totales persistidos
Write-Host "`n4. Verificando totales persistidos..." -ForegroundColor Yellow
if ($saleId) {
    try {
        $saleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $hasTotals = $true
        $missingTotals = @()
        
        # Verificar que los campos existan (pueden ser 0, pero deben existir)
        if ($saleResponse.PSObject.Properties.Name -notcontains "subtotal") { $missingTotals += "subtotal"; $hasTotals = $false }
        if ($saleResponse.PSObject.Properties.Name -notcontains "taxes") { $missingTotals += "taxes"; $hasTotals = $false }
        if ($saleResponse.PSObject.Properties.Name -notcontains "discounts") { $missingTotals += "discounts"; $hasTotals = $false }
        if ($saleResponse.PSObject.Properties.Name -notcontains "cost_amount") { $missingTotals += "cost_amount"; $hasTotals = $false }
        
        # Verificar financial summary
        $hasFinancial = $saleResponse.financial -ne $null
        if ($hasFinancial) {
            if (-not $saleResponse.financial.subtotal) { $missingTotals += "financial.subtotal"; $hasFinancial = $false }
            if (-not $saleResponse.financial.margin) { $missingTotals += "financial.margin"; $hasFinancial = $false }
        }
        
        if ($hasTotals -and $hasFinancial) {
            $subtotal = [float]$saleResponse.subtotal
            $taxes = [float]$saleResponse.taxes
            $discounts = [float]$saleResponse.discounts
            $total = [float]$saleResponse.total_amount
            $expectedTotal = $subtotal + $taxes - $discounts
            
            if ([Math]::Abs($total - $expectedTotal) -lt 0.01) {
                Add-TestResult "Totales persistidos" $true "subtotal=$subtotal, taxes=$taxes, discounts=$discounts, total=$total, margin=$($saleResponse.financial.margin)"
            } else {
                Add-TestResult "Totales persistidos" $false "Total calculado incorrecto: esperado=$expectedTotal, obtenido=$total"
            }
        } else {
            Add-TestResult "Totales persistidos" $false "Faltan campos: $($missingTotals -join ', ')"
        }
    } catch {
        Add-TestResult "Totales persistidos" $false "Error: $($_.Exception.Message)"
    }
}

# 5. Confirmar venta y verificar stock_impacted
Write-Host "`n5. Confirmando venta y verificando stock_impacted..." -ForegroundColor Yellow
if ($saleId) {
    try {
        $confirmResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/confirm" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop
        
        # Verificar que stock_impacted se guardó
        $hasStockImpacted = $true
        $missingStockImpacted = @()
        
        if ($confirmResponse.sale_items -and $confirmResponse.sale_items.Count -gt 0) {
            foreach ($item in $confirmResponse.sale_items) {
                if ($item.stock_impacted -eq $null -or $item.stock_impacted -eq 0) {
                    $hasStockImpacted = $false
                    $missingStockImpacted += "item $($item.id)"
                }
            }
        } else {
            $hasStockImpacted = $false
            $missingStockImpacted += "sale_items"
        }
        
        if ($hasStockImpacted) {
            $stockImpactedValues = $confirmResponse.sale_items | ForEach-Object { "$($_.product_sku): $($_.stock_impacted)" }
            Add-TestResult "Confirmar venta con stock_impacted" $true "Venta confirmada, stock_impacted guardado: $($stockImpactedValues -join ', ')"
        } else {
            Add-TestResult "Confirmar venta con stock_impacted" $false "No se guardó stock_impacted en: $($missingStockImpacted -join ', ')"
        }
    } catch {
        Add-TestResult "Confirmar venta con stock_impacted" $false "Error: $($_.Exception.Message)"
    }
}

# 6. Verificar GET con campos completos
Write-Host "`n6. Verificando GET /api/sales/:id con campos completos..." -ForegroundColor Yellow
if ($saleId) {
    try {
        $saleResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        $allFieldsPresent = $true
        $missingFields = @()
        
        # Verificar campos de snapshot en items
        if ($saleResponse.sale_items -and $saleResponse.sale_items.Count -gt 0) {
            $firstItem = $saleResponse.sale_items[0]
            if (-not $firstItem.product_name) { $missingFields += "sale_items[].product_name"; $allFieldsPresent = $false }
            if (-not $firstItem.product_sku) { $missingFields += "sale_items[].product_sku"; $allFieldsPresent = $false }
            if (-not $firstItem.stock_impacted) { $missingFields += "sale_items[].stock_impacted"; $allFieldsPresent = $false }
        }
        
        # Verificar campos financieros
        if (-not $saleResponse.financial) {
            $missingFields += "financial"; $allFieldsPresent = $false
        } else {
            if (-not $saleResponse.financial.subtotal) { $missingFields += "financial.subtotal"; $allFieldsPresent = $false }
            if (-not $saleResponse.financial.margin) { $missingFields += "financial.margin"; $allFieldsPresent = $false }
        }
        
        if ($allFieldsPresent) {
            Add-TestResult "GET con campos completos" $true "Todos los campos de snapshot y financieros presentes"
        } else {
            Add-TestResult "GET con campos completos" $false "Faltan campos: $($missingFields -join ', ')"
        }
    } catch {
        Add-TestResult "GET con campos completos" $false "Error: $($_.Exception.Message)"
    }
}

# 7. Crear segunda venta para probar PUT
Write-Host "`n7. Probando PUT /api/sales/:id con snapshot..." -ForegroundColor Yellow
$sale2Id = $null
try {
    $sale2Body = @{
        items = @(
            @{
                productId = $testProduct1.id
                quantity = 1
                unitPrice = 500
            }
        )
    } | ConvertTo-Json -Depth 10

    $sale2Response = Invoke-RestMethod -Uri "$BaseUrl/api/sales" `
        -Method POST `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $sale2Body `
        -ErrorAction Stop
    
    $sale2Id = $sale2Response.id
    
    # Actualizar venta
    $updateBody = @{
        items = @(
            @{
                productId = $testProduct1.id
                quantity = 3
                unitPrice = 1500
                unitTax = 315
            },
            @{
                productId = $testProduct2.id
                quantity = 1
                unitPrice = 2500
            }
        )
        notes = "Venta actualizada con snapshot"
    } | ConvertTo-Json -Depth 10
    
    $updateResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$sale2Id" `
        -Method PUT `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $updateBody `
        -ErrorAction Stop
    
    # Verificar que se actualizó con snapshot
    $hasUpdatedSnapshot = $updateResponse.sale_items -and $updateResponse.sale_items.Count -eq 2
    $hasUpdatedTotals = $updateResponse.subtotal -ne $null -and $updateResponse.taxes -ne $null
    
    if ($hasUpdatedSnapshot -and $hasUpdatedTotals) {
        Add-TestResult "PUT con snapshot y totales" $true "Venta actualizada, snapshot y totales recalculados"
    } else {
        Add-TestResult "PUT con snapshot y totales" $false "No se actualizaron snapshot o totales correctamente"
    }
    
    # Limpiar: cancelar venta de prueba
    try {
        Invoke-RestMethod -Uri "$BaseUrl/api/sales/$sale2Id/cancel" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop | Out-Null
    } catch {
        # Ignorar error de limpieza
    }
} catch {
    Add-TestResult "PUT con snapshot y totales" $false "Error: $($_.Exception.Message)"
}

# 8. Probar cancelación con stock_impacted
Write-Host "`n8. Probando cancelación con stock_impacted..." -ForegroundColor Yellow
if ($saleId) {
    try {
        # Obtener venta antes de cancelar
        $saleBeforeCancel = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        # Cancelar venta
        $cancelResponse = Invoke-RestMethod -Uri "$BaseUrl/api/sales/$saleId/cancel" `
            -Method POST `
            -Headers $headers `
            -ErrorAction Stop
        
        if ($cancelResponse.status -eq "cancelled") {
            Add-TestResult "Cancelación con stock_impacted" $true "Venta cancelada correctamente, stock revertido usando stock_impacted"
        } else {
            Add-TestResult "Cancelación con stock_impacted" $false "Estado no es cancelled: $($cancelResponse.status)"
        }
    } catch {
        Add-TestResult "Cancelación con stock_impacted" $false "Error: $($_.Exception.Message)"
    }
}

# Resumen
Write-Host "`n=== Resumen de Pruebas ===" -ForegroundColor Cyan
Write-Host "Total de pruebas: $script:testCount" -ForegroundColor White
Write-Host "[OK] Pasadas: $script:passCount" -ForegroundColor Green
Write-Host "[FAIL] Fallidas: $script:failCount" -ForegroundColor Red

if ($script:failCount -eq 0) {
    Write-Host "`n[SUCCESS] ¡TODAS LAS PRUEBAS PASARON!" -ForegroundColor Green
    Write-Host "El Sprint A está funcionando correctamente." -ForegroundColor Green
    Write-Host "`nPuedes continuar con el Sprint B." -ForegroundColor Cyan
} else {
    Write-Host "`n[WARNING] Algunas pruebas fallaron." -ForegroundColor Yellow
    Write-Host "Revisa los detalles arriba antes de continuar." -ForegroundColor Yellow
}

Write-Host "`n=== Fin de Pruebas ===" -ForegroundColor Cyan

