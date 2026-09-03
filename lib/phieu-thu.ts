/**
 * Phiếu thu điện tử — phần chữ nghĩa dùng chung giữa màn cư dân và màn BQL.
 *
 * Để ở đây vì cùng một con số phải được gọi cùng một tên ở hai màn: cư dân cầm
 * tờ phiếu đi hỏi, BQL mở sổ ra tra. Hai bên đọc hai chữ khác nhau cho cùng một
 * thứ là cuộc nói chuyện đó bắt đầu bằng việc gỡ hiểu nhầm.
 */

export type LoaiDong = 'hoa_don' | 'chi_tiet' | 'nop_truoc'

export const NHAN_HINH_THUC: Record<string, string> = {
  chuyen_khoan: 'Chuyển khoản',
  tien_mat: 'Tiền mặt',
}

export const hinhThuc = (m: string) => NHAN_HINH_THUC[m] ?? m

/** Số chứng từ dựng lại từ kỳ + số thứ tự. Cùng công thức với SQL (§15). */
export function soPhieu(ky: string, stt: number): string {
  const [nam, thang] = ky.split('-')
  return `PT-${nam.slice(2)}${thang}-${String(stt).padStart(4, '0')}`
}

/**
 * Câu trả lời cho câu hỏi đầu tiên của kiểm toán: dãy số có đứt không.
 *
 * Trả về danh sách số thứ tự trần thì người đọc phải tự ghép lại thành số
 * chứng từ mới đi tra được — mà đó chính là việc họ đang định làm. Nên ghép
 * sẵn, và nói luôn hệ quả: một lỗ trống là một tờ phiếu phải giải trình.
 */
export function loiLienTuc(ky: string, thieu: number[], daLap: number) {
  if (daLap === 0) return { ok: true as const, loi: 'Kỳ này chưa lập phiếu nào.' }
  if (thieu.length === 0) {
    return {
      ok: true as const,
      loi: `Dãy số liền mạch — ${daLap} phiếu, từ ${soPhieu(ky, 1)} đến ${soPhieu(ky, daLap)}, không đứt quãng.`,
    }
  }
  const ten = thieu.slice(0, 5).map((s) => soPhieu(ky, s))
  const con = thieu.length - ten.length
  return {
    ok: false as const,
    loi:
      `Thiếu ${thieu.length} số chứng từ: ${ten.join(', ')}${con > 0 ? ` và ${con} số nữa` : ''}. ` +
      'Hệ thống không có đường nào xóa phiếu — hủy thì phiếu vẫn nằm trong sổ. ' +
      'Số biến mất nghĩa là có người ghi thẳng vào database: tra nhật ký kiểm toán, bảng phieu_thu.',
  }
}

/**
 * Phiếu phải cân với số tiền ngân hàng báo. Dòng chi tiết phí KHÔNG cộng vào —
 * chúng nằm bên trong dòng hóa đơn ngay trên, cộng nữa là ra gấp đôi.
 */
export function tongDong(dong: { loai: LoaiDong; so_tien: number }[]): number {
  return dong.reduce((t, d) => (d.loai === 'chi_tiet' ? t : t + d.so_tien), 0)
}

/**
 * Phiếu đã hủy vẫn phải hiện ra, và phải nói rõ TIỀN KHÔNG MẤT. Ẩn nó đi là
 * cư dân cầm một tờ phiếu mà tra không ra; nói trống không "đã hủy" là họ
 * tưởng khoản tiền của mình bị hủy theo.
 */
export function loiHuy(lyDo: string | null) {
  return {
    tieu: 'Phiếu này đã hủy',
    than:
      `Lý do: ${lyDo?.trim() || 'không ghi'}. ` +
      'Tiền vẫn đã ghi nhận vào hệ thống — hủy phiếu là hủy tờ chứng từ, không phải hủy khoản thu. ' +
      'Nếu chưa nhận được phiếu thay thế, báo BQL.',
  }
}

/**
 * Một dòng "trả một phần" cần nói còn thiếu bao nhiêu, chứ không chỉ nói là
 * thiếu. Chuỗi này do SQL dựng sẵn (để tờ phiếu đã in không đổi chữ về sau),
 * hàm này chỉ dùng khi cần dựng lại ở phía màn hình.
 */
export const laMotPhan = (dienGiai: string) => dienGiai.includes('còn thiếu')
