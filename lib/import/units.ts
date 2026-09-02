// Kiểm tra dữ liệu import căn hộ. Thuần tuý, không đụng DB, không đụng React —
// để test được bằng node:test và để chỗ báo lỗi là một nguồn duy nhất.
//
// Vì sao làm kỹ chỗ này: file Excel của BQL luôn bẩn (thừa dòng trống, tầng ghi
// chữ, diện tích có dấu phẩy, mã tòa sai). Báo "import thất bại" chung chung thì
// BQL phải tự dò 400 dòng. Mỗi lỗi phải chỉ đúng dòng, đúng cột, đúng lý do.

// Import tương đối (không dùng alias @/) để node --experimental-strip-types
// chạy được test mà không cần thêm tsx vào devDependencies.
import { Constants } from '../db/database.types.ts'

export type UnitKind = (typeof Constants.public.Enums.unit_kind)[number]
export type UnitState = (typeof Constants.public.Enums.unit_state)[number]

export type ParsedUnit = {
  building_code: string
  code: string
  floor_no: number
  area_m2: number | null
  kind: UnitKind
  state: UnitState
}

/** row = số dòng trong file như BQL nhìn thấy (tính cả dòng tiêu đề). */
export type RowIssue = { row: number; column: string; message: string }

export type ValidationResult = {
  ok: ParsedUnit[]
  issues: RowIssue[]
  /** Dòng trống hoàn toàn bị bỏ qua, không tính là lỗi. Đếm để báo lại cho BQL. */
  skippedBlank: number
}

// BQL đặt tên cột mỗi nơi một kiểu. Nhận nhiều biến thể thay vì bắt họ sửa file.
const HEADER_ALIASES: Record<keyof ParsedUnit, string[]> = {
  building_code: ['toa', 'tòa', 'ma toa', 'mã tòa', 'block', 'building', 'building_code'],
  code: ['can ho', 'căn hộ', 'ma can', 'mã căn', 'so can', 'số căn', 'code', 'unit', 'unit_code'],
  floor_no: ['tang', 'tầng', 'floor', 'floor_no'],
  area_m2: ['dien tich', 'diện tích', 'dt', 'area', 'area_m2', 'm2'],
  kind: ['loai', 'loại', 'loai hinh', 'loại hình', 'kind', 'type'],
  state: ['tinh trang', 'tình trạng', 'trang thai', 'trạng thái', 'state', 'status'],
}

/** Bỏ dấu, gộp khoảng trắng — để "Diện tích (m2)" khớp được với "dien tich". */
export function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[()._-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Trả về map: chỉ số cột trong file -> tên field. Cột lạ bị bỏ qua. */
export function mapHeaders(headers: unknown[]): Partial<Record<number, keyof ParsedUnit>> {
  const out: Partial<Record<number, keyof ParsedUnit>> = {}
  headers.forEach((h, i) => {
    if (typeof h !== 'string' && typeof h !== 'number') return
    const norm = normalizeHeader(String(h))
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      // Khớp nguyên cụm hoặc bắt đầu bằng alias: "dien tich m2" -> area_m2.
      if (aliases.some((a) => norm === a || norm.startsWith(a + ' '))) {
        if (out[i] === undefined) out[i] = field as keyof ParsedUnit
        return
      }
    }
  })
  return out
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && v !== null && 'text' in v) return String((v as { text: unknown }).text).trim()
  return String(v).trim()
}

/** "12", "12.0", " 12 " -> 12. "tầng 12", "" -> null. */
function toInt(v: unknown): number | null {
  const s = cellText(v)
  if (!s) return null
  const n = Number(s.replace(/,/g, ''))
  return Number.isInteger(n) ? n : null
}

