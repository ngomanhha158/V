/**
 * Biểu quyết hội nghị nhà chung cư — chữ nghĩa và phép tính dùng chung giữa
 * màn ban quản trị và màn cư dân.
 *
 * Chỗ dễ sai nhất của cả tính năng không nằm ở SQL mà nằm ở CÂU CHỮ trên màn
 * hình: "66,67% tán thành" là một con số vô nghĩa nếu không nói rõ 66,67% CỦA
 * CÁI GÌ. Hội nghị nhà chung cư có hai mẫu số khác nhau và người đọc không có
 * cách nào tự đoán ra đang dùng mẫu số nào.
 */

export type YKien = 'tan_thanh' | 'khong_tan_thanh' | 'trang'

export const Y_KIEN: YKien[] = ['tan_thanh', 'khong_tan_thanh', 'trang']

export const NHAN_Y_KIEN: Record<YKien, string> = {
  tan_thanh: 'Tán thành',
  khong_tan_thanh: 'Không tán thành',
  trang: 'Phiếu trắng',
}

export const TONE_Y_KIEN: Record<YKien, 'tot' | 'xau' | 'trung'> = {
  tan_thanh: 'tot',
  khong_tan_thanh: 'xau',
  trang: 'trung',
}

/** Giải thích phiếu trắng, vì đây là chỗ cư dân hay hiểu nhầm nhất. */
export const GIAI_THICH_Y_KIEN: Record<YKien, string> = {
  tan_thanh: 'Đồng ý thông qua nội dung này.',
  khong_tan_thanh: 'Không đồng ý thông qua nội dung này.',
  trang:
    'Bạn có tham gia biểu quyết nhưng không chọn bên nào. Phiếu trắng VẪN TÍNH vào '
    + 'tỷ lệ dự họp và vẫn nằm trong mẫu số khi tính tỷ lệ tán thành — nó không '
    + 'giống với việc không bỏ phiếu.',
}

export type TrangThaiBQ = 'da_huy' | 'da_dong' | 'dang_mo'

export function trangThaiBQ(b: { huy_luc: string | null; dong_luc: string | null }): TrangThaiBQ {
  if (b.huy_luc) return 'da_huy'
  if (b.dong_luc) return 'da_dong'
  return 'dang_mo'
}

export const NHAN_TRANG_THAI: Record<TrangThaiBQ, string> = {
  dang_mo: 'Đang mở',
  da_dong: 'Đã kiểm phiếu',
  da_huy: 'Đã hủy',
}

export const TONE_TRANG_THAI: Record<TrangThaiBQ, 'tot' | 'canh' | 'xau' | 'trung'> = {
  dang_mo: 'canh',
  da_dong: 'tot',
  da_huy: 'trung',
}

/** Kết quả kiểm phiếu, đúng hình dạng hàm kiem_phieu_bieu_quyet() trả về. */
export type KetQua = {
  dien_tich_bo_phieu: number
  tan_thanh: number
  khong_tan_thanh: number
  trang: number
  tong_dien_tich: number
  so_can_da_bo: number
  ty_le_du_hop: number
  ty_le_tan_thanh: number
  du_hop: boolean
  thong_qua: boolean
}

/**
 * Làm tròn 2 chữ số y hệt `round(..., 2)` của Postgres.
 *
 * Có hàm này để màn hình và biên bản in ra CÙNG MỘT con số. Trước đây chỗ nào
 * cần tỷ lệ thì tự chia rồi tự `toFixed`, và `toFixed` làm tròn theo IEEE-754
 * nên 0,125 ra 0,12 còn Postgres ra 0,13 — lệch một chữ số cuối ở đúng thứ
 * người ta đem đi kiện nhau.
 */
export function tyLe(phan: number, tong: number): number {
  if (!(tong > 0)) return 0
  return Math.round((100 * phan) / tong * 100 + Number.EPSILON) / 100
}

/** "1.234,5 m²" — diện tích luôn kèm đơn vị, vì đây là ĐƠN VỊ CỦA LÁ PHIẾU. */
export function m2(n: number): string {
  return `${n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m²`
}

