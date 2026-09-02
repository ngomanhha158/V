/**
 * Chuẩn hóa số điện thoại Việt Nam về E.164 (+84…) trước khi lưu vào auth.users.
 *
 * Người dùng gõ số điện thoại theo đủ kiểu: có dấu cách, có dấu chấm, có ngoặc
 * đơn mã vùng, có +84, có 84 mà thiếu dấu cộng, có số 0 đầu. Ném thẳng chuỗi
 * thô vào database là dính ràng buộc unique theo đúng chuỗi đã gõ: cùng một
 * người, gõ hai kiểu, thành hai tài khoản. Chuẩn hóa ở một chỗ duy nhất thì
 * không có chỗ nào để lệch.
 *
 * Trả về null nếu không ra được số hợp lệ, để nơi gọi tự quyết cách báo lỗi.
 */
export function toE164VN(input: string): string | null {
  // Bỏ mọi thứ không phải chữ số, giữ lại dấu + nếu nó đứng đầu.
  const raw = input.trim()
  const co_cong = raw.startsWith('+')
  const so = raw.replace(/\D/g, '')
  if (so.length === 0) return null

  let than: string
  if (co_cong || so.startsWith('84')) {
    // +84912345678 hoặc 84912345678
    than = so.startsWith('84') ? so.slice(2) : so
    // +84 mà người ta vẫn giữ số 0: +84 0912… — bỏ số 0 thừa.
    if (than.startsWith('0')) than = than.slice(1)
  } else if (so.startsWith('0')) {
    than = so.slice(1)
  } else {
    // Gõ trần không có 0 đầu: 912345678
    than = so
  }

  // Đầu số di động VN sau khi bỏ 0/84 dài đúng 9 chữ số và bắt đầu bằng 3,5,7,8,9.
  // Số cố định (24, 28…) không nhận tin nhắn nên cũng không cho qua — chặn ở
  // đây tốt hơn là gửi tin nhắn vào hư không rồi bị tính tiền.
  if (!/^[35789]\d{8}$/.test(than)) return null
  return '+84' + than
}

/** Email chuẩn hóa: bỏ khoảng trắng, hạ chữ thường. Trả null nếu không hợp lệ. */
export function normalizeEmail(input: string): string | null {
  const e = input.trim().toLowerCase()
  // Không cố viết regex email cho đủ RFC — vô ích. Chỉ chặn cái sai rõ ràng,
  // còn đúng hay không thì hộp thư trả lời: không nhận được mã là biết.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return null
  return e
}
