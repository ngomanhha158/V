// Sinh payload VietQR động (chuẩn EMVCo / NAPAS). Thuần tuý, không đụng DB.
//
// Vì sao tách ra và test kỹ: QR sai thì cư dân quét, app ngân hàng báo lỗi hoặc
// tệ hơn là chuyển sang tài khoản khác. Không có cách nào phát hiện bằng mắt —
// chuỗi payload nhìn như nhau dù đúng hay sai một byte CRC.

/** TLV của EMVCo: id 2 ký tự + độ dài 2 ký tự + giá trị. */
function tlv(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Truong ${id} dai qua 99 ky tu`)
  return id + String(value.length).padStart(2, '0') + value
}

/**
 * CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, không đảo bit, xorout 0.
 * Đây là chỗ dễ sai nhất — có ít nhất 4 biến thể CRC-16 khác nhau cùng dùng
 * poly 0x1021. Test dùng vector chuẩn "123456789" -> 0x29B1 để chốt đúng biến thể.
 */
export function crc16ccitt(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Nội dung chuyển khoản. Ngân hàng VN bỏ dấu và ký tự lạ, nên chỉ dùng
 * [A-Z0-9 .-] để cái webhook đọc lại được đúng thứ mình ghi ra.
 * Dạng: "VB <mã căn> <YYYYMM>"
 */
export function paymentRef(unitCode: string, period: string): string {
  const code = unitCode.toUpperCase().replace(/[^A-Z0-9.-]/g, '')
  const ym = period.slice(0, 7).replace('-', '')   // 2026-08-01 -> 202608
  return `VB ${code} ${ym}`
}

export type VietQrInput = {
  /** Mã BIN ngân hàng theo NAPAS, 6 chữ số. VD Vietcombank 970436. */
  bin: string
  accountNumber: string
  /** Số tiền VND, số nguyên. Bỏ trống = QR không cố định số tiền. */
  amount?: number
  description?: string
}

export function buildVietQr({ bin, accountNumber, amount, description }: VietQrInput): string {
  if (!/^\d{6}$/.test(bin)) throw new Error('BIN ngan hang phai la 6 chu so')
  if (!/^\d{6,19}$/.test(accountNumber)) throw new Error('So tai khoan khong hop le')
  if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0)) {
    throw new Error('So tien phai la so nguyen duong')
  }

  const merchant =
    tlv('00', 'A000000727') +                                  // GUID của NAPAS
    tlv('01', tlv('00', bin) + tlv('01', accountNumber)) +      // đơn vị thụ hưởng
    tlv('02', 'QRIBFTTA')                                       // chuyển tới TÀI KHOẢN

  const body =
    tlv('00', '01') +
    // 12 = QR động (gắn số tiền, dùng một lần). 11 = tĩnh.
    tlv('01', amount === undefined ? '11' : '12') +
    tlv('38', merchant) +
    tlv('53', '704') +                                          // VND
    (amount === undefined ? '' : tlv('54', String(amount))) +
    tlv('58', 'VN') +
    (description ? tlv('62', tlv('08', description)) : '')

  // CRC tính TRÊN CẢ "6304" rồi mới nối giá trị vào sau — quên phần này là
  // payload nhìn vẫn hợp lệ nhưng mọi app ngân hàng đều từ chối.
  const toCheck = body + '6304'
  return toCheck + crc16ccitt(toCheck)
}