export function phanTram(n: number): string {
  return `${n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
}

/**
 * Còn thiếu bao nhiêu diện tích nữa mới đủ điều kiện họp.
 *
 * Ban quản trị đi vận động từng nhà thì câu hỏi của họ luôn là "còn thiếu bao
 * nhiêu", không phải "đang được bao nhiêu phần trăm". Trả về 0 khi đã đủ.
 */
export function thieuDeDuHop(k: KetQua, nguongDuHop: number): number {
  const can = (nguongDuHop / 100) * k.tong_dien_tich
  const thieu = can - k.dien_tich_bo_phieu
  return thieu > 0 ? Math.round(thieu * 100) / 100 : 0
}

/**
 * Nói ra kết quả bằng tiếng người, KÈM MẪU SỐ.
 *
 * Ba trạng thái, và chúng khác nhau về bản chất chứ không phải về mức độ:
 *  · chưa đủ dự họp — cuộc họp chưa có giá trị, tỷ lệ tán thành CHƯA CÓ NGHĨA;
 *  · đủ dự họp nhưng không quá ngưỡng — hội nghị hợp lệ và đã bác nội dung này;
 *  · thông qua.
 * Gộp hai cái đầu thành một chữ "không thông qua" là xóa mất khác biệt giữa
 * "hội nghị không họp được" và "hội nghị đã họp và nói không".
 */
export function giaiThichKetQua(
  k: KetQua,
  nguongDuHop: number,
  nguongThongQua: number,
): { ok: boolean; tieu: string; than: string } {
  if (!k.du_hop) {
    const thieu = thieuDeDuHop(k, nguongDuHop)
    return {
      ok: false,
      tieu: 'Chưa đủ điều kiện tiến hành',
      than:
        `Mới ${phanTram(k.ty_le_du_hop)} diện tích toàn khu bỏ phiếu `
        + `(${m2(k.dien_tich_bo_phieu)} trên ${m2(k.tong_dien_tich)}), `
        + `cần ${phanTram(nguongDuHop)} — còn thiếu ${m2(thieu)}. `
        + 'Chưa đủ dự họp thì tỷ lệ tán thành bên dưới chưa nói lên điều gì.',
    }
  }
  if (k.thong_qua) {
    return {
      ok: true,
      tieu: 'Nội dung được thông qua',
      than:
        `${phanTram(k.ty_le_tan_thanh)} diện tích ĐÃ BỎ PHIẾU tán thành `
        + `(${m2(k.tan_thanh)} trên ${m2(k.dien_tich_bo_phieu)}), đạt ngưỡng `
        + `${phanTram(nguongThongQua)}. Hội nghị đủ điều kiện tiến hành với `
        + `${phanTram(k.ty_le_du_hop)} diện tích toàn khu tham gia.`,
    }
  }
  return {
    ok: false,
    tieu: 'Không thông qua',
    than:
      `Hội nghị đủ điều kiện tiến hành (${phanTram(k.ty_le_du_hop)} diện tích toàn khu `
      + `tham gia) nhưng chỉ ${phanTram(k.ty_le_tan_thanh)} diện tích đã bỏ phiếu tán thành, `
      + `dưới ngưỡng ${phanTram(nguongThongQua)}. Nội dung này bị bác.`,
  }
}

/**
 * Ba đoạn của thanh kết quả, tính theo DIỆN TÍCH TOÀN KHU.
 *
 * Vẽ theo diện tích đã bỏ phiếu thì thanh luôn đầy 100% và người xem không
 * thấy được phần lớn nhất của câu chuyện: bao nhiêu căn chưa bỏ phiếu.
 */
export function doanThanh(k: KetQua) {
  const t = k.tong_dien_tich
  const chuaBo = Math.max(0, t - k.dien_tich_bo_phieu)
  return [
    { khoa: 'tan_thanh' as const, m2: k.tan_thanh, pt: tyLe(k.tan_thanh, t) },
    { khoa: 'khong_tan_thanh' as const, m2: k.khong_tan_thanh, pt: tyLe(k.khong_tan_thanh, t) },
    { khoa: 'trang' as const, m2: k.trang, pt: tyLe(k.trang, t) },
    { khoa: 'chua_bo' as const, m2: chuaBo, pt: tyLe(chuaBo, t) },
  ]
}

export const NHAN_DOAN: Record<'tan_thanh' | 'khong_tan_thanh' | 'trang' | 'chua_bo', string> = {
  ...NHAN_Y_KIEN,
  chua_bo: 'Chưa bỏ phiếu',
}

/**
 * Lời nhắc cho cư dân đang có căn chưa bỏ phiếu.
 *
 * Chủ nhiều căn là người dễ bỏ sót nhất mà phiếu của họ lại nặng nhất — bỏ
 * một căn 120 m² là bỏ đúng phần đáng kể nhất của chính mình.
 */
export function loiConCanChuaBo(
  ds: { ma_can: string; dien_tich: number; da_bo: boolean }[],
): string | null {
  const con = ds.filter((c) => !c.da_bo)
  if (con.length === 0) return null
  if (con.length === 1) {
    return `Căn ${con[0].ma_can} (${m2(con[0].dien_tich)}) của bạn chưa bỏ phiếu.`
  }
  const tong = con.reduce((s, c) => s + c.dien_tich, 0)
  return `${con.length} căn của bạn chưa bỏ phiếu, cộng lại ${m2(tong)}.`
}
