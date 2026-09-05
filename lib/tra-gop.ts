/**
 * Thu theo đợt cho khoản lớn — chữ nghĩa dùng chung giữa màn BQL và màn cư dân.
 *
 * Câu khó nhất ở đây là câu KHÔNG nói được: "đợt này đã thu chưa".
 *
 * Đợt thu nằm chung một tờ hóa đơn với phí quản lý và tiền nước. Cư dân chuyển
 * thiếu một phần thì không có cách nào biết phần thiếu thuộc dòng nào — mọi
 * cách chia đều là bịa, và bịa ở đây là bịa một con số về tiền của người khác.
 * Nên toàn bộ tệp này nói về TỜ HÓA ĐƠN chứa đợt thu, chứ không giả vờ biết
 * từng dòng đã trả tới đâu.
 */

export type TrangThaiDot =
  | 'da_huy'
  | 'chua_len_hoa_don'
  | 'tren_hoa_don_nhap'
  | 'con_thieu'
  | 'da_tra'

export type Dot = {
  thu_tu: number
  ky: string
  so_tien: number
  hoa_don_id: string | null
  hoa_don_trang_thai: string | null
  hoa_don_tong: number | null
  hoa_don_da_tra: number | null
  huy_luc?: string | null
}

export function trangThaiDot(d: Dot): TrangThaiDot {
  if (d.huy_luc) return 'da_huy'
  // Chưa có hóa đơn, hoặc có nhưng còn ở bản nháp: chưa ai đòi tiền cả. Hóa đơn
  // nháp bị generate_invoices dựng lại từ đầu mỗi lần chạy, nên nó chưa hứa gì.
  if (!d.hoa_don_id) return 'chua_len_hoa_don'
  if (d.hoa_don_trang_thai === 'draft') return 'tren_hoa_don_nhap'
  const con = (d.hoa_don_tong ?? 0) - (d.hoa_don_da_tra ?? 0)
  return con <= 0 ? 'da_tra' : 'con_thieu'
}

export const NHAN_DOT: Record<TrangThaiDot, string> = {
  da_tra: 'Hóa đơn đã trả đủ',
  con_thieu: 'Hóa đơn còn thiếu',
  tren_hoa_don_nhap: 'Đang ở hóa đơn nháp',
  chua_len_hoa_don: 'Chưa tới kỳ',
  da_huy: 'Đã dừng thu',
}

export const TONE_DOT: Record<TrangThaiDot, 'tot' | 'canh' | 'xau' | 'trung'> = {
  da_tra: 'tot',
  con_thieu: 'xau',
  tren_hoa_don_nhap: 'canh',
  chua_len_hoa_don: 'trung',
  da_huy: 'trung',
}

/**
 * Câu nói rõ vì sao trạng thái là trạng thái của HÓA ĐƠN chứ không của đợt.
 *
 * Không có câu này thì "hóa đơn còn thiếu 300.000đ" đứng cạnh một đợt 111.111đ
 * làm người đọc tưởng mình còn nợ đúng đợt đó.
 */
export function loiDot(d: Dot, kyVN: (s: string) => string): string {
  switch (trangThaiDot(d)) {
    case 'da_huy':
      return 'Kế hoạch đã dừng. Đợt này không thu nữa.'
    case 'chua_len_hoa_don':
      return `Sẽ nằm trong hóa đơn kỳ ${kyVN(d.ky)}.`
    case 'tren_hoa_don_nhap':
      return `Đã vào bản nháp hóa đơn kỳ ${kyVN(d.ky)}, chờ ban quản lý phát hành.`
    case 'da_tra':
      return `Hóa đơn kỳ ${kyVN(d.ky)} đã trả đủ.`
    default: {
      const con = (d.hoa_don_tong ?? 0) - (d.hoa_don_da_tra ?? 0)
      return (
        `Hóa đơn kỳ ${kyVN(d.ky)} còn thiếu ${con.toLocaleString('vi-VN')}đ. `
        + 'Con số đó là của CẢ tờ hóa đơn — phí quản lý, tiền nước và đợt này '
        + 'gộp lại — nên không tách ra được phần nào thuộc đợt nào.'
      )
    }
  }
}

export const NHAN_CACH_CHIA: Record<string, string> = {
  theo_can: 'Chia đều mỗi căn',
  theo_m2: 'Chia theo diện tích',
}

/**
 * Số tiền mỗi tháng nặng thêm bao nhiêu.
 *
 * Đây là con số duy nhất cư dân thật sự quyết định dựa vào: không phải "tổng
 * 4,5 triệu" mà "mỗi tháng thêm 1,5 triệu, trong 3 tháng". Ban quản trị chọn số
 * đợt cũng nhìn đúng con số này.
 */
export function moiKy(tong: number, soDot: number): number {
  if (soDot <= 0) return tong
  return Math.floor(tong / soDot)
}

/**
 * So sánh gánh nặng: nếu thu một lần thì mỗi căn phải trả bao nhiêu, chia đợt
 * thì còn bao nhiêu một tháng. Dùng ở màn lập kế hoạch, TRƯỚC khi bấm.
 */
export function ganhNang(tongChiPhi: number, soCan: number, soDot: number) {
  if (soCan <= 0) return null
  const moiCan = Math.floor(tongChiPhi / soCan)
  return { moiCan, moiThang: moiKy(moiCan, soDot), soDot }
}

/** Danh sách kỳ mà kế hoạch sẽ chạm tới, để hiện ra trước khi bấm lập. */
export function cacKy(kyBatDau: string, soDot: number): string[] {
  const [y, m] = kyBatDau.split('-').map(Number)
  if (!y || !m) return []
  const ra: string[] = []
  for (let i = 0; i < soDot; i++) {
    const t = m - 1 + i
    const nam = y + Math.floor(t / 12)
    const thang = (t % 12) + 1
    ra.push(`${nam}-${String(thang).padStart(2, '0')}-01`)
  }
  return ra
}

/** "10/2026" — kỳ hóa đơn luôn viết theo tháng, không viết ngày. */
export function kyVN(iso: string): string {
  const [y, m] = iso.split('-')
  return `${m}/${y}`
}

/** Gom các dòng phẳng của tra_gop_cua_toi() thành từng kế hoạch × từng căn. */
export function gomTheoKeHoach<T extends {
  ke_hoach_id: string; ten: string; nghi_quyet: string; so_dot: number
  unit_id: string; ma_can: string; tong_phai_tra: number; huy_luc: string | null
}>(rows: T[]) {
  const map = new Map<string, {
    ke_hoach_id: string; ten: string; nghi_quyet: string; so_dot: number
    unit_id: string; ma_can: string; tong_phai_tra: number; huy_luc: string | null
    dot: T[]
  }>()
  for (const r of rows) {
    const khoa = `${r.ke_hoach_id}:${r.unit_id}`
    let g = map.get(khoa)
    if (!g) {
      g = { ...r, dot: [] }
      map.set(khoa, g)
    }
    g.dot.push(r)
  }
  return [...map.values()]
}
