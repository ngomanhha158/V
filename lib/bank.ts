import { createClient } from '@/lib/db/server'

/**
 * Tài khoản nhận tiền của MỘT KHU.
 *
 * Trước đây đọc thẳng ba biến môi trường, kèm đúng dòng ghi chú "mỗi khu một
 * tài khoản" — mà lại chỉ có MỘT bộ biến cho cả cài đặt. Với khu thứ hai thì
 * cư dân khu B quét QR ra số tài khoản của khu A và chuyển tiền vào đó thật.
 *
 * Giờ số tài khoản nằm ở bảng `projects`, mỗi khu một dòng (§28). Biến môi
 * trường còn lại làm ĐƯỜNG LÙI cho bản cài một khu đang chạy: không có nó thì
 * một lần deploy sẽ tắt QR của cả tòa cho tới khi có người kịp khai lại.
 */
export type BankConfig = { bin: string; accountNumber: string; accountName: string }

/** Đường lùi: ba biến môi trường của bản cài một khu. */
export function bankConfigMoiTruong(): BankConfig | null {
  const bin = process.env.VBUILDING_BANK_BIN
  const accountNumber = process.env.VBUILDING_BANK_ACCOUNT
  const accountName = process.env.VBUILDING_BANK_NAME ?? ''
  if (!bin || !accountNumber) return null
  return { bin, accountNumber, accountName }
}

/**
 * Tài khoản nhận tiền của khu `project`.
 *
 * Trả về null thay vì ném lỗi khi chưa cấu hình: chưa khai thì trang hóa đơn
 * vẫn xem được, chỉ là không có QR — thà thiếu QR còn hơn cả trang trắng.
 */
export async function bankConfigKhu(project: string | null | undefined): Promise<BankConfig | null> {
  if (project) {
    const db = await createClient()
    const { data } = await db.rpc('tk_nhan_tien', { p_project: project })
    const tk = (data ?? [])[0]
    if (tk?.bin && tk.so_tk) {
      return { bin: tk.bin, accountNumber: tk.so_tk, accountName: tk.chu_tk ?? '' }
    }
  }
  return bankConfigMoiTruong()
}
