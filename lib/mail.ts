import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Gửi thư đăng nhập.
 *
 * Cấu hình bằng MỘT biến `SMTP_URL` chứ không phải năm biến host/port/user/
 * pass/secure: một chuỗi thì hoặc đúng cả hoặc sai cả, còn năm biến thì có
 * kiểu sai chỉ lộ ra vào lúc gửi thư thật.
 *   smtps://user:mat-khau@smtp.gmail.com:465      (TLS ngay từ đầu — nên dùng)
 *   smtp://user:mat-khau@smtp.example.com:587     (STARTTLS)
 *
 * Chưa đặt SMTP_URL:
 *   • ở máy dev — in mã ra console để còn thử được luồng đăng nhập;
 *   • ở production — ném lỗi. Im lặng nuốt đi thì cư dân ngồi chờ một lá thư
 *     không bao giờ đến, và không có gì trong log nói tại sao.
 */
let vc: Transporter | null = null

function vanChuyen(): Transporter | null {
  const url = process.env.SMTP_URL
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Thiếu SMTP_URL nên không gửi được thư đăng nhập.')
    }
    return null
  }
  // Giữ lại một transporter: nodemailer gộp kết nối, dựng mới mỗi lần gửi là
  // mở một phiên SMTP mới cho từng người bấm nút.
  vc ??= nodemailer.createTransport(url)
  return vc
}

const TU = () => process.env.SMTP_FROM || 'VBuilding <no-reply@localhost>'

export async function guiMaDangNhap(
  toi: string, ma: string, lienKet: string,
): Promise<void> {
  const t = vanChuyen()
  if (!t) {
    console.log(`\n  [dev] Mã đăng nhập cho ${toi}: ${ma}\n        ${lienKet}\n`)
    return
  }

  // Mã ĐỨNG TRƯỚC link. Người mở thư trên điện thoại thấy ngay dãy số mà không
  // phải cuộn; và mã thì gõ được sang thiết bị khác, còn link thì chỉ mở được
  // trên chính máy đang đọc thư.
  await t.sendMail({
    from: TU(),
    to: toi,
    subject: `${ma} là mã đăng nhập VBuilding của bạn`,
    text: [
      `Mã đăng nhập: ${ma}`,
      '',
      'Nhập mã này vào màn hình đăng nhập. Mã sống 10 phút và chỉ dùng được một lần.',
      '',
      `Hoặc bấm thẳng vào đây: ${lienKet}`,
      '',
      'Không phải bạn yêu cầu? Bỏ qua thư này — không ai vào được tài khoản của bạn nếu không có mã.',
    ].join('\n'),
    html: `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#111">
  <p>Mã đăng nhập VBuilding của bạn:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:.18em;margin:16px 0">${ma}</p>
  <p>Mã sống 10 phút và chỉ dùng được một lần.</p>
  <p style="margin:20px 0"><a href="${lienKet}" style="background:#1b5e20;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Đăng nhập ngay</a></p>
  <p style="color:#666;font-size:13px">Không phải bạn yêu cầu? Bỏ qua thư này — không ai vào được tài khoản của bạn nếu không có mã.</p>
</div>`,
  })
}
