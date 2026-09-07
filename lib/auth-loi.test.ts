import { test } from 'node:test'
import assert from 'node:assert/strict'
import { doiCho, goYNguoiSua, loiDangNhap, type TrangThai } from './auth-loi.ts'

// Mọi trạng thái mà railway/03_auth.sql và lib/db/dang-nhap.ts có thể trả về.
// Danh sách này là bản hợp đồng giữa hai bên; thêm một bên mà quên bên kia là
// người dùng nhận đúng cái chuỗi mã máy.
const HET: TrangThai[] = [
  'cho', 'sai', 'het_han', 'qua_nhieu', 'sai_mat_khau', 'chua_dat_mat_khau',
  'khong_gui_duoc', 'chua_co_sms', 'mang', 'he_thong', 'la',
  'he_thong_khoa', 'he_thong_thieu_lop', 'he_thong_mat_ket_noi',
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

test('sự cố hệ thống nói rõ là KHÔNG phải lỗi người dùng, và đừng thử lại', () => {
  const c = loiDangNhap('he_thong')
  // Ba việc câu này phải làm: phủ nhận lỗi người dùng, nói thử lại vô ích, và
  // chỉ đúng người sửa được. Thiếu vế thứ hai thì họ bấm lại hai chục lần.
  assert.match(c, /không phải bạn/)
  assert.match(c, /thử lại cũng sẽ như vậy/)
  assert.match(c, /ban quản lý/)
  // Và phải KHÁC câu sai mã / sai mật khẩu — gộp vào đó là dắt người dùng đi
  // sửa mật khẩu trong lúc máy chủ mới là thứ hỏng.
  assert.notEqual(c, loiDangNhap('sai'))
  assert.notEqual(c, loiDangNhap('sai_mat_khau'))
  assert.notEqual(c, loiDangNhap('la'))
})


test('ba nhánh sự cố hệ thống nói ba chuyện KHÁC NHAU với cư dân', () => {
  // Gộp lại một câu là quay về đúng chỗ cũ: một triệu chứng cho ba nguyên nhân.
  const ba = ['he_thong_khoa', 'he_thong_thieu_lop', 'he_thong_mat_ket_noi']
    .map((t) => loiDangNhap(t))
  assert.equal(new Set(ba).size, 3)
  // Và không câu nào đổ lỗi cho người đang đứng đó.
  for (const c of ba) assert.doesNotMatch(c, /bạn nhập sai|kiểm tra lại mật khẩu/)
})

test('gợi ý cho người sửa CHỈ hiện ở ba nhánh sự cố, và có nói tên thứ phải sửa', () => {
  // Đây là chỗ ĐƯỢC phép có tên biến — người đọc nó là người đi sửa. Bài test
  // "không lộ mã máy" ở trên gác câu của cư dân, không gác câu này.
  assert.match(goYNguoiSua('he_thong_khoa') ?? '', /AUTH_JWT_SECRET/)
  assert.match(goYNguoiSua('he_thong_thieu_lop') ?? '', /03_auth\.sql|reload schema/)
  assert.match(goYNguoiSua('he_thong_mat_ket_noi') ?? '', /POSTGREST_URL/)

  // Sai mật khẩu thì KHÔNG có gì để gợi ý cho ai sửa. Hiện một khối kỹ thuật ở
  // đó là dọa người dùng bằng một sự cố không tồn tại.
  for (const t of ['sai_mat_khau', 'sai', 'het_han', 'cho', 'la', 'he_thong']) {
    assert.equal(goYNguoiSua(t), null, t)
  }
})
