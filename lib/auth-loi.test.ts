import { test } from 'node:test'
import assert from 'node:assert/strict'
import { doiCho, loiDangNhap, type TrangThai } from './auth-loi.ts'

// Mọi trạng thái mà railway/03_auth.sql và lib/db/dang-nhap.ts có thể trả về.
// Danh sách này là bản hợp đồng giữa hai bên; thêm một bên mà quên bên kia là
// người dùng nhận đúng cái chuỗi mã máy.
const HET: TrangThai[] = [
  'cho', 'sai', 'het_han', 'qua_nhieu', 'sai_mat_khau', 'chua_dat_mat_khau',
  'khong_gui_duoc', 'chua_co_sms', 'mang', 'la',
]

test('mọi trạng thái đều có câu tiếng Việt riêng, không ai rơi vào câu chung', () => {
  const chung = loiDangNhap('la')
  for (const tt of HET) {
    const c = loiDangNhap(tt, 47)
    assert.ok(c.length > 20, `${tt} quá ngắn: ${c}`)
    assert.doesNotMatch(c, /[a-z]_[a-z]/, `${tt} lộ mã máy ra giao diện: ${c}`)
    if (tt !== 'la') assert.notEqual(c, chung, `${tt} rơi vào câu chung`)
  }
})

test('trạng thái lạ không làm trắng màn, rơi về câu chung', () => {
  assert.equal(loiDangNhap('mot_thu_gi_do_moi'), loiDangNhap('la'))
  assert.equal(loiDangNhap(''), loiDangNhap('la'))
})

test('bị chặn thì nói ra còn bao lâu, không bắt đoán', () => {
  assert.match(loiDangNhap('cho', 47), /47 giây/)
  assert.match(loiDangNhap('cho', 300), /5 phút/)
})

test('thời gian chờ làm tròn LÊN', () => {
  // Nói "2 phút" cho 121 giây rồi để người ta bấm ở giây thứ 120 và lại bị
  // chặn là hỏng đúng lúc họ đã chịu khó chờ.
  assert.equal(doiCho(121), '3 phút')
  assert.equal(doiCho(0.2), '1 giây')
  assert.equal(doiCho(90), '90 giây')
  assert.equal(doiCho(91), '2 phút')
})

test('gõ sai mã và sai mật khẩu phải khuyên khác nhau', () => {
  // Cùng là "sai" nhưng bảo người đang gõ mật khẩu đi "kiểm tra lại dãy số
  // trong thư" là vừa sai vừa bắt họ đi tìm một bức thư không tồn tại.
  assert.notEqual(loiDangNhap('sai'), loiDangNhap('sai_mat_khau'))
  assert.match(loiDangNhap('sai'), /thư/)
  assert.match(loiDangNhap('sai_mat_khau'), /mật khẩu/)
})

test('bị khóa vì dò thì chỉ ra lối khác, không để người ta kẹt', () => {
  assert.match(loiDangNhap('qua_nhieu'), /mật khẩu/)
  assert.match(loiDangNhap('khong_gui_duoc'), /mật khẩu/)
  assert.match(loiDangNhap('chua_co_sms'), /mật khẩu|email/)
})

test('lỗi hệ thống nói rõ là lỗi hệ thống', () => {
  // Người ta mặc định cho là mình gõ sai. Không nói ra thì họ gõ lại mãi.
  assert.match(loiDangNhap('khong_gui_duoc'), /không phải do bạn/)
})
