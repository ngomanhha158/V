/**
 * Kho vật tư — chữ nghĩa dùng chung giữa các màn.
 *
 * Điều đáng nói nhất ở đây là điều KHÔNG hiện trên màn hình: không có ô nào cho
 * người dùng gõ tồn kho vào. Tồn là tổng của sổ, và một ô nhập tồn là một cửa
 * để sổ và thực tế lệch nhau mà không ai biết từ lúc nào. Muốn sửa thì đi qua
 * kiểm kê — có lý do, có tên người, có dòng chênh lệch nằm lại.
 */

export type LoaiPhieu = 'nhap' | 'xuat' | 'kiem_ke'

export const NHAN_LOAI: Record<LoaiPhieu, string> = {
  nhap: 'Nhập kho',
  xuat: 'Xuất kho',
  kiem_ke: 'Kiểm kê',
}

export const TONE_LOAI: Record<LoaiPhieu, 'tot' | 'canh' | 'xau' | 'trung' | 'brand'> = {
  nhap: 'brand',
  xuat: 'trung',
  kiem_ke: 'canh',
}

/** Dấu hiển thị của một loại phiếu: nhập cộng vào kho, xuất trừ đi. */
export function dauPhieu(loai: string): '+' | '−' | '±' {
  if (loai === 'nhap') return '+'
  if (loai === 'xuat') return '−'
  return '±'
}

export type Ton = {
  id: string
  ma: string
  ten: string
  don_vi: string
  ton: number
  ton_toi_thieu: number
  don_gia: number
  gia_tri: number
  sap_het: boolean
}

/**
 * Còn đủ dùng bao lâu nữa, nói bằng lời.
 *
 * "Còn 3" không nói được gì nếu không biết ngưỡng. Người đi mua cần biết đang
 * ở mức nào so với mức tối thiểu đã đặt ra, và thiếu bao nhiêu để về mức đó.
 */
export function loiTon(t: Ton): { tone: 'tot' | 'canh' | 'xau'; loi: string } {
  const dv = t.don_vi
  if (t.ton <= 0) {
    return {
      tone: 'xau',
      loi: `Hết sạch. Mọi lần xuất đều bị chặn cho tới khi nhập về.`,
    }
  }
  if (t.ton <= t.ton_toi_thieu) {
    const thieu = t.ton_toi_thieu - t.ton + 1
    return {
      tone: 'canh',
      loi:
        `Còn ${soVN(t.ton)} ${dv}, dưới mức tối thiểu ${soVN(t.ton_toi_thieu)} ${dv}. `
        + `Mua thêm ít nhất ${soVN(thieu)} ${dv}.`,
    }
  }
  return { tone: 'tot', loi: `Còn ${soVN(t.ton)} ${dv}.` }
}

/** Số lượng có thể lẻ (mét dây, lít sơn) nhưng không hiện ".00" thừa. */
export function soVN(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

/**
 * Kiểm một phiếu xuất TRƯỚC khi gửi đi: đủ tồn không, và thiếu cái gì.
 *
 * Để database chặn là đúng, nhưng người đứng ở kho cần biết ngay lúc gõ chứ
 * không phải sau khi bấm — họ đang cầm cái tuốc nơ vít trong tay kia.
 */
export function soatPhieuXuat(
  dong: { vat_tu: string; so_luong: number }[],
  ton: Map<string, Ton>,
): string[] {
  const loi: string[] = []
  for (const d of dong) {
    if (!(d.so_luong > 0)) continue
    const t = ton.get(d.vat_tu)
    if (!t) { loi.push('Có dòng chọn vật tư không còn trong danh mục.'); continue }
    if (d.so_luong > t.ton) {
      loi.push(`${t.ten}: kho chỉ còn ${soVN(t.ton)} ${t.don_vi}, không xuất được ${soVN(d.so_luong)}.`)
    }
  }
  return loi
}

/** Tổng tiền của một phiếu xuất, tính đúng như SQL sẽ tính. */
export function tongPhieu(
  dong: { vat_tu: string; so_luong: number }[],
  ton: Map<string, Ton>,
): number {
  let t = 0
  for (const d of dong) {
    const v = ton.get(d.vat_tu)
    if (v && d.so_luong > 0) t += Math.round(d.so_luong * v.don_gia)
  }
  return t
}

/**
 * Bình quân gia quyền liên hoàn — cùng công thức SQL dùng khi nhập.
 *
 * Có ở đây để màn nhập kho hiện được giá kho SẼ thành bao nhiêu trước khi bấm.
 * Người nhập hàng nhìn thấy một lô nhỏ mua đắt kéo giá cả kho lên thì họ hỏi
 * lại nhà cung cấp, chứ không phải phát hiện ba tháng sau lúc đối chiếu.
 */
export function giaBinhQuan(
  tonCu: number, giaCu: number, slMoi: number, giaMoi: number,
): number {
  const tong = tonCu + slMoi
  if (!(tong > 0)) return giaMoi
  return Math.round((tonCu * giaCu + slMoi * giaMoi) / tong)
}
