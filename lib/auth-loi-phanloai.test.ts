// Chạy: npm run test:js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  docTraLoiDangNhap, goYNguoiSua, loiDangNhap, phanLoaiLoiHeThong,
} from './auth-loi.ts'

// Câu lỗi THẬT do PostgREST 12 trả về — chép từ lần dựng lại từng ca trên
// Postgres 16, không phải tự nghĩ ra. Đoán sai hình dạng câu lỗi thì bảng phân
// loại vẫn "chạy" và vẫn trả về đúng một nhánh chung, tức là không làm gì cả.
test('chữ ký JWT sai -> khoá lệch', () => {
  assert.equal(phanLoaiLoiHeThong({ message: 'JWSError JWSInvalidSignature' }), 'he_thong_khoa')
  assert.equal(phanLoaiLoiHeThong({ message: 'JWT expired' }), 'he_thong_khoa')
})

// GẶP THẬT TRÊN PRODUCTION. Người dùng dán lại AUTH_JWT_SECRET ba lượt vì màn
// hình nói "hai khoá lệch nhau", trong khi PostgREST đang không có khoá nào —
// một câu chứa chữ "JWT" bị mẫu chung nuốt mất. Hai ca này phải nằm cùng file
// test và cạnh nhau: đó là chỗ duy nhất nhìn ra được rằng chúng khác nhau.
test('PostgREST không có khoá -> thiếu khoá, KHÔNG phải khoá lệch', () => {
  const e = { code: 'PGRST300', message: 'Server lacks JWT secret' }
  assert.equal(phanLoaiLoiHeThong(e), 'he_thong_thieu_khoa')
  // Không có code cũng phải ra đúng nhánh: chỉ dựa vào code là hỏng ngay khi
  // PostgREST đổi số hiệu ở bản sau.
  assert.equal(phanLoaiLoiHeThong({ message: 'Server lacks JWT secret' }), 'he_thong_thieu_khoa')
})

test('gợi ý của thiếu khoá chỉ đúng service, và chặn vòng dán lại vô ích', () => {
  const g = goYNguoiSua('he_thong_thieu_khoa') ?? ''
  assert.match(g, /PGRST_JWT_SECRET/)
  assert.match(g, /PostgREST/)
  // Câu chốt: nói thẳng rằng dán lại AUTH_JWT_SECRET không cứu được gì. Thiếu
  // câu này thì người đọc thấy hai tên biến rồi lại đi sửa cái quen tay.
  assert.match(g, /không giải quyết được gì/)
  // Và hai nhánh phải nói hai chuyện khác nhau — trùng câu là quay lại lỗi cũ.
  assert.notEqual(g, goYNguoiSua('he_thong_khoa'))
})

test('cư dân đọc được câu của thiếu khoá, không phải chuỗi mã máy', () => {
  const c = loiDangNhap('he_thong_thieu_khoa')
  assert.ok(c.length > 40, c)
  assert.doesNotMatch(c, /PGRST|JWT|SECRET/i)
})

test('không thấy hàm -> thiếu lớp đăng nhập (gồm cả ca quên notify pgrst)', () => {
  assert.equal(phanLoaiLoiHeThong({
    code: 'PGRST202',
    message: 'Could not find the function public.auth_kiem_mat_khau(p_danh_tinh, p_mat_khau) in the schema cache',
  }), 'he_thong_thieu_lop')
  assert.equal(phanLoaiLoiHeThong({ message: 'function auth_kiem_ma does not exist' }), 'he_thong_thieu_lop')
})

test('không nối được -> mất kết nối', () => {
  assert.equal(phanLoaiLoiHeThong({ message: 'TypeError: fetch failed' }), 'he_thong_mat_ket_noi')
  assert.equal(phanLoaiLoiHeThong({ message: 'connect ECONNREFUSED 10.0.0.1:3000' }), 'he_thong_mat_ket_noi')
})

test('lỗi lạ rơi về nhánh chung, không đoán bừa', () => {
  // Đoán bừa còn tệ hơn không đoán: nó chỉ người đi sửa sang một hướng sai, và
  // họ tin vì màn hình nói chắc chắn.
  assert.equal(phanLoaiLoiHeThong({ code: '42501', message: 'permission denied for table profiles' }), 'he_thong')
  assert.equal(phanLoaiLoiHeThong(null), 'he_thong')
  assert.equal(phanLoaiLoiHeThong({}), 'he_thong')
})

test('thứ tự xét: chữ ký sai được nhận trước, dù câu lỗi có kèm chữ khác', () => {
  // PostgREST có lúc trả câu dài kèm cả hai manh mối. Chữ ký sai phải thắng:
  // khoá lệch thì mọi hàm đều "không thấy", nên sửa tên hàm là sửa nhầm chỗ.
  assert.equal(
    phanLoaiLoiHeThong({ message: 'JWSError JWSInvalidSignature', details: 'schema cache' }),
    'he_thong_khoa')
})

// ── Đọc câu trả lời của endpoint, kể cả khi nó không phải câu trả lời ──
// Ca này sinh ra từ một lần dò thật: người dựng hệ thống lọc log theo đúng chỗ
// được chỉ và thấy TRỐNG TRƠN, rồi kết luận "request chưa tới được app". Thật
// ra route đã ném lỗi trước khi chạm database — không có gì để mà ghi log.

test('route ném lỗi (500, thân không phải JSON) -> lỗi hệ thống, KHÔNG phải mạng', () => {
  const r = docTraLoiDangNhap(500, null)
  assert.equal(r.tt, 'he_thong')
  // Đây là điểm chốt: bảo người dùng đi kiểm tra wifi trong lúc máy chủ sập là
  // đẩy họ đi sửa thứ không hỏng, và họ tin vì màn hình nói chắc chắn.
  assert.notEqual(r.tt, 'mang')
  assert.doesNotMatch(r.cau ?? '', /mạng|wifi/i)
  // Mã HTTP phải ra tới màn quản trị: khi app chưa kịp ghi log thì đó là manh
  // mối duy nhất còn lại.
  assert.equal(r.maLoi, 'HTTP 500')
  assert.match(r.goY ?? '', /KHÔNG có dòng log/)
})

test('câu trả lời thật đi qua nguyên vẹn, không bị bọc lại', () => {
  const that = { tt: 'sai_mat_khau', cau: 'Sai mật khẩu', goY: null }
  assert.deepEqual(docTraLoiDangNhap(200, that), that)
  // 401 vẫn là câu trả lời hợp lệ nếu có `tt` — mã HTTP không phải thứ quyết định.
  assert.equal(docTraLoiDangNhap(401, { tt: 'qua_nhieu', giay: 30 }).tt, 'qua_nhieu')
})

test('thân JSON nhưng không có tt -> vẫn là lỗi hệ thống', () => {
  // Trang lỗi của Next đôi khi VẪN là JSON hợp lệ. Parse được không có nghĩa
  // là hiểu được.
  assert.equal(docTraLoiDangNhap(500, { error: 'Internal Server Error' }).tt, 'he_thong')
})
