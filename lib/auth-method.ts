/**
 * Cách đăng nhập hiện hành.
 *
 * Tạm dùng email OTP vì chưa có nhà cung cấp SMS. Đây là biến môi trường chứ
 * không phải hằng số trong code: lúc cắm được SMS thì đổi một biến rồi deploy
 * lại, không phải sửa code và không phải review lại màn đăng nhập.
 *
 * NEXT_PUBLIC_ vì màn đăng nhập chạy ở trình duyệt. Không có gì bí mật ở đây —
 * chỉ là "app này đang hỏi email hay hỏi số điện thoại".
 */
export type CachDangNhap = 'email' | 'sms'

export function cachDangNhap(): CachDangNhap {
  return process.env.NEXT_PUBLIC_VBUILDING_AUTH === 'sms' ? 'sms' : 'email'
}
