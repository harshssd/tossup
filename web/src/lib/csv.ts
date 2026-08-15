export interface PlayerCSVRow {
  name: string
  playingRole: string
  battingStyle?: string
  bowlingStyle?: string
  customTags?: string
  tier: string
  image?: string
}

export interface CSVParseResult {
  success: boolean
  data?: PlayerCSVRow[]
  errors: string[]
  warnings: string[]
}

/**
 * Normalizes free-form playing role descriptions to the database enum values.
 * Extracts parenthetical notes (e.g., "Injured", "Limited Availability") as tags.
 */
export function normalizePlayingRole(raw: string): { role: string; notes: string[] } {
  const notes: string[] = []

  // Extract parenthetical notes
  const cleaned = raw.replace(/\(([^)]+)\)/g, (_, note) => {
    notes.push(note.trim())
    return ''
  }).trim()

  const lower = cleaned.toLowerCase().replace(/[-_\s]+/g, ' ').trim()

  // Check for wicketkeeper patterns first (most specific)
  if (
    lower.includes('keeper') ||
    lower.includes('wicketkeeper') ||
    lower.includes('wk') ||
    lower === 'wicket keeper'
  ) {
    return { role: 'WICKETKEEPER', notes }
  }

  // Check for all-rounder patterns
  if (
    lower.includes('allrounder') ||
    lower.includes('all rounder') ||
    lower.includes('all-rounder') ||
    lower.includes('batting allrounder') ||
    lower.includes('bowling allrounder')
  ) {
    return { role: 'ALL_ROUNDER', notes }
  }

  // Check for bowler patterns
  if (
    lower === 'bowler' ||
    lower.startsWith('bowler') ||
    lower.includes('fast bowler') ||
    lower.includes('spin bowler') ||
    lower.includes('medium pacer') ||
    lower.includes('pace bowler')
  ) {
    return { role: 'BOWLER', notes }
  }

  // Check for batsman patterns
  if (
    lower === 'batsman' ||
    lower.startsWith('batsman') ||
    lower === 'batter' ||
    lower.startsWith('batter') ||
    lower === 'opener' ||
    lower.includes('top order') ||
    lower.includes('middle order')
  ) {
    return { role: 'BATSMAN', notes }
  }

  // Already a valid enum value
  const upper = cleaned.toUpperCase().replace(/[\s-]+/g, '_')
  if (['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKETKEEPER'].includes(upper)) {
    return { role: upper, notes }
  }

  // Default: return as-is (will fail validation with a clear error)
  return { role: cleaned || 'ALL_ROUNDER', notes }
}

export function parseCSV(csvContent: string): CSVParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const data: PlayerCSVRow[] = []

  try {
    // Split into lines and remove empty lines
    const lines = csvContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    if (lines.length === 0) {
      return {
        success: false,
        errors: ['CSV file is empty'],
        warnings: []
      }
    }

    // Parse header
    const headerLine = lines[0]
    const headers = parseCSVLine(headerLine)

    // Validate required headers
    const requiredHeaders = ['name', 'playingRole', 'tier']
    const optionalHeaders = ['battingStyle', 'bowlingStyle', 'customTags', 'image']
    const validHeaders = [...requiredHeaders, ...optionalHeaders]

    // Check for required headers
    const missingHeaders = requiredHeaders.filter(header =>
      !headers.some(h => h.toLowerCase() === header.toLowerCase())
    )

    if (missingHeaders.length > 0) {
      errors.push(`Missing required columns: ${missingHeaders.join(', ')}`)
    }

    // Check for invalid headers
    const invalidHeaders = headers.filter(header =>
      !validHeaders.some(h => h.toLowerCase() === header.toLowerCase()) &&
      header.toLowerCase() !== 'notes' // Allow notes column but ignore it
    )

    if (invalidHeaders.length > 0) {
      warnings.push(`Unknown columns will be ignored: ${invalidHeaders.join(', ')}`)
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings }
    }

    // Create header mapping (case insensitive)
    const headerMap: Record<string, number> = {}
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase()
      for (const validHeader of validHeaders) {
        if (normalizedHeader === validHeader.toLowerCase()) {
          headerMap[validHeader] = index
          break
        }
      }
    })

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const values = parseCSVLine(line)

      if (values.length === 0) continue // Skip empty lines

      if (values.length < headers.length) {
        warnings.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`)
      }

      // Extract required fields
      const name = getCSVValue(values, headerMap.name)?.trim()
      const playingRole = getCSVValue(values, headerMap.playingRole)?.trim()
      const tier = getCSVValue(values, headerMap.tier)?.trim()

      // Validate required fields
      if (!name) {
        errors.push(`Row ${i + 1}: Player name is required`)
        continue
      }

      if (!playingRole) {
        errors.push(`Row ${i + 1}: Playing role is required`)
        continue
      }

      if (!tier) {
        errors.push(`Row ${i + 1}: Tier is required`)
        continue
      }

      // Extract optional fields
      const battingStyle = getCSVValue(values, headerMap.battingStyle)?.trim()
      const bowlingStyle = getCSVValue(values, headerMap.bowlingStyle)?.trim()
      const customTags = getCSVValue(values, headerMap.customTags)?.trim()
      const image = getCSVValue(values, headerMap.image)?.trim()

      // Validate image URL if provided
      if (image && !isValidUrl(image)) {
        warnings.push(`Row ${i + 1}: Invalid image URL format`)
      }

      const playerData: PlayerCSVRow = {
        name,
        playingRole,
        tier,
        ...(battingStyle && { battingStyle }),
        ...(bowlingStyle && { bowlingStyle }),
        ...(customTags && { customTags }),
        ...(image && isValidUrl(image) && { image }),
      }

      data.push(playerData)
    }

    return {
      success: errors.length === 0,
      data: errors.length === 0 ? data : undefined,
      errors,
      warnings
    }

  } catch (error) {
    return {
      success: false,
      errors: [`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: []
    }
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote
        currentField += '"'
        i += 2
      } else {
        // Toggle quotes
        inQuotes = !inQuotes
        i++
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(currentField)
      currentField = ''
      i++
    } else {
      // Regular character
      currentField += char
      i++
    }
  }

  // Add the last field
  result.push(currentField)

  return result
}

function getCSVValue(values: string[], index: number | undefined): string | undefined {
  if (index === undefined || index >= values.length) return undefined
  return values[index] || undefined
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}

export function generateCSVTemplate(): string {
  const headers = [
    'name',
    'playingRole',
    'tier',
    'battingStyle',
    'bowlingStyle',
    'customTags',
    'image'
  ]

  const sampleRows = [
    ['Virat Kohli', 'Batsman', 'Tier 0', 'Right-hand bat', '', 'Star Player', ''],
    ['Jasprit Bumrah', 'Bowler', 'Tier 0', '', 'Right-arm fast', 'Pace, Yorker specialist', ''],
    ['Ravindra Jadeja', 'Bowling Allrounder', 'Tier 1', 'Left-hand bat', 'Left-arm spin', '', ''],
    ['KL Rahul', 'Batsman/Keeper', 'Tier 2', 'Right-hand bat', '', 'Opener', ''],
  ]

  return [
    headers.join(','),
    ...sampleRows.map(row => row.map(value => `"${value}"`).join(','))
  ].join('\n')
}