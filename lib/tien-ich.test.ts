import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { NHAN_NGAY, gio, loiConSuat, loiOKhongDat, nhanSuat, tinhNgay, type OSuat } from './tien-ich.ts'

const o = (p: Partial<OSuat>): OSuat => ({
  suat_id: 's', thu_tu: 1, bat_dau: '18:00:00', ket_thuc: '21:00:00',
  con_trong: true, cua_toi: false, dong_cua: false, ly_do: null, ...p,
})

test('giờ bỏ phần giây Postgres trả về', () => {
  assert.equal(gio('18:00:00'), '18:00')
  assert.equal(nhanSuat('08:00:00', '11:00:00'), '08:00–11:00')
})

test('ngày đóng KHÁC ngày kín chỗ', () => {
  // Hai điều rất khác nhau: "hết người khác đặt rồi" và "hôm nay không mở cửa".
  assert.equal(tinhNgay([o({ dong_cua: true, con_trong: false })]), 'dong')
  assert.equal(tinhNgay([o({ con_trong: false })]), 'kin')
  assert.notEqual(NHAN_NGAY.dong, NHAN_NGAY.kin)
})

test('ngày không có suất nào là đóng, không phải kín', () => {
  assert.equal(tinhNgay([]), 'dong')
})

test('còn đúng một suất thì cảnh báo, không xanh như còn nhiều', () => {
  assert.equal(tinhNgay([o({ con_trong: false }), o({ con_trong: true })]), 'con_it')
  assert.equal(tinhNgay([o({}), o({})]), 'trong')
})

test('hạn mức viết bằng lời, KHÔNG viết "1/2"', () => {
  const r = loiConSuat(1, 2, 1)
  assert.equal(r.ok, true)
  // "1/2" thì người đọc không biết 1 là đã dùng hay còn lại.
  assert.doesNotMatch(r.loi, /\d\s*\/\s*\d/)
  assert.match(r.loi, /còn 1 suất/)
  assert.match(r.loi, /đã đặt 1 trên 2/)
})

test('hết suất thì nói luôn BAO GIỜ đặt lại được', () => {
  const r = loiConSuat(2, 2, 0)
  assert.equal(r.ok, false)
  assert.match(r.loi, /thứ Hai/)
  // Và nói cả lối thoát ngay bây giờ.
  assert.match(r.loi, /hủy một suất/)
})

test('mỗi lý do không bấm được là một câu khác nhau', () => {
  const cau = [
    loiOKhongDat(o({ dong_cua: true, ly_do: 'Vệ sinh' }), true, false),
    loiOKhongDat(o({ cua_toi: true, con_trong: false }), true, false),
    loiOKhongDat(o({ con_trong: false }), true, false),
    loiOKhongDat(o({}), true, true),
    loiOKhongDat(o({}), false, false),
  ]
  for (const c of cau) assert.ok(c && c.length > 5)
  assert.equal(new Set(cau).size, cau.length)
})

test('ô đóng nói luôn lý do BQL ghi', () => {
  assert.match(loiOKhongDat(o({ dong_cua: true, ly_do: 'Vệ sinh hồ' }), true, false) ?? '', /Vệ sinh hồ/)
  // Không có lý do thì nói là không có, đừng để câu cụt.
  assert.match(loiOKhongDat(o({ dong_cua: true, ly_do: null }), true, false) ?? '', /không ghi lý do/)
})

test('ô đặt được thì không có câu nào', () => {
  assert.equal(loiOKhongDat(o({}), true, false), null)
})

test('ô của chính mình không bị nhầm thành "người khác đặt trước"', () => {
  const c = loiOKhongDat(o({ cua_toi: true, con_trong: false }), true, false)
  assert.match(c ?? '', /Căn bạn/)
  assert.doesNotMatch(c ?? '', /căn khác/)
})
