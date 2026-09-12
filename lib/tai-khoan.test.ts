import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { toE164VN } from './phone.ts'
import {
  MAT_KHAU_TOI_THIEU, MA_DOI_LIEN_LAC, MA_DOI_MAT_KHAU,
  cauTaiKhoan, chuanHoaLienLac, loiDoiLienLac, loiDoiMatKhau,
} from './tai-khoan.ts'

const doc = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('độ dài mật khẩu tối thiểu KHỚP hàm SQL', () => {
  // Hai con số, một luật. Lệch nhau thì màn hình nói "ít nhất 8" rồi máy chủ
  // từ chối ở 10 — người dùng gõ lại mãi mà không hiểu vì sao.
  const sql = doc('railway/03_auth.sql')
  const m = sql.match(/function public\.auth_mat_khau_toi_thieu\(\)[\s\S]{0,200}?select (\d+)/)
  assert.ok(m, 'không tìm thấy auth_mat_khau_toi_thieu() trong SQL')
  assert.equal(Number(m![1]), MAT_KHAU_TOI_THIEU)
})

test('mọi mã hàm SQL trả về đều có câu tiếng Việt', () => {
  // Đây là bài giữ cho một nhánh return mới trong SQL không lặng lẽ rơi vào
  // câu "không rõ". Đọc thẳng các chuỗi return trong ba hàm tự phục vụ.
  const sql = doc('railway/03_auth.sql')
  const khoi = sql.slice(sql.indexOf('TỰ PHỤC VỤ'))
  const ma = new Set([...khoi.matchAll(/return '([a-z_]+)';/g)].map((m) => m[1]))
  assert.ok(ma.size >= 6, `chỉ đọc được ${ma.size} mã — bài kiểm gần như rỗng`)
  for (const m of ma) {
    if (m === 'ok') continue
    assert.doesNotMatch(
      cauTaiKhoan(m), /không rõ/,
      `mã "${m}" có trong SQL nhưng chưa có câu tiếng Việt ở lib/tai-khoan.ts`)
  }
})

test('danh sách mã trong TS phủ đúng những mã SQL trả về', () => {
  const sql = doc('railway/03_auth.sql')
  const khoi = sql.slice(sql.indexOf('TỰ PHỤC VỤ'))
  const ma = [...new Set([...khoi.matchAll(/return '([a-z_]+)';/g)].map((m) => m[1]))]
  const biet = new Set<string>([...MA_DOI_MAT_KHAU, ...MA_DOI_LIEN_LAC])
  for (const m of ma) assert.ok(biet.has(m), `mã "${m}" chưa khai trong TS`)
})

test('mã lạ nói thẳng ra mã, không nuốt thành câu chung chung', () => {
  // "Có lỗi xảy ra" là thông điệp làm người đi sửa mất nửa buổi tìm nhầm chỗ.
  const c = cauTaiKhoan('mot_ma_chua_tung_co')
  assert.match(c, /mot_ma_chua_tung_co/)
})

test('kiểm mật khẩu ở client: ngắn, lệch nhau, và hợp lệ', () => {
  assert.match(loiDoiMatKhau('ngan', 'ngan')!, new RegExp(String(MAT_KHAU_TOI_THIEU)))
  assert.equal(loiDoiMatKhau('matkhaudai', 'matkhaukhac'), 'Hai ô mật khẩu mới chưa giống nhau.')
  assert.equal(loiDoiMatKhau('matkhaudai', 'matkhaudai'), null)
})

test('kiểm liên lạc ở client: không cho xoá hết cả hai đường đăng nhập', () => {
  assert.match(loiDoiLienLac('Tên', '', '')!, /ít nhất một/)
  // Còn một trong hai thì cho qua — bỏ email mà giữ số điện thoại là hợp lệ.
  assert.equal(loiDoiLienLac('Tên', '', '0900000111'), null)
  assert.equal(loiDoiLienLac('Tên', 'a@b.vn', ''), null)
})

test('tên trống bị chặn trước khi tốn một vòng mạng', () => {
  assert.match(loiDoiLienLac('   ', 'a@b.vn', '')!, /Họ tên/)
})

test('email sai dạng bị chặn, nhưng luật kiểm nhẹ tay', () => {
  assert.match(loiDoiLienLac('Tên', 'khong-phai-email', '')!, /dạng/)
  // Những địa chỉ hợp lệ mà hiếm gặp vẫn phải qua: chốt thật là thư có tới hay
  // không, một biểu thức chặt tay chỉ tạo ra người dùng không đăng ký được.
  for (const e of ['a+bql@vbuilding.test', "o'brien@toa.vn", 'x_y.z@a.co.uk']) {
    assert.equal(loiDoiLienLac('Tên', e, ''), null, `chặn oan địa chỉ hợp lệ: ${e}`)
  }
})

test('chuẩn hoá dùng CHUNG luật với màn tạo tài khoản của ban quản lý', () => {
  // Hai luật cho cùng một câu hỏi thì sẽ lệch, và lệch nghĩa là địa chỉ tạo
  // được ở màn kia lại bị màn này từ chối. Chốt bằng cách so thẳng kết quả.
  const r = chuanHoaLienLac('  Chi.A@VBuilding.TEST ', '0900 000 111')
  assert.equal(r.email, 'chi.a@vbuilding.test', 'email phải về chữ thường và bỏ khoảng trắng')
  assert.equal(r.phone, toE164VN('0900 000 111'), 'số điện thoại phải đi qua toE164VN')
  assert.deepEqual(chuanHoaLienLac('', ''), { email: null, phone: null })
})

test('số điện thoại sai dạng bị chặn ở client', () => {
  assert.match(loiDoiLienLac('Tên', '', 'abc')!, /điện thoại/)
})
