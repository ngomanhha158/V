/**
 * Đăng ký chuyển nhà và thi công nội thất — chữ nghĩa dùng chung.
 *
 * Chỗ đắt nhất ở đây là VÒNG ĐỜI KÝ QUỸ. Một con số "10.000.000đ" trên màn hình
 * không nói được đã nhận chưa, trừ bao nhiêu, còn phải hoàn bao nhiêu — mà đó
 * mới là ba câu người ta hỏi khi đi lấy lại tiền.
 */

export type LoaiDK = 'chuyen_vao' | 'chuyen_ra' | 'thi_cong'
export type TrangThaiDK = 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'hoan_thanh' | 'huy'

export const NHAN_LOAI: Record<LoaiDK, string> = {
  chuyen_vao: 'Chuyển vào',
  chuyen_ra: 'Chuyển ra',
  thi_cong: 'Thi công nội thất',
}

export const NHAN_TRANG_THAI: Record<TrangThaiDK, string> = {
  cho_duyet: 'Chờ ban quản lý duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Bị từ chối',
  hoan_thanh: 'Đã hoàn thành',
  huy: 'Đã hủy',
}

export const TONE_TRANG_THAI: Record<TrangThaiDK, 'tot' | 'canh' | 'xau' | 'trung' | 'brand'> = {
  cho_duyet: 'canh',
  da_duyet: 'brand',
  tu_choi: 'xau',
  hoan_thanh: 'tot',
  huy: 'trung',
}

export type KyQuy = {
  ky_quy_phai_nop: number
  ky_quy_da_nop: number
  ky_quy_tru: number
  ky_quy_hoan: number
  ly_do_tru: string | null
  trang_thai: string
}

export type ChangKyQuy =
  | { buoc: 'khong_can'; loi: string }
  | { buoc: 'chua_nop'; con_thieu: number; loi: string }
  | { buoc: 'da_nop_du'; loi: string }
  | { buoc: 'da_tat_toan'; loi: string }

/**
 * Ký quỹ đang ở chặng nào — và chặng đó nói ra việc phải làm tiếp.
 *
 * "Ký quỹ: 10.000.000đ" đứng một mình không phân biệt được "phải nộp 10 triệu"
 * với "đã nộp 10 triệu", mà hai câu đó ngược hẳn nhau về việc phải làm.
 */
export function changKyQuy(d: KyQuy): ChangKyQuy {
  if (d.trang_thai === 'hoan_thanh') {
    const chi = d.ky_quy_tru > 0
      ? ` Đã trừ ${vnd(d.ky_quy_tru)} — ${d.ly_do_tru?.trim() || 'không ghi lý do'}.`
      : ' Không trừ đồng nào.'
    return {
      buoc: 'da_tat_toan',
      loi: `Đã tất toán: nhận ${vnd(d.ky_quy_da_nop)}, hoàn lại ${vnd(d.ky_quy_hoan)}.${chi}`,
    }
  }
  if (d.ky_quy_phai_nop <= 0) {
    return { buoc: 'khong_can', loi: 'Đăng ký này không yêu cầu ký quỹ.' }
  }
  if (d.ky_quy_da_nop < d.ky_quy_phai_nop) {
    const thieu = d.ky_quy_phai_nop - d.ky_quy_da_nop
    return {
      buoc: 'chua_nop',
      con_thieu: thieu,
      loi:
        `Còn thiếu ${vnd(thieu)} ký quỹ (đã nộp ${vnd(d.ky_quy_da_nop)}/`
        + `${vnd(d.ky_quy_phai_nop)}). Chưa nộp đủ thì giấy phép chưa có hiệu lực.`,
    }
  }
  return {
    buoc: 'da_nop_du',
    loi: `Đã nộp đủ ${vnd(d.ky_quy_da_nop)} ký quỹ. Hoàn lại sau khi tất toán.`,
  }
}

function vnd(n: number) {
  return `${n.toLocaleString('vi-VN')}đ`
}

/** "08:00 – 16:00, không làm chủ nhật" */
export function loiKhungGio(bd: string, kt: string, lamCN: boolean): string {
  const g = (t: string) => t.slice(0, 5)
  return `${g(bd)} – ${g(kt)}${lamCN ? ', kể cả chủ nhật' : ', không làm chủ nhật'}`
}

/** "08/09 – 22/09/2026", gộp năm khi hai mốc cùng năm. */
export function loiKhoangNgay(tu: string, den: string): string {
  const [y1, m1, d1] = tu.split('-')
  const [y2, m2, d2] = den.split('-')
  if (tu === den) return `${d1}/${m1}/${y1}`
  if (y1 === y2) return `${d1}/${m1} – ${d2}/${m2}/${y2}`
  return `${d1}/${m1}/${y1} – ${d2}/${m2}/${y2}`
}

/** Số ngày của giấy phép, tính cả hai đầu. */
export function soNgay(tu: string, den: string): number {
  const a = Date.parse(`${tu}T00:00:00Z`)
  const b = Date.parse(`${den}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

/**
 * Mức ký quỹ gợi ý — CHỈ LÀ GỢI Ý, và màn hình phải nói thế.
 *
 * Ban quản lý gõ đè được. Một con số máy tự tính rồi khóa lại là máy quyết định
 * một khoản tiền của cư dân, mà chuyện đó thì phải có người ký tên.
 */
export function goiYKyQuy(loai: string, ngay: number): number {
  if (loai !== 'thi_cong') return 2_000_000
  if (ngay <= 7) return 5_000_000
  if (ngay <= 30) return 10_000_000
  return 20_000_000
}
