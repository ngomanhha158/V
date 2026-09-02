import ExcelJS from 'exceljs'
import { DINH_DANG, type BaoCao, type Cot, type KieuCot } from './bao-cao.ts'

/**
 * Dựng file .xlsx từ định nghĩa báo cáo và các dòng đã lấy sẵn.
 *
 * Hai nguyên tắc, cả hai đều là chuyện kế toán chứ không phải chuyện kỹ thuật:
 *
 * 1. **Tiền ghi vào ô dạng SỐ, không phải chuỗi "1.287.000đ".** Ghi chuỗi thì
 *    kế toán không cộng được cột — mà cộng được cột chính là lý do người ta cần
 *    file Excel thay vì ảnh chụp màn hình.
 * 2. **File tự khai thời điểm chốt.** Báo cáo công nợ xuất hôm nay khác hôm qua,
 *    cả hai đều đúng. Không ghi mốc vào file thì hai người cầm hai file sẽ cãi
 *    nhau xem bản nào sai.
 */

export type ThongTinChot = {
  duAn: string
  /** 'YYYY-MM', hoặc null với báo cáo dạng ảnh chụp như công nợ. */
  ky: string | null
  chotLuc: Date
  nguoiXuat: string
}

const N = { style: 'thin' } as const
const VIEN = { top: N, left: N, bottom: N, right: N } as const

/** Ô trống phải để RỖNG chứ không phải chữ "null" hay số 0. */
function giaTri(cot: Cot, v: unknown): unknown {
  if (v === null || v === undefined || v === '') return null
  if (cot.kieu === 'ngay' || cot.kieu === 'ngaygio') {
    const d = v instanceof Date ? v : new Date(String(v))
    return Number.isNaN(d.getTime()) ? String(v) : d
  }
  if (cot.kieu === 'tien' || cot.kieu === 'so') {
    const n = typeof v === 'number' ? v : Number(v)
    // Không ép được thành số thì giữ nguyên chữ, đừng biến thành 0: một ô 0đ
    // trông như đã thu đủ, còn ô ghi chữ thì người đọc biết là có gì đó lạ.
    return Number.isFinite(n) ? n : String(v)
  }
  return String(v)
}

export async function dungWorkbook(
  bc: BaoCao, dong: Record<string, unknown>[], tt: ThongTinChot,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'VBuilding'
  wb.created = tt.chotLuc

  // ── Sheet 1: tổng hợp ──
  // Đứng trước sheet chi tiết có chủ ý: người mở file thấy ngay số tổng và mốc
  // chốt, rồi mới tới bảng. Tổng ở đây phải khớp với tổng cột bên chi tiết —
  // lệch là dấu hiệu file hỏng, và nhìn ra được ngay.
  const th = wb.addWorksheet('Tổng hợp')
  th.columns = [{ width: 26 }, { width: 34 }]
  const dongTom: [string, unknown, string?][] = [
    ['Báo cáo', bc.ten],
    ['Dự án', tt.duAn],
    ['Kỳ', bc.theoKy ? (tt.ky ?? '—') : 'Ảnh chụp tại thời điểm xuất'],
    ['Chốt lúc', tt.chotLuc, 'ngaygio'],
    ['Người xuất', tt.nguoiXuat],
    ['Số dòng', dong.length, 'so'],
  ]
  for (const [nhan, v, kieu] of dongTom) {
    const r = th.addRow([nhan, v])
    r.getCell(1).font = { bold: true }
    const fmt = kieu ? DINH_DANG[kieu as KieuCot] : undefined
    if (fmt) r.getCell(2).numFmt = fmt
  }

  const cotTien = bc.cot.filter((c) => c.kieu === 'tien')
  if (cotTien.length && dong.length) {
    th.addRow([])
    const r = th.addRow(['Tổng các cột tiền'])
    r.getCell(1).font = { bold: true }
    for (const c of cotTien) {
      const tong = dong.reduce((s, d) => {
        const n = Number(d[c.khoa])
        return s + (Number.isFinite(n) ? n : 0)
      }, 0)
      const hang = th.addRow([c.nhan, tong])
      hang.getCell(2).numFmt = DINH_DANG.tien!
    }
  }

  // ── Sheet 2: chi tiết ──
  const ct = wb.addWorksheet('Chi tiết')
  ct.columns = bc.cot.map((c) => ({ width: c.rong }))

  const dau = ct.addRow(bc.cot.map((c) => c.nhan))
  dau.font = { bold: true }
  dau.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } }
    cell.border = VIEN
    cell.alignment = { vertical: 'middle', wrapText: true }
  })

  for (const d of dong) {
    const r = ct.addRow(bc.cot.map((c) => giaTri(c, d[c.khoa])))
    bc.cot.forEach((c, i) => {
      const cell = r.getCell(i + 1)
      const fmt = DINH_DANG[c.kieu]
      if (fmt) cell.numFmt = fmt
      cell.border = VIEN
    })
  }

  // Đóng băng dòng tiêu đề và bật lọc: bảng vài trăm dòng mà cuộn xuống là mất
  // tiêu đề thì người đọc phải đếm cột bằng ngón tay.
  ct.views = [{ state: 'frozen', ySplit: 1 }]
  ct.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: bc.cot.length } }

  return Buffer.from(await wb.xlsx.writeBuffer())
}
