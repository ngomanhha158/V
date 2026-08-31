// Cấu hình tài khoản nhận tiền. Đọc từ biến môi trường vì mỗi khu một tài
// khoản, và số tài khoản KHÔNG nên nằm trong git.
//
// Trả về null thay vì ném lỗi khi chưa cấu hình: chưa điền thì trang hóa đơn
// vẫn xem được, chỉ là không có QR — thà thiếu QR còn hơn cả trang trắng.
export type BankConfig = { bin: string; accountNumber: string; accountName: string }

export function bankConfig(): BankConfig | null {
  const bin = process.env.VBUILDING_BANK_BIN
  const accountNumber = process.env.VBUILDING_BANK_ACCOUNT
  const accountName = process.env.VBUILDING_BANK_NAME ?? ''
  if (!bin || !accountNumber) return null
  return { bin, accountNumber, accountName }
}
