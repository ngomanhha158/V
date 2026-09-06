// Kiểm tra dữ liệu import CHỈ SỐ CÔNG TƠ. Thuần tuý, không đụng DB, không đụng
// React — cùng lý do với units.ts: test được bằng node:test, và chỗ báo lỗi là
// một nguồn duy nhất.
//
// Vì sao chỗ này phải khắt khe hơn import căn hộ: tiền nước = curr - prev. Một
// dòng sai ở đây không làm hỏng màn hình nào cả — nó ra một tờ hóa đơn hợp lệ,
// có mã QR, gửi tới cư dân, chỉ sai số tiền. Và sai số tiền thì phát hiện ở chỗ
// người ta khiếu nại, không phải ở chỗ log lỗi.

import { normalizeHeader } from './units.ts'

export type ParsedReading = {
  unit_code: string
  prev_index: number
  curr_index: number
}

export type RowIssue = { row: number; column: string; message: string }

export type ReadingResult = {
  ok: ParsedReading[]
  issues: RowIssue[]
  skippedBlank: number
  /** Căn có trong hệ thống mà file không nhắc tới. Không phải lỗi — công tơ
   *  chưa đọc được thì để trống còn hơn bịa — nhưng phải đếm và nói ra. */
  thieu: string[]
}

type Truong = 'unit_code' | 'prev_index' | 'curr_index'

const HEADER_ALIASES: Record<Truong, string[]> = {
  unit_code: ['can ho', 'căn hộ', 'ma can', 'mã căn', 'so can', 'số căn', 'code', 'unit', 'unit_code'],
  prev_index: ['chi so cu', 'chỉ số cũ', 'cu', 'cũ', 'dau ky', 'đầu kỳ', 'prev', 'prev_index', 'chi so dau'],
  curr_index: ['chi so moi', 'chỉ số mới', 'moi', 'mới', 'cuoi ky', 'cuối kỳ', 'curr', 'curr_index', 'chi so cuoi', 'chi so'],
}

export function mapHeaders(headers: unknown[]): Partial<Record<number, Truong>> {
  const out: Partial<Record<number, Truong>> = {}
  headers.forEach((h, i) => {
    if (typeof h !== 'string' && typeof h !== 'number') return
    const norm = normalizeHeader(String(h))
    // Xét theo thứ tự cụ thể → chung, để "chi so cu" không bị "chi so" nuốt mất.
    // Nuốt nhầm ở đây là cột cũ và cột mới đổi chỗ cho nhau, mà cả hai đều là số
    // hợp lệ nên không có gì kêu lên — chỉ có hóa đơn ra số âm hoặc số khổng lồ.
    const ung: [Truong, number][] = []
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Truong, string[]][]) {
      for (const a of aliases) {
        if (norm === a || norm.startsWith(a + ' ')) ung.push([field, a.length])
      }
    }
    if (ung.length === 0) return
    ung.sort((x, y) => y[1] - x[1])   // alias dài nhất thắng
    const field = ung[0][0]
    if (out[i] === undefined && !Object.values(out).includes(field)) out[i] = field
  })
  return out
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && v !== null && 'text' in v) return String((v as { text: unknown }).text).trim()
  return String(v).trim()
}

