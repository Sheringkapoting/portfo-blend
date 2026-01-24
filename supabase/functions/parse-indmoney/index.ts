import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
import { validateAuth, unauthorizedResponse, corsHeaders } from '../_shared/auth.ts'

// Constants for file validation
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_ROWS = 10000
const MAX_STRING_LENGTH = 500
const MAX_PROCESSING_TIME = 30000 // 30 seconds
const VALID_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  '', // Some browsers don't set MIME type for Excel files
]

interface ParsedHolding {
  symbol: string
  name: string
  type: string
  sector: string
  quantity: number
  avg_price: number
  ltp: number
  exchange: string
  source: string
  isin?: string
  user_id?: string
  xirr?: number
  broker: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

interface ParseResult {
  holdings: ParsedHolding[]
  skipped: { row: number; reason: string; data?: any }[]
  summary: {
    total_rows: number
    valid_holdings: number
    skipped_count: number
    by_type: Record<string, number>
  }
}

// Column mapping for INDMoney Holdings Report
interface ColumnMap {
  firstName: number
  assetType: number
  assetClass: number
  category: number
  investmentCode: number
  investment: number
  amcName: number
  mfType: number
  expenseRatio: number
  brokerCode: number
  broker: number
  investmentDate: number
  totalUnits: number
  investedAmount: number
  marketValue: number
  holdingPercent: number
  totalGainLoss: number
  totalGainLossPercent: number
  xirr: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  let supabase: ReturnType<typeof createClient> | null = null

  try {
    // Validate JWT authentication
    const authResult = await validateAuth(req)
    if (!authResult.isValid) {
      return unauthorizedResponse(authResult.error || 'Authentication failed')
    }
    
    console.log('Auth result:', { isValid: authResult.isValid, userId: authResult.userId, isCronCall: authResult.isCronCall })
    
    // Ensure we have a user ID for user-initiated uploads
    if (!authResult.userId && !authResult.isCronCall) {
      return unauthorizedResponse('User ID not found in token')
    }
    
    // Initialize Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    supabase = createClient(supabaseUrl, supabaseKey)

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      throw new Error('No file uploaded')
    }

    // Step 1: Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB allowed, got ${(file.size / 1024 / 1024).toFixed(2)}MB`)
    }
    if (file.size === 0) {
      throw new Error('File is empty')
    }

