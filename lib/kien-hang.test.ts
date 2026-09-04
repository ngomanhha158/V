import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { HAN_NGAY, LOAI_KIEN, NHAN_LOAI, loiKienCuaToi, loiTuoiKien, nhanLoai, nhanLoaiHoa } from './kien-hang.ts'

test('nhãn loại kiện KHỚP hàm nhan_loai_kien trong SQL', () => {
  // Thông báo sinh ở SQL, màn hình vẽ ở TypeScript. Lệch một chữ thì cư dân
  // đọc thông báo thấy "thùng lớn" rồi ra quầy hỏi một thứ không có trong sổ.
  const sql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
  const doan = sql.slice(sql.indexOf('function nhan_loai_kien'))
  for (const l of LOAI_KIEN) {
    const m = doan.match(new RegExp(`when '${l}'\\s*then '([^']+)'`))
    assert.ok(m, `SQL thiếu nhãn cho ${l}`)
    assert.equal(m![1], NHAN_LOAI[l], `nhãn "${l}" lệch giữa SQL và TypeScript`)
  }
})

test('hạn ngày khớp kien_han_ngay() trong SQL', () => {
  const sql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
  const m = sql.match(/function kien_han_ngay\(\)[\s\S]{0,200}?select (\d+)/)
  assert.ok(m)
  assert.equal(Number(m![1]), HAN_NGAY)
})

test('hàng lạnh gấp ngay từ ngày đầu', () => {
  // Ba ngày với một thùng carton là bình thường; với hàng lạnh thì một ngày đã
  // hỏng. Dùng chung một ngưỡng là quầy giữ hộ một túi thịt tới lúc nó chảy.
  const r = loiTuoiKien(1, 'hang_lanh')
  assert.equal(r.gap, true)
  assert.match(r.loi, /tủ mát/)
  assert.equal(loiTuoiKien(1, 'kien_nho').gap, false)
})

test('quá hạn thì nói rõ đã vượt bao nhiêu', () => {
  const r = loiTuoiKien(5, 'kien_nho')
  assert.equal(r.gap, true)
  assert.match(r.loi, /5 ngày/)
  assert.match(r.loi, /hạn 3 ngày/)
})

test('nhận hôm nay không đọc thành "0 ngày"', () => {
  assert.equal(loiTuoiKien(0, 'kien_nho').loi, 'Nhận hôm nay.')
})

test('còn trong hạn thì nói ra ngưỡng để người đọc tự so', () => {
  const r = loiTuoiKien(2, 'kien_nho')
  assert.equal(r.gap, false)
  assert.match(r.loi, /hạn 3 ngày/)
})

test('kiện đã lấy nói RÕ AI lấy', () => {
  const s = loiKienCuaToi({ trang_thai: 'da_lay', ten_nguoi_lay: 'Nguyễn Văn Hải', ly_do_huy: null, vi_tri: null })
  assert.match(s, /Nguyễn Văn Hải/)
})

test('đã lấy mà không có tên là chuyện phải báo, không phải im lặng', () => {
  const s = loiKienCuaToi({ trang_thai: 'da_lay', ten_nguoi_lay: '  ', ly_do_huy: null, vi_tri: null })
  assert.match(s, /báo ban quản lý/)
})

test('kiện đã hủy nói lý do; không có lý do thì nói là không có', () => {
  assert.match(loiKienCuaToi({ trang_thai: 'da_huy', ten_nguoi_lay: null, ly_do_huy: 'Sai địa chỉ', vi_tri: null }), /Sai địa chỉ/)
  assert.match(loiKienCuaToi({ trang_thai: 'da_huy', ten_nguoi_lay: null, ly_do_huy: null, vi_tri: null }), /không ghi lý do/)
})

test('kiện đang giữ nói CHỖ ĐỂ khi có', () => {
  assert.match(loiKienCuaToi({ trang_thai: 'dang_giu', ten_nguoi_lay: null, ly_do_huy: null, vi_tri: 'Tủ A3' }), /Tủ A3/)
  assert.equal(loiKienCuaToi({ trang_thai: 'dang_giu', ten_nguoi_lay: null, ly_do_huy: null, vi_tri: null }), 'Quầy đang giữ.')
})

test('nhãn hoa đầu câu, và giá trị lạ hiện nguyên văn', () => {
  assert.equal(nhanLoaiHoa('thung_lon'), 'Thùng lớn')
  assert.equal(nhanLoai('gi_do'), 'gi_do')
})
