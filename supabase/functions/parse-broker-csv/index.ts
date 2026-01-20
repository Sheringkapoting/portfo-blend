import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
import { validateAuth, unauthorizedResponse, corsHeaders } from '../_shared/auth.ts'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_ROWS = 5000

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
  broker: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authResult = await validateAuth(req)
    if (!authResult.isValid) {
      return unauthorizedResponse(authResult.error || 'Authentication failed')
    }
    
    if (!authResult.userId) {
      return unauthorizedResponse('User ID not found')
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const broker = formData.get('broker') as string

    if (!file) {
      throw new Error('No file uploaded')
    }

    if (!broker) {
      throw new Error('Broker name is required')
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File too large')
    }

    console.log(`[parse-broker-csv] Processing ${broker} file: ${file.name}`)

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: true,
    })

    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

    if (jsonData.length === 0) {
      throw new Error('File contains no data')
    }

    if (jsonData.length > MAX_ROWS) {
      throw new Error(`Too many rows. Maximum ${MAX_ROWS} allowed`)
    }

    // Find header row and map columns
    const { headerRow, columnMap } = findHeaderAndColumns(jsonData, broker)
    
    if (headerRow === -1) {
      throw new Error('Could not find header row. Expected columns: Symbol, Name/Stock, Quantity/Qty, Avg Price/Buy Avg, LTP/Current Price')
    }

    console.log(`[parse-broker-csv] Header found at row ${headerRow + 1}, columns:`, columnMap)

    // Parse holdings
    const holdings: ParsedHolding[] = []
    const skipped: { row: number; reason: string }[] = []

    for (let i = headerRow + 1; i < jsonData.length; i++) {
      const row = jsonData[i]
      if (!row || row.length === 0) continue

      try {
        const symbol = cleanString(row[columnMap.symbol])
        const name = cleanString(row[columnMap.name]) || symbol
        const quantity = parseNumber(row[columnMap.quantity])
        const avgPrice = parseNumber(row[columnMap.avgPrice])
        const ltp = parseNumber(row[columnMap.ltp]) || avgPrice

        if (!symbol || quantity <= 0) {
          if (symbol) {
            skipped.push({ row: i + 1, reason: 'Invalid quantity' })
          }
          continue
        }

        // Determine type based on symbol patterns
        let type = 'Equity'
        const upperSymbol = symbol.toUpperCase()
        if (upperSymbol.includes('ETF') || upperSymbol.includes('BEES')) {
          type = 'ETF'
        } else if (upperSymbol.includes('SGB')) {
          type = 'SGB'
        }

        holdings.push({
          symbol: symbol.toUpperCase(),
          name,
          type,
          sector: 'General',
          quantity,
          avg_price: Math.round(avgPrice * 100) / 100,
          ltp: Math.round(ltp * 100) / 100,
          exchange: 'NSE',
          source: broker,
          user_id: authResult.userId,
          broker,
        })
      } catch (e) {
        skipped.push({ row: i + 1, reason: 'Parse error' })
      }
    }

    console.log(`[parse-broker-csv] Parsed ${holdings.length} holdings, skipped ${skipped.length}`)

    // Insert into database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Delete existing holdings for this broker and user
    await supabase
      .from('holdings')
      .delete()
      .eq('broker', broker)
      .eq('user_id', authResult.userId)

    // Insert new holdings
    if (holdings.length > 0) {
      const { error: insertError } = await supabase.from('holdings').insert(holdings as any)
      if (insertError) {
        throw new Error(`Failed to insert holdings: ${insertError.message}`)
      }
    }

    // Log sync
    await supabase.from('sync_logs').insert({
      source: broker,
      status: 'success',
      holdings_count: holdings.length,
      user_id: authResult.userId,
    } as any)

    return new Response(
      JSON.stringify({
        success: true,
        holdings_count: holdings.length,
        skipped_count: skipped.length,
        message: `Imported ${holdings.length} holdings from ${broker}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[parse-broker-csv] Error:', errorMessage)
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function findHeaderAndColumns(data: any[][], broker: string): { headerRow: number; columnMap: any } {
  const defaultMap = {
    symbol: -1,
    name: -1,
    quantity: -1,
    avgPrice: -1,
    ltp: -1,
  }

  // Common column name patterns
  const patterns = {
    symbol: ['symbol', 'scrip', 'stock', 'instrument', 'ticker', 'security'],
    name: ['name', 'company', 'stock name', 'instrument name', 'scrip name'],
    quantity: ['qty', 'quantity', 'units', 'shares', 'holdings qty', 'holding quantity'],
    avgPrice: ['avg', 'average', 'buy avg', 'buy price', 'purchase price', 'avg price', 'cost'],
    ltp: ['ltp', 'current', 'current price', 'market price', 'close', 'last price'],
  }

  for (let i = 0; i < Math.min(data.length, 15); i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    const rowStr = row.map(c => String(c).toLowerCase()).join(' ')
    
    // Check if this looks like a header
    const hasSymbol = patterns.symbol.some(p => rowStr.includes(p))
    const hasQty = patterns.quantity.some(p => rowStr.includes(p))
    
    if (hasSymbol && hasQty) {
      const columnMap = { ...defaultMap }
      
      row.forEach((cell, idx) => {
        const cellStr = String(cell).toLowerCase().trim()
        
        for (const [key, patternList] of Object.entries(patterns)) {
          if (columnMap[key as keyof typeof columnMap] === -1) {
            for (const pattern of patternList) {
              if (cellStr.includes(pattern)) {
                columnMap[key as keyof typeof columnMap] = idx
                break
              }
            }
          }
        }
      })

      // If name column not found, use symbol column
      if (columnMap.name === -1) {
        columnMap.name = columnMap.symbol
      }

      return { headerRow: i, columnMap }
    }
  }

  return { headerRow: -1, columnMap: defaultMap }
}

function cleanString(value: any): string {
  if (!value) return ''
  return String(value).trim().slice(0, 200)
}

function parseNumber(value: any): number {
  if (typeof value === 'number') return isFinite(value) ? value : 0
  if (!value) return 0
  
  const str = String(value)
    .replace(/[₹,\s]/g, '')
    .replace(/^\((.+)\)$/, '-$1')
    .trim()
  
  const num = parseFloat(str)
  return isNaN(num) || !isFinite(num) ? 0 : num
}