/** "1.234,5" (nghìn bằng chấm) và "75,5" (thập phân bằng phẩy) — Excel VN. */
function toSo(v: unknown): number | null {
  const s = cellText(v)
  if (!s) return null
  const cleaned = s.includes('.') && s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * @param knownUnitCodes  mã căn CỦA KHU ĐANG XEM — không phải của cả hệ thống.
 * @param chiSoCuoiKyTruoc  mã căn (hoa) -> chỉ số cuối kỳ trước, để điền vào
 *        khi file không có cột "chỉ số cũ", và để đối chiếu khi file có.
 */
export function validateReadingRows(
  rows: unknown[][],
  knownUnitCodes: string[],
  chiSoCuoiKyTruoc: Record<string, number> = {},
): ReadingResult {
  const issues: RowIssue[] = []
  const ok: ParsedReading[] = []
  let skippedBlank = 0

  if (rows.length === 0) {
    return { ok, issues: [{ row: 0, column: '-', message: 'File rỗng.' }], skippedBlank, thieu: [] }
  }

  const headerMap = mapHeaders(rows[0])
  const found = new Set(Object.values(headerMap))
  for (const required of ['unit_code', 'curr_index'] as const) {
    if (!found.has(required)) {
      issues.push({
        row: 1,
        column: required === 'unit_code' ? 'mã căn' : 'chỉ số mới',
        message: `Không tìm thấy cột bắt buộc. Chấp nhận các tên: ${HEADER_ALIASES[required].join(', ')}.`,
      })
    }
  }
  if (issues.length > 0) return { ok, issues, skippedBlank, thieu: [] }

  const bietMa = new Map(knownUnitCodes.map((c) => [c.toUpperCase(), c]))
  const cuoiTruoc = new Map(Object.entries(chiSoCuoiKyTruoc).map(([k, v]) => [k.toUpperCase(), v]))
  const daGap = new Map<string, number>()

  for (let r = 1; r < rows.length; r++) {
    const rowNo = r + 1
    const raw = rows[r] ?? []
    const get = (f: Truong): unknown => {
      const idx = Object.entries(headerMap).find(([, field]) => field === f)?.[0]
      return idx === undefined ? undefined : raw[Number(idx)]
    }

    if (raw.every((c) => cellText(c) === '')) { skippedBlank++; continue }

    const truoc = issues.length
    const ma = cellText(get('unit_code')).toUpperCase()
    const currRaw = cellText(get('curr_index'))
    const prevRaw = cellText(get('prev_index'))

    if (!ma) {
      issues.push({ row: rowNo, column: 'mã căn', message: 'Thiếu mã căn.' })
    } else if (!bietMa.has(ma)) {
      issues.push({
        row: rowNo, column: 'mã căn',
        message: `Căn "${ma}" không có trong khu này. Sai khu, hay sai mã?`,
      })
    } else if (daGap.has(ma)) {
      issues.push({
        row: rowNo, column: 'mã căn',
        message: `Căn "${ma}" đã có ở dòng ${daGap.get(ma)}. Hai chỉ số cho cùng một căn thì không biết tin dòng nào.`,
      })
    }

    const curr = toSo(get('curr_index'))
    if (!currRaw) {
      issues.push({ row: rowNo, column: 'chỉ số mới', message: 'Thiếu chỉ số mới.' })
    } else if (curr === null) {
      issues.push({ row: rowNo, column: 'chỉ số mới', message: `Không phải số: "${currRaw}".` })
    } else if (curr < 0) {
      issues.push({ row: rowNo, column: 'chỉ số mới', message: `Chỉ số âm: ${curr}.` })
    }

    // ── Chỉ số cũ: lấy từ file nếu có, không thì lấy chỉ số cuối kỳ trước ──
    // KHÔNG BAO GIỜ mặc định về 0. Trên một công tơ đã chạy 5 năm, 0 biến cả
    // lượng nước dùng từ ngày lắp thành lượng dùng của tháng này.
    let prev: number | null = null
    const cuoi = cuoiTruoc.get(ma)
    if (prevRaw) {
      prev = toSo(get('prev_index'))
      if (prev === null) {
        issues.push({ row: rowNo, column: 'chỉ số cũ', message: `Không phải số: "${prevRaw}".` })
      } else if (cuoi !== undefined && prev !== cuoi) {
        // KHÔNG tự chọn bên nào. Lệch ở đây nghĩa là công tơ vừa thay, hoặc
        // người đi đọc đã đọc nhầm đồng hồ — hai chuyện khác hẳn nhau, và đoán
        // sai chuyện nào cũng ra một tờ hóa đơn sai mà nhìn thì vẫn bình thường.
        issues.push({
          row: rowNo, column: 'chỉ số cũ',
          message: `File ghi ${prev} nhưng cuối kỳ trước hệ thống ghi ${cuoi}. `
            + 'Công tơ vừa thay, hay đọc nhầm đồng hồ? Sửa cho khớp rồi nhập lại.',
        })
      }
    } else if (cuoi !== undefined) {
      prev = cuoi
    } else if (ma && bietMa.has(ma)) {
      issues.push({
        row: rowNo, column: 'chỉ số cũ',
        message: `Căn "${ma}" chưa từng có chỉ số nào trong hệ thống, nên phải ghi rõ chỉ số cũ `
          + 'vào file (công tơ mới lắp thì ghi 0).',
      })
    }

    if (prev !== null && curr !== null && curr < prev) {
      issues.push({
        row: rowNo, column: 'chỉ số mới',
        message: `Chỉ số mới (${curr}) nhỏ hơn chỉ số cũ (${prev}). Công tơ không quay ngược.`,
      })
    }

    if (ma) daGap.set(ma, rowNo)
    // Chỉ nhận dòng sạch hoàn toàn — giống import căn hộ. Nhận nửa vời rồi để
    // BQL sửa sau, ở đây, là để một tờ hóa đơn sai lọt ra ngoài.
    if (issues.length === truoc && curr !== null && prev !== null) {
      ok.push({ unit_code: bietMa.get(ma)!, prev_index: prev, curr_index: curr })
    }
  }

  // Căn không có trong file. Cố ý KHÔNG tính là lỗi: công tơ khoá cửa không đọc
  // được là chuyện thường. Nhưng phải nói ra — im lặng bỏ qua 12 căn thì tháng
  // đó 12 hộ không có hóa đơn nước, và không ai biết cho tới lúc đối soát.
  const coTrongFile = new Set(ok.map((o) => o.unit_code.toUpperCase()))
  const thieu = knownUnitCodes.filter((c) => !coTrongFile.has(c.toUpperCase())).sort()

  return { ok, issues, skippedBlank, thieu }
}