    // Validate file type by extension
    const fileName = file.name.toLowerCase()
    const validExtensions = ['.xlsx', '.xls', '.csv']
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))
    
    if (!hasValidExtension) {
      throw new Error(`Invalid file type. Supported formats: ${validExtensions.join(', ')}`)
    }

    // Step 2: Verify MIME type if provided
    if (file.type && !VALID_MIME_TYPES.includes(file.type)) {
      throw new Error(`Invalid MIME type: ${file.type}. Expected Excel or CSV file.`)
    }

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`)

    // Read and parse the file with row limit
    const arrayBuffer = await file.arrayBuffer()
    let workbook: XLSX.WorkBook

    try {
      workbook = XLSX.read(arrayBuffer, { 
        type: 'array',
        cellDates: true,
        cellNF: true,
        cellStyles: false,
        sheetRows: MAX_ROWS + 10 // Limit rows read to prevent memory issues (+ header rows)
      })
    } catch (parseError) {
      throw new Error(`Failed to parse file: ${parseError instanceof Error ? parseError.message : 'Invalid format'}`)
    }

    // Find the holdings sheet
    const sheetName = findHoldingsSheet(workbook.SheetNames)
    if (!sheetName) {
      throw new Error('No holdings sheet found in the file. Expected sheet with "holding" in name.')
    }

    console.log(`Using sheet: ${sheetName}`)

    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

    // Step 4: Validate row count
    if (jsonData.length > MAX_ROWS) {
      throw new Error(`Too many rows. Maximum ${MAX_ROWS} allowed, found ${jsonData.length}`)
    }
    if (jsonData.length === 0) {
      throw new Error('File contains no data rows')
    }

    // Find header row and parse column mapping
    const { headerRow, columnMap } = findHeaderRowAndColumns(jsonData)
    const hasXirrColumn = columnMap.xirr >= 0

    if (headerRow === -1) {
      throw new Error('Could not find header row in the file. Expected columns like Asset Type, Investment, Total Units, etc.')
    }

    // Validate Broker column existence
    if (columnMap.broker === -1) {
      throw new Error('Required "Broker" column not found in the file. Please ensure the Excel template includes a "Broker" column.')
    }

    console.log(`Header found at row ${headerRow + 1}`)

    if (!hasXirrColumn) {
      console.warn('XIRR (%) column not found. XIRR values will not be imported from this file.')
    }

    // Parse holdings with validation and timeout protection
    const parseResult = parseHoldings(jsonData, headerRow, columnMap, startTime, authResult.userId)

    console.log(`Parsing complete: ${parseResult.summary.valid_holdings} valid, ${parseResult.summary.skipped_count} skipped`)

    // Log skipped entries for debugging
    if (parseResult.skipped.length > 0) {
      console.log('Skipped entries:')
      parseResult.skipped.slice(0, 10).forEach(skip => {
        console.log(`  Row ${skip.row}: ${skip.reason}`)
      })
      if (parseResult.skipped.length > 10) {
        console.log(`  ... and ${parseResult.skipped.length - 10} more`)
      }
    }

    // Verify data integrity before proceeding
    const verification = verifyDataIntegrity(parseResult.holdings)
    if (!hasXirrColumn) {
      verification.warnings.push('XIRR (%) column is missing. XIRR values were not imported from this file.')
    } else {
      const holdingsWithXirr = parseResult.holdings.filter(h => typeof h.xirr === 'number').length
      if (holdingsWithXirr === 0 && parseResult.holdings.length > 0) {
        verification.warnings.push('No valid XIRR values found in XIRR (%) column. Invalid or blank entries were ignored.')
      }
    }
    if (!verification.isValid) {
      console.warn('Data integrity warnings:', verification.warnings)
    }

    // Delete existing INDMoney holdings for this user and insert new ones
    let deleteQuery = supabase
      .from('holdings')
      .delete()
      .eq('source', 'INDMoney')
    
    // If user is authenticated, only delete their holdings
    if (authResult.userId) {
      deleteQuery = deleteQuery.eq('user_id', authResult.userId)
    }
    
    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error('Delete error:', deleteError)
      throw new Error(`Failed to clear existing holdings: ${deleteError.message}`)
    }
    
    console.log(`Deleted existing INDMoney holdings for user: ${authResult.userId || 'all'}`)

    let insertedCount = 0
    if (parseResult.holdings.length > 0) {
      // Insert in batches of 100 for large datasets
      const batchSize = 100
      for (let i = 0; i < parseResult.holdings.length; i += batchSize) {
        // Check timeout during batch processing
        if (Date.now() - startTime > MAX_PROCESSING_TIME) {
          throw new Error('Processing timeout - file too complex')
        }
        
        const batch = parseResult.holdings.slice(i, i + batchSize)
        const { error: insertError } = await supabase.from('holdings').insert(batch as any)
        
        if (insertError) {
          console.error(`Insert error at batch ${i / batchSize}:`, insertError)
          throw new Error(`Failed to insert holdings: ${insertError.message}`)
        }
        insertedCount += batch.length
      }
    }

    const processingTime = Date.now() - startTime

    // Log the sync with detailed info
    const syncLogInsert = {
      source: 'INDMoney',
      status: 'success',
      holdings_count: insertedCount,
      user_id: authResult.userId || null,
      error_message: parseResult.skipped.length > 0 
        ? `${parseResult.skipped.length} entries skipped`
        : null,
    }
    
    console.log('Inserting sync log:', syncLogInsert)
    await supabase.from('sync_logs').insert(syncLogInsert as any)

    const response = {
      success: true,
      holdings_count: insertedCount,
      message: `Imported ${insertedCount} holdings from INDMoney Excel`,
      summary: parseResult.summary,
      skipped_count: parseResult.skipped.length,
      processing_time_ms: processingTime,
      data_integrity: verification,
      user_id: authResult.userId,
    }

    console.log('Sync completed successfully:', JSON.stringify(response, null, 2))

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('INDMoney parse error:', errorMessage)

    // Log the error to sync_logs
    if (supabase) {
      try {
        await supabase.from('sync_logs').insert({
          source: 'INDMoney',
          status: 'error',
          error_message: errorMessage,
        } as any)
      } catch (logError) {
        console.error('Failed to log error:', logError)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        processing_time_ms: Date.now() - startTime 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Find the holdings sheet in the workbook
 */
function findHoldingsSheet(sheetNames: string[]): string | null {
  // Try exact patterns first
  const patterns = [
    /holding/i,
    /portfolio/i,
    /investment/i,
  ]

  for (const pattern of patterns) {
    const match = sheetNames.find(name => pattern.test(name))
    if (match) return match
  }

  // Default to first sheet if no match
  return sheetNames.length > 0 ? sheetNames[0] : null
}

/**
 * Find the header row and create column mapping
 * Enhanced to handle various Excel formats and column name variations
 */
function findHeaderRowAndColumns(data: any[][]): { headerRow: number; columnMap: ColumnMap } {
  const defaultMap: ColumnMap = {
    firstName: -1, assetType: -1, assetClass: -1, category: -1,
    investmentCode: -1, investment: -1, amcName: -1, mfType: -1,
    expenseRatio: -1, brokerCode: -1, broker: -1, investmentDate: -1,
    totalUnits: -1, investedAmount: -1, marketValue: -1, holdingPercent: -1,
    totalGainLoss: -1, totalGainLossPercent: -1, xirr: -1
  }

  // Look for header row - check first 20 rows
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    const rowStr = row.map(c => String(c).toLowerCase()).join(' ')
    
    // More flexible header detection - look for key indicators
    const hasAssetType = rowStr.includes('asset') && rowStr.includes('type')
    const hasInvestment = rowStr.includes('investment') || rowStr.includes('stock') || rowStr.includes('fund')
    const hasUnits = rowStr.includes('units') || rowStr.includes('quantity')
    const hasAmount = rowStr.includes('amount') || rowStr.includes('value')
    
    // This looks like a header row if it has at least 2 key indicators
    const indicatorCount = [hasAssetType, hasInvestment, hasUnits, hasAmount].filter(Boolean).length
    
    if (indicatorCount >= 2) {
      const columnMap = { ...defaultMap }
      
      row.forEach((cell, idx) => {
        const cellStr = String(cell).toLowerCase().trim()
        
        // More flexible matching with variations
        if (cellStr.includes('first') && cellStr.includes('name')) columnMap.firstName = idx
        else if (cellStr.includes('asset') && cellStr.includes('type')) columnMap.assetType = idx
        else if (cellStr.includes('asset') && cellStr.includes('class')) columnMap.assetClass = idx
        else if (cellStr === 'category' || cellStr.includes('categor')) columnMap.category = idx
        else if (cellStr.includes('investment') && cellStr.includes('code')) columnMap.investmentCode = idx
        else if (cellStr === 'isin' || cellStr.includes('isin')) columnMap.investmentCode = idx
        else if (cellStr === 'investment' || cellStr === 'stock name' || cellStr === 'fund name' || cellStr === 'name') {
          if (columnMap.investment === -1) columnMap.investment = idx
        }
        else if (cellStr.includes('amc')) columnMap.amcName = idx
        else if (cellStr.includes('direct') || cellStr.includes('regular')) columnMap.mfType = idx
        else if (cellStr.includes('expense') && cellStr.includes('ratio')) columnMap.expenseRatio = idx
        else if (cellStr.includes('broker') && cellStr.includes('code')) columnMap.brokerCode = idx
        else if (cellStr === 'broker' || cellStr.includes('broker')) columnMap.broker = idx
        else if (cellStr.includes('investment') && cellStr.includes('date')) columnMap.investmentDate = idx
        else if (cellStr.includes('date') && !cellStr.includes('investment')) columnMap.investmentDate = idx
        else if (cellStr.includes('total') && cellStr.includes('units')) columnMap.totalUnits = idx
        else if (cellStr === 'units' || cellStr === 'quantity' || cellStr === 'qty') columnMap.totalUnits = idx
        else if (cellStr.includes('invested') && cellStr.includes('amount')) columnMap.investedAmount = idx
        else if (cellStr.includes('cost') || cellStr.includes('purchase')) columnMap.investedAmount = idx
        else if (cellStr.includes('market') && cellStr.includes('value')) columnMap.marketValue = idx
        else if (cellStr.includes('current') && cellStr.includes('value')) columnMap.marketValue = idx
        else if (cellStr.includes('holding') && cellStr.includes('%')) columnMap.holdingPercent = idx
        else if (cellStr.includes('gain') && (cellStr.includes('inr') || cellStr.includes('₹'))) columnMap.totalGainLoss = idx
        else if (cellStr.includes('p&l') || cellStr.includes('pnl')) columnMap.totalGainLoss = idx
        else if (cellStr.includes('gain') && cellStr.includes('%')) columnMap.totalGainLossPercent = idx
        else if (cellStr.includes('return') && cellStr.includes('%')) columnMap.totalGainLossPercent = idx
        else if (cellStr.includes('xirr')) columnMap.xirr = idx
      })

      console.log(`Found header row at ${i + 1} with columns:`, {
        assetType: columnMap.assetType >= 0,
        investment: columnMap.investment >= 0,
        totalUnits: columnMap.totalUnits >= 0,
        investedAmount: columnMap.investedAmount >= 0,
        marketValue: columnMap.marketValue >= 0,
        broker: columnMap.broker >= 0
      })

      return { headerRow: i, columnMap }
    }
  }

  console.error('Could not find header row. First 5 rows:', data.slice(0, 5))
  return { headerRow: -1, columnMap: defaultMap }
}

/**
 * Parse number from various formats (handles commas, INR symbols, etc.)
 * Enhanced with Infinity/NaN protection
 */
function parseNumber(value: any): number {
  if (typeof value === 'number') {
    if (!isFinite(value)) return 0 // Reject Infinity/NaN
    return value
  }
  if (!value || value === '-' || value === 'N/A') return 0
  
  const str = String(value)
    .replace(/[₹,\s]/g, '')
    .replace(/^\((.+)\)$/, '-$1') // Handle (negative) format
    .trim()
  
  const num = parseFloat(str)
  return (isNaN(num) || !isFinite(num)) ? 0 : num
}

function parseOptionalPercent(value: any): number | null {
  if (value === null || value === undefined) return null
  const raw = String(value).trim()
  if (!raw || raw === '-' || raw.toUpperCase() === 'N/A') return null

  const cleaned = raw
    .replace(/[₹,\s]/g, '')
    .replace(/^\((.+)\)$/, '-$1')
    .replace(/%/g, '')
    .replace(/per\s*annum/gi, '')
    .replace(/p\.?a\.?/gi, '')

  const num = parseFloat(cleaned)
  return (isNaN(num) || !isFinite(num)) ? null : num
}

/**
 * Parse holdings from the data with timeout protection and string length limits
 */
function parseHoldings(
  data: any[][], 
  headerRow: number, 
  columnMap: ColumnMap,
  startTime: number,
  userId?: string
): ParseResult {
  const holdings: ParsedHolding[] = []
  const skipped: { row: number; reason: string; data?: any }[] = []
  const byType: Record<string, number> = {}

  for (let i = headerRow + 1; i < data.length; i++) {
    // Check for processing timeout
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      throw new Error('Processing timeout - file too complex')
    }
    
    const row = data[i]
    if (!row || row.length === 0) continue

    try {
      const assetType = String(row[columnMap.assetType] || '').trim().toUpperCase().slice(0, MAX_STRING_LENGTH)
      const investment = String(row[columnMap.investment] || '').trim().slice(0, MAX_STRING_LENGTH)
      const assetClass = String(row[columnMap.assetClass] || '').trim().slice(0, MAX_STRING_LENGTH)
      const category = String(row[columnMap.category] || '').trim().slice(0, MAX_STRING_LENGTH)
      const investmentCode = String(row[columnMap.investmentCode] || '').trim().slice(0, 100)
      const totalUnits = parseNumber(row[columnMap.totalUnits])
      const investedAmount = parseNumber(row[columnMap.investedAmount])
      const marketValue = parseNumber(row[columnMap.marketValue])
      const xirrValue = columnMap.xirr >= 0 ? parseOptionalPercent(row[columnMap.xirr]) : null
      const broker = String(row[columnMap.broker] || '').trim().slice(0, 100)

      // Skip empty rows or rows without investment name
      if (!investment || !assetType) {
        continue
      }

      // For retirement assets (EPF, PPF, NPS), broker can be empty - use asset type as broker
      const isRetirementAsset = ['EPF', 'PPF', 'NPS'].includes(assetType)
      const effectiveBroker = broker && broker.toLowerCase() !== 'n/a' && broker !== '-' 
        ? broker 
        : (isRetirementAsset ? assetType : '')

      // Validate Broker for non-retirement assets
      if (!effectiveBroker && !isRetirementAsset) {
        skipped.push({
          row: i + 1,
          reason: 'Missing or invalid broker information',
          data: { investment, assetType }
        })
        continue
      }

      // Skip if no meaningful data
      if (totalUnits <= 0 && investedAmount <= 0 && marketValue <= 0) {
        skipped.push({
          row: i + 1,
          reason: 'No units, invested amount, or market value',
          data: { investment, assetType }
        })
        continue
      }

      // Map asset type to our schema
      const holdingType = mapAssetType(assetType, assetClass, investment)
      const sector = mapSector(assetClass, category, investment)
      const exchange = mapExchange(assetType, holdingType)

      // Calculate avg price (invested / units) or use market value as fallback
      let avgPrice = 0
      let ltp = 0

      if (totalUnits > 0) {
        avgPrice = investedAmount / totalUnits
        ltp = marketValue / totalUnits
      } else if (assetType === 'EPF' || assetType === 'PPF' || assetType === 'NPS') {
        // For retirement accounts, use 1 unit with total value
        avgPrice = investedAmount
        ltp = marketValue
      }

      // Generate a symbol with length limit
      const symbol = generateSymbol(assetType, investmentCode, investment).slice(0, 100)

      // Create ISIN if available
      const isin = investmentCode && investmentCode.startsWith('IN') ? investmentCode : undefined

      const holding: ParsedHolding = {
        symbol,
        name: investment,
        type: holdingType,
        sector,
        quantity: totalUnits > 0 ? totalUnits : 1,
        avg_price: Math.round(avgPrice * 100) / 100,
        ltp: Math.round(ltp * 100) / 100,
        exchange,
        source: 'INDMoney',
        isin,
        user_id: userId,
        xirr: xirrValue !== null && isFinite(xirrValue) ? Math.round(xirrValue * 100) / 100 : undefined,
        broker: effectiveBroker || assetType, // Use asset type as fallback for retirement assets
      }

      // Validate the holding
      const validation = validateHolding(holding)
      if (!validation.isValid) {
        skipped.push({
          row: i + 1,
          reason: validation.errors.join('; '),
          data: { investment, assetType }
        })
        continue
      }

      holdings.push(holding)
      byType[holdingType] = (byType[holdingType] || 0) + 1

    } catch (rowError) {
      skipped.push({
        row: i + 1,
        reason: `Parse error: ${rowError instanceof Error ? rowError.message : 'Unknown'}`,
      })
    }
  }

  return {
    holdings,
    skipped,
    summary: {
      total_rows: data.length - headerRow - 1,
      valid_holdings: holdings.length,
      skipped_count: skipped.length,
      by_type: byType,
    }
  }
}

/**
 * Map INDMoney asset types to our schema
 */
function mapAssetType(assetType: string, assetClass: string, name: string): string {
  const upperType = assetType.toUpperCase()
  const combined = `${assetClass} ${name}`.toLowerCase()

  switch (upperType) {
    case 'STOCK':
      if (combined.includes('gold') || combined.includes('bees')) return 'ETF'
      if (combined.includes('silver')) return 'ETF'
      if (combined.includes('etf') || combined.includes('index')) return 'ETF'
      if (combined.includes('reit')) return 'REIT'
      return 'Equity'
    
    case 'US_STOCK':
      return 'US Stock'
    
    case 'MF':
      if (combined.includes('gold') || combined.includes('silver')) return 'Commodity MF'
      if (combined.includes('debt') || combined.includes('bond') || combined.includes('liquid')) return 'Debt MF'
      return 'Mutual Fund'
    
    case 'NPS':
      return 'NPS'
    
    case 'EPF':
      return 'EPF'
    
    case 'PPF':
      return 'PPF'
    
    case 'SGB':
      return 'SGB'
    
    default:
      return 'Other'
  }
}

/**
 * Map to sector
 */
function mapSector(assetClass: string, category: string, name: string): string {
  const combined = `${assetClass} ${category} ${name}`.toLowerCase()

  if (combined.includes('gold')) return 'Commodity'
  if (combined.includes('silver')) return 'Commodity'
  if (combined.includes('retirement') || combined.includes('pension')) return 'Retirement'
  if (combined.includes('debt') || combined.includes('bond') || combined.includes('liquid')) return 'Debt'
  if (combined.includes('hybrid') || combined.includes('balanced')) return 'Hybrid'
  if (combined.includes('index') || combined.includes('nifty') || combined.includes('sensex')) return 'Index'
  if (combined.includes('tech') || combined.includes('digital') || combined.includes('it')) return 'IT'
  if (combined.includes('bank') || combined.includes('financial')) return 'Banking'
  if (combined.includes('pharma') || combined.includes('health')) return 'Pharma'
  if (combined.includes('auto')) return 'Auto'
  if (combined.includes('flexi') || combined.includes('multi')) return 'Diversified'
  if (combined.includes('large cap')) return 'Large Cap'
  if (combined.includes('mid cap')) return 'Mid Cap'
  if (combined.includes('small cap')) return 'Small Cap'
  if (combined.includes('global') || combined.includes('mega cap')) return 'Global'
  
  return 'Diversified'
}

/**
 * Map to exchange
 */
function mapExchange(assetType: string, holdingType: string): string {
  if (assetType === 'US_STOCK') return 'US'
  if (holdingType === 'Mutual Fund' || holdingType === 'Debt MF' || holdingType === 'Commodity MF') return 'MF'
  if (holdingType === 'NPS') return 'NPS'
  if (holdingType === 'EPF' || holdingType === 'PPF') return 'GOV'
  return 'NSE'
}

/**
 * Generate a unique symbol for the holding
 */
function generateSymbol(assetType: string, code: string, name: string): string {
  // Use investment code if it looks like a valid code
  if (code && /^[A-Z0-9]+$/.test(code) && code.length >= 3) {
    return code
  }

  // For specific asset types, use prefixed names
  const prefix = assetType.toUpperCase().replace('_', '-')
  const cleanName = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .join('-')
    .substring(0, 20)

  return `${prefix}-${cleanName}`
}

/**
 * Validate a single holding
 */
function validateHolding(holding: ParsedHolding): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!holding.symbol || holding.symbol.length < 2) {
    errors.push('Invalid symbol')
  }

  if (!holding.name || holding.name.length < 2) {
    errors.push('Invalid name')
  }

  // Allow short broker names for retirement assets (EPF, PPF, NPS use asset type as broker)
  const isRetirementType = ['EPF', 'PPF', 'NPS'].includes(holding.type)
  if (!holding.broker && !isRetirementType) {
    errors.push('Invalid or missing broker')
  }

  if (holding.quantity <= 0) {
    errors.push('Quantity must be positive')
  }

  if (holding.avg_price < 0) {
    errors.push('Average price cannot be negative')
  }

  if (holding.ltp < 0) {
    errors.push('LTP cannot be negative')
  }

  // Warnings for suspicious values
  if (holding.avg_price === 0 && holding.ltp === 0) {
    warnings.push('Both avg price and LTP are zero')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Verify overall data integrity
 */
function verifyDataIntegrity(holdings: ParsedHolding[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (holdings.length === 0) {
    warnings.push('No holdings were parsed')
  }

  // Check for duplicates
  const symbols = new Map<string, number>()
  holdings.forEach(h => {
    symbols.set(h.symbol, (symbols.get(h.symbol) || 0) + 1)
  })
  
  const duplicates = Array.from(symbols.entries()).filter(([_, count]) => count > 1)
  if (duplicates.length > 0) {
    warnings.push(`${duplicates.length} duplicate symbols found`)
  }

  // Calculate totals for sanity check
  const totalInvested = holdings.reduce((sum, h) => sum + h.quantity * h.avg_price, 0)
  const totalCurrent = holdings.reduce((sum, h) => sum + h.quantity * h.ltp, 0)

  if (totalInvested === 0 && holdings.length > 0) {
    warnings.push('Total invested value is zero')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}
