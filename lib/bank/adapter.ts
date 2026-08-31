// Chuẩn hoá gói tin webhook của nhà cung cấp về MỘT dạng duy nhất.
//
// Vì sao có lớp này thay vì đọc thẳng: phần khó của đối soát — khớp căn, chia
// tiền cho nhiều hóa đơn, chống bắn trùng — nằm trong SQL và không quan tâm
// tiền đến từ đâu. Tất cả khác biệt giữa nhà cung cấp gói gọn trong file này,
// nên đổi nhà cung cấp là sửa một hàm, không phải sửa đường tiền.

export const NHA_CUNG_CAP = ['sepay', 'casso'] as const
export type NhaCungCap = (typeof NHA_CUNG_CAP)[number]
export const laNhaCungCap = (v: string): v is NhaCungCap =>
  (NHA_CUNG_CAP as readonly string[]).includes(v)

export type GiaoDich = {
  /** Id giao dịch phía nhà cung cấp. Đây là khóa chống bắn trùng. */
  providerRef: string
  /** Mã tham chiếu của ngân hàng, để đối chiếu với sao kê giấy. */
  bankRef: string | null
  amount: number
  content: string
  /** ISO 8601 kèm múi giờ. */
  paidAt: string
  accountNumber: string | null
  raw: unknown
}

/**
 * Đổi mốc thời gian của nhà cung cấp sang ISO có múi giờ.
 *
 * SePay gửi "2023-03-25 14:02:37", KHÔNG kèm múi giờ — đó là giờ Việt Nam.
 * `new Date(chuỗi đó)` trong Node hiểu theo giờ máy chủ, mà máy chủ chạy UTC,
 * nên mọi giao dịch bị đẩy sớm 7 tiếng: tiền về lúc 5h sáng ngày 1 rơi về
 * tháng trước, và báo cáo "tiền thực về" của tháng đó thiếu đi một mẩu mà
 * không ai đối chiếu ra được.
 */
export function gioVN(s: string): string {
  const t = String(s).trim().replace(' ', 'T')
  if (/([Zz]|[+-]\d{2}:?\d{2})$/.test(t)) return new Date(t).toISOString()
  const day = /^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00:00` : t
  const d = new Date(`${day}+07:00`)
  if (Number.isNaN(d.getTime())) throw new Error(`Moc thoi gian khong doc duoc: ${s}`)
  return d.toISOString()
}

const chuoi = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v)

/** Đọc gói tin thành danh sách giao dịch TIỀN VÀO. Tiền ra bị bỏ ở đây. */
export function docWebhook(nhaCungCap: NhaCungCap, body: unknown): GiaoDich[] {
  const b = body as Record<string, unknown>
  if (!b || typeof b !== 'object') throw new Error('Goi tin khong phai JSON object')

  if (nhaCungCap === 'sepay') {
    // SePay bắn MỘT giao dịch mỗi lần gọi.
    // transferType 'in' = tiền vào, 'out' = tiền ra. Bỏ qua tiền ra: đó là chi
    // của ban quản lý, gạch nó vào công nợ cư dân là cộng tiền ngược.
    if (b.transferType !== 'in') return []
    const id = chuoi(b.id)
    if (!id) throw new Error('SePay: thieu id giao dich')
    return [{
      providerRef: id,
      bankRef: chuoi(b.referenceCode),
      amount: soDuong(b.transferAmount, 'SePay transferAmount'),
      // `content` là nội dung chuyển khoản; `description` là cả dòng sao kê.
      // Ưu tiên content, nhưng có ngân hàng để TRỐNG nó — mà `??` chỉ lùi khi
      // null/undefined, chuỗi rỗng vẫn lọt qua. Dùng chuoi() để '' cũng là thiếu.
      content: chuoi(b.content) ?? chuoi(b.description) ?? '',
      paidAt: gioVN(String(b.transactionDate)),
      accountNumber: chuoi(b.subAccount) ?? chuoi(b.accountNumber),
      raw: b,
    }]
  }

  // Casso v2 bắn cả LÔ: { error, data: [...] }.
  const data = b.data
  if (!Array.isArray(data)) throw new Error('Casso: thieu mang data')
  const ra: GiaoDich[] = []
  for (const item of data) {
    const d = item as Record<string, unknown>
    const tien = Number(d.amount)
    // Casso không có cờ in/out — tiền ra là số âm.
    if (!Number.isFinite(tien) || tien <= 0) continue
    const id = chuoi(d.id) ?? chuoi(d.tid)
    if (!id) throw new Error('Casso: thieu id giao dich')
    ra.push({
      providerRef: id,
      bankRef: chuoi(d.tid),
      amount: Math.round(tien),
      content: String(d.description ?? ''),
      paidAt: gioVN(String(d.when)),
      accountNumber: chuoi(d.subAccId) ?? chuoi(d.bank_sub_acc_id),
      raw: d,
    })
  }
  return ra
}

function soDuong(v: unknown, ten: string): number {
  const n = Number(v)
  // Không làm tròn im lặng số rác: số tiền sai kiểu là dấu hiệu đọc nhầm
  // trường, mà đoán bừa ở đây thì tiền vào hệ thống sai ngay từ đầu.
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${ten} khong hop le: ${v}`)
  return Math.round(n)
}
