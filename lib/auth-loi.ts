/**
 * Dịch lỗi của Supabase Auth sang tiếng Việt CÓ HÀNH ĐỘNG KÈM THEO.
 *
 * Trước đây màn đăng nhập ném thẳng `error.message` ra giao diện. Cư dân nhìn
 * thấy "email rate limit exceeded" thì không hiểu gì, và quan trọng hơn là
 * không biết phải làm gì tiếp — nên họ bấm gửi lại, đốt thêm quota, rồi gọi
 * cho ban quản lý. Mỗi thông điệp ở đây phải trả lời được "vậy giờ tôi làm
 * gì": chờ bao lâu, bấm nút nào, hay gọi ai.
 *
 * Khớp theo `code` trước (supabase-js mới có), lùi về khớp chuỗi cho bản cũ
 * và cho những lỗi chưa có mã.
 */

type LoiAuth = { code?: string; message?: string; status?: number }

/**
 * Cùng một mã lỗi, hai màn hình khác nhau thì câu trả lời khác nhau.
 * `invalid_credentials` lúc nhập mã nghĩa là gõ sai dãy số; lúc nhập mật khẩu
 * nghĩa là sai mật khẩu — bảo người ta "kiểm tra lại dãy số trong thư" khi họ
 * đang gõ mật khẩu thì vừa sai vừa làm họ đi tìm một bức thư không tồn tại.
 */
export type BoiCanh = 'otp' | 'matkhau'

/** "you can only request this after 47 seconds" -> 47 */
function giaySauCho(msg: string): number | null {
  const m = msg.match(/after (\d+) seconds?/i)
  return m ? Number(m[1]) : null
}

export function dichLoiAuth(loi: LoiAuth | null | undefined, boiCanh: BoiCanh = 'otp'): string {
  if (!loi) return 'Có lỗi không rõ. Thử lại giúp em.'
  const ma = (loi.code ?? '').toLowerCase()
  const msg = (loi.message ?? '').toLowerCase()

  // Hạn gửi thư của CẢ DỰ ÁN, không phải của riêng người này. Với SMTP mặc
  // định của Supabase là 2 thư/giờ cho toàn hệ thống, nên người thứ ba đăng
  // ký trong một giờ sẽ gặp — phải nói rõ là lỗi hệ thống, không phải lỗi họ.
  if (ma === 'over_email_send_rate_limit' || msg.includes('email rate limit')) {
    return 'Hệ thống đang tạm hết lượt gửi thư. Đây là giới hạn của hệ thống, '
      + 'không phải do bạn nhập sai. Chờ khoảng một giờ rồi thử lại, hoặc đăng '
      + 'nhập bằng mật khẩu nếu ban quản lý đã đặt cho bạn.'
  }

  // Thời gian chờ giữa hai lần gửi cho cùng một địa chỉ.
  const giay = giaySauCho(loi.message ?? '')
  if (giay !== null || ma === 'over_request_rate_limit' || msg.includes('rate limit')) {
    return giay !== null
      ? `Vừa gửi rồi, chờ ${giay} giây nữa mới gửi lại được.`
      : 'Bạn thao tác hơi nhanh. Chờ một chút rồi thử lại.'
  }

  if (ma === 'otp_expired' || msg.includes('expired') || msg.includes('invalid or has expired')) {
    return 'Mã đã hết hạn hoặc đã dùng rồi. Bấm “Gửi lại mã” để nhận mã mới.'
  }

  if (ma === 'invalid_credentials' || msg.includes('invalid login credentials')
      || msg.includes('token is invalid')) {
    return boiCanh === 'matkhau'
      ? 'Sai tài khoản hoặc mật khẩu. Nếu bạn chưa từng đặt mật khẩu thì chuyển '
        + 'sang đăng nhập bằng mã, hoặc nhờ ban quản lý đặt lại.'
      : 'Mã không đúng. Kiểm tra lại dãy số trong thư — mã mới nhất mới dùng được.'
  }

  // Tài khoản có mật khẩu nhưng email chưa được xác nhận: đăng nhập bằng mật
  // khẩu sẽ bị chặn cho tới khi xác nhận, nên phải nói đúng chỗ tắc.
  if (ma === 'email_not_confirmed' || msg.includes('email not confirmed')) {
    return 'Tài khoản chưa xác nhận email nên chưa dùng mật khẩu được. '
      + 'Đăng nhập bằng mã một lần để xác nhận, hoặc báo ban quản lý.'
  }

  if (ma === 'validation_failed' || ma === 'email_address_invalid'
      || msg.includes('invalid email') || msg.includes('unable to validate email')) {
    return 'Địa chỉ email không hợp lệ. Kiểm tra lại chính tả.'
  }

  if (ma === 'signup_disabled' || ma === 'otp_disabled'
      || msg.includes('signups not allowed') || msg.includes('disabled')) {
    return 'Hệ thống đang tạm khóa đăng ký. Liên hệ ban quản lý để được mở.'
  }

  // Lỗi mạng của trình duyệt, không phải lỗi từ máy chủ.
  if (msg.includes('failed to fetch') || msg.includes('network')
      || msg.includes('load failed')) {
    return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  }

  // Không nhận ra thì trả nguyên văn, KHÔNG nuốt: một thông điệp lạ bằng
  // tiếng Anh vẫn hơn "Có lỗi xảy ra" — ít nhất còn chụp màn hình gửi đi được.
  return loi.message ?? 'Có lỗi không rõ. Thử lại giúp em.'
}