/** Excel VN hay ghi "75,5" (dấu phẩy thập phân) lẫn "1.234,5". */
function toDecimal(v: unknown): number | null {
  const s = cellText(v)
  if (!s) return null
  // Có cả '.' và ',' -> '.' là phân cách nghìn. Chỉ có ',' -> ',' là thập phân.
  const cleaned = s.includes('.') && s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function validateUnitRows(
  rows: unknown[][],
  knownBuildingCodes: string[],
  existingUnitCodes: string[] = [],
): ValidationResult {
  const issues: RowIssue[] = []
  const ok: ParsedUnit[] = []
  let skippedBlank = 0

  if (rows.length === 0) {
    return { ok, issues: [{ row: 0, column: '-', message: 'File rỗng.' }], skippedBlank }
  }

  const headerMap = mapHeaders(rows[0])
  const found = new Set(Object.values(headerMap))
  for (const required of ['building_code', 'code', 'floor_no'] as const) {
    if (!found.has(required)) {
      issues.push({
        row: 1,
        column: required,
        message: `Không tìm thấy cột bắt buộc "${required}". Chấp nhận các tên: ${HEADER_ALIASES[required].join(', ')}.`,
      })
    }
  }
  if (issues.length > 0) return { ok, issues, skippedBlank }

  const buildings = new Set(knownBuildingCodes.map((c) => c.toUpperCase()))
  // Trùng mã căn: cả trùng với DB lẫn trùng trong chính file.
  const seen = new Map<string, number>()
  const existing = new Set(existingUnitCodes.map((c) => c.toUpperCase()))

  for (let r = 1; r < rows.length; r++) {
    const rowNo = r + 1 // BQL đếm từ 1 và tính cả dòng tiêu đề
    const raw = rows[r] ?? []
    const get = (f: keyof ParsedUnit): unknown => {
      const idx = Object.entries(headerMap).find(([, field]) => field === f)?.[0]
      return idx === undefined ? undefined : raw[Number(idx)]
    }

    if (raw.every((c) => cellText(c) === '')) { skippedBlank++; continue }

    const before = issues.length
    const buildingCode = cellText(get('building_code')).toUpperCase()
    const code = cellText(get('code')).toUpperCase()
    const floorNo = toInt(get('floor_no'))
    const areaRaw = cellText(get('area_m2'))
    const area = areaRaw ? toDecimal(get('area_m2')) : null
    const kindRaw = cellText(get('kind')).toLowerCase()
    const stateRaw = cellText(get('state')).toLowerCase()

    if (!buildingCode) {
      issues.push({ row: rowNo, column: 'tòa', message: 'Thiếu mã tòa.' })
    } else if (!buildings.has(buildingCode)) {
      issues.push({
        row: rowNo, column: 'tòa',
        message: `Tòa "${buildingCode}" chưa có trong hệ thống. Tạo tòa trước khi import căn.`,
      })
    }

    if (!code) {
      issues.push({ row: rowNo, column: 'căn hộ', message: 'Thiếu mã căn.' })
    } else if (existing.has(code)) {
      issues.push({ row: rowNo, column: 'căn hộ', message: `Mã căn "${code}" đã có trong hệ thống.` })
    } else if (seen.has(code)) {
      issues.push({
        row: rowNo, column: 'căn hộ',
        message: `Mã căn "${code}" trùng với dòng ${seen.get(code)} trong cùng file.`,
      })
    }

    if (floorNo === null) {
      issues.push({
        row: rowNo, column: 'tầng',
        message: `Tầng phải là số nguyên, đang là "${cellText(get('floor_no'))}".`,
      })
    }

    if (areaRaw && area === null) {
      issues.push({ row: rowNo, column: 'diện tích', message: `Diện tích không phải số: "${areaRaw}".` })
    } else if (area !== null && area <= 0) {
      issues.push({ row: rowNo, column: 'diện tích', message: `Diện tích phải lớn hơn 0, đang là ${area}.` })
    }

    const kind = (kindRaw || 'apartment') as UnitKind
    if (!(Constants.public.Enums.unit_kind as readonly string[]).includes(kind)) {
      issues.push({
        row: rowNo, column: 'loại',
        message: `Loại "${kindRaw}" không hợp lệ. Chấp nhận: ${Constants.public.Enums.unit_kind.join(', ')}.`,
      })
    }

    const state = (stateRaw || 'vacant') as UnitState
    if (!(Constants.public.Enums.unit_state as readonly string[]).includes(state)) {
      issues.push({
        row: rowNo, column: 'tình trạng',
        message: `Tình trạng "${stateRaw}" không hợp lệ. Chấp nhận: ${Constants.public.Enums.unit_state.join(', ')}.`,
      })
    }

    if (code) seen.set(code, rowNo)
    // Chỉ nhận dòng sạch hoàn toàn. Nhận nửa vời rồi để BQL sửa sau còn tệ hơn.
    if (issues.length === before) {
      ok.push({ building_code: buildingCode, code, floor_no: floorNo!, area_m2: area, kind, state })
    }
  }

  return { ok, issues, skippedBlank }
}
