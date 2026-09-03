import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { khoangGio, loiMoi, loiSoGiay, nhanTrangThai, viecPhaiLam } from './khach.ts'

// 2026-09-03T07:00:00Z = 14:00 giờ VN cùng ngày.
const NAY = new Date('2026-09-03T07:00:00Z')

test('khoảng giờ trong cùng một ngày đọc gọn', () => {
  assert.equal(
    khoangGio('2026-09-03T07:00:00Z', '2026-09-03T11:00:00Z', NAY),
    '14:00–18:00 hôm nay',
  )
})

test('cùng ngày nhưng không phải hôm nay thì ghi ngày', () => {
  const s = khoangGio('2026-09-05T07:00:00Z', '2026-09-05T11:00:00Z', NAY)
  assert.equal(s, '14:00–18:00 05/09')
  assert.doesNotMatch(s, /hôm nay/)
})

test('lượt qua đêm phải ghi CẢ HAI ngày', () => {
  // "22:00–06:00" không nói được 06:00 là sáng nào.
  const s = khoangGio('2026-09-03T15:00:00Z', '2026-09-03T23:00:00Z', NAY)
  assert.equal(s, '22:00 03/09 – 06:00 04/09')
})

test('ranh giới ngày tính theo giờ VN, không phải UTC', () => {
  // 2026-09-03T17:00:00Z là 00:00 ngày 04/09 giờ VN — cùng "ngày UTC" với
  // 16:00Z nhưng KHÁC ngày Việt Nam.
  const s = khoangGio('2026-09-03T16:00:00Z', '2026-09-03T17:30:00Z', NAY)
  assert.match(s, /03\/09/)
  assert.match(s, /04\/09/)
})

test('mỗi lý do từ chối kèm một việc phải làm KHÁC NHAU', () => {
  const ds = ['chua_toi_gio', 'het_han', 'thu_hoi', 'da_ra', 'khong_co', 'quen_quet_ra']
  const cau = ds.map((t) => viecPhaiLam(t))
  for (const c of cau) assert.ok(c && c.length > 10)
  // Gộp thành một câu chung là bảo vệ vẫn phải tự nghĩ ra bước tiếp theo.
  assert.equal(new Set(cau).size, ds.length)
})

test('mã đang hiệu lực thì không cần dặn gì thêm', () => {
  assert.equal(viecPhaiLam('dang_hieu_luc'), null)
  assert.equal(viecPhaiLam('trong_toa'), null)
})

test('thu hồi nói thẳng là KHÔNG cho vào', () => {
  assert.match(viecPhaiLam('thu_hoi') ?? '', /KHÔNG cho vào/)
})

test('dưới ngưỡng thì bắt giữ sổ giấy, và nói vì sao', () => {
  const r = loiSoGiay(38.5, 200, 77)
  assert.equal(r.ok, false)
  assert.match(r.than, /VẪN PHẢI giữ sổ giấy/)
  assert.match(r.tieu, /77\/200/)
})

test('trên ngưỡng vẫn dặn giữ một quyển dự phòng', () => {
  const r = loiSoGiay(62, 200, 124)
  assert.equal(r.ok, true)
  // Bỏ sạch sổ giấy thì khách của căn chưa dùng app không được ghi ở đâu.
  assert.match(r.than, /dự phòng/)
})

test('đúng ngưỡng 50% là ĐẠT, không phải chưa đạt', () => {
  assert.equal(loiSoGiay(50, 100, 50).ok, true)
})

test('chưa có căn nào thì không báo là đạt ngưỡng', () => {
  const r = loiSoGiay(0, 0, 0)
  assert.equal(r.ok, false)
})

test('lời mời gửi Zalo có đủ tên, căn và khung giờ', () => {
  const s = loiMoi('Nguyễn Thị Lan', 'P1-12.04', 'Park 1',
    '2026-09-03T07:00:00Z', '2026-09-03T11:00:00Z')
  assert.match(s, /Nguyễn Thị Lan/)
  assert.match(s, /P1-12\.04/)
  assert.match(s, /14:00–18:00/)
})

test('"chưa quét ra" KHÔNG cùng màu với "đang trong tòa"', async () => {
  const { TONE_TRANG_THAI } = await import('./khach.ts')
  // Cùng màu là con số "N khách đang trong tòa" mất nghĩa dần theo tháng, vì
  // mỗi lượt quên quét lúc về ở lại trong đó vĩnh viễn.
  assert.equal(TONE_TRANG_THAI.trong_toa, 'tot')
  assert.notEqual(TONE_TRANG_THAI.quen_quet_ra, TONE_TRANG_THAI.trong_toa)
})

test('nhãn trạng thái lạ hiện nguyên văn', () => {
  assert.equal(nhanTrangThai('trong_toa'), 'Đang trong tòa')
  assert.equal(nhanTrangThai('gi_do_la'), 'gi_do_la')
})
