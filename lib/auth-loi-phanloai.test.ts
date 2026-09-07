// Chạy: npm run test:js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { phanLoaiLoiHeThong } from './auth-loi.ts'

// Câu lỗi THẬT do PostgREST 12 trả về — chép từ lần dựng lại từng ca trên
// Postgres 16, không phải tự nghĩ ra. Đoán sai hình dạng câu lỗi thì bảng phân
// loại vẫn "chạy" và vẫn trả về đúng một nhánh chung, tức là không làm gì cả.
test('chữ ký JWT sai -> khoá lệch', () => {
  assert.equal(phanLoaiLoiHeThong({ message: 'JWSError JWSInvalidSignature' }), 'he_thong_khoa')
  assert.equal(phanLoaiLoiHeThong({ message: 'JWT expired' }), 'he_thong_khoa')
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
