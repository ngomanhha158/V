import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { laNoiBo, soatKho, type SuThatKho } from './kho-anh.ts'

const goc = (o: Partial<SuThatKho> = {}): SuThatKho => ({
  duong: '/data/ticket-photos', coThuMuc: true, ghiDuoc: true,
  devKho: 100, devGoc: 1, laProduction: true, ...o,
})

test('ổ riêng = Volume đã gắn, không chặn gì', () => {
  const r = soatKho(goc())
  assert.equal(r.tinh, 'co_volume')
  assert.equal(r.chan, false)
})

test('CÙNG ổ với container là đĩa tạm — đây là cả điểm của bài kiểm', () => {
  // Thư mục LUÔN tồn tại vì app tự tạo; "có thư mục" không chứng minh gì cả.
  // Chỉ số thiết bị mới phân biệt được volume thật với đĩa tạm.
  const r = soatKho(goc({ devKho: 1, devGoc: 1 }))
  assert.equal(r.tinh, 'dia_tam')
  assert.equal(r.chan, true)
  assert.match(r.cau, /mất sạch ở lần deploy/)
})

test('đĩa tạm ở máy dev thì KHÔNG chặn và không doạ', () => {
  // Ở máy lập trình viên `.anh` nằm ngay trong repo, đó là đúng ý. Báo đỏ ở đó
  // là dạy người ta bỏ qua màu đỏ trước khi họ kịp gặp lần đỏ thật.
  const r = soatKho(goc({ devKho: 1, devGoc: 1, laProduction: false, duong: '.anh' }))
  assert.equal(r.tinh, 'dia_tam')
  assert.equal(r.chan, false)
  assert.doesNotMatch(r.cau, /mất sạch/)
})

test('không có thư mục và không ghi được là hai chuyện khác nhau', () => {
  const a = soatKho(goc({ coThuMuc: false }))
  assert.equal(a.tinh, 'khong_co_thu_muc')
  assert.equal(a.chan, true)
  const b = soatKho(goc({ ghiDuoc: false }))
  assert.equal(b.tinh, 'khong_ghi_duoc')
  assert.match(b.cau, /gửi ảnh lên sẽ báo lỗi/)
})

test('không đọc được ổ đĩa thì NÓI LÀ KHÔNG BIẾT, không đoán', () => {
  // Đoán "chắc là ổn" ở đây là đúng cái kiểu báo cáo sai mà cả hệ thống này
  // đang đi dọn.
  const r = soatKho(goc({ devKho: null }))
  assert.equal(r.tinh, 'khong_ro')
  assert.equal(r.chan, false)
  assert.match(r.cau, /chưa kết luận được/)
})

test('thứ tự xét: không mở được thư mục thì không nói gì về ổ đĩa', () => {
  const r = soatKho(goc({ coThuMuc: false, devKho: 1, devGoc: 1 }))
  assert.equal(r.tinh, 'khong_co_thu_muc')
})

test('địa chỉ nội bộ của Railway và localhost đều là nội bộ', () => {
  assert.equal(laNoiBo('http://postgrest.railway.internal:3000'), true)
  assert.equal(laNoiBo('http://localhost:3000'), true)
  assert.equal(laNoiBo('http://127.0.0.1:3000'), true)
})

test('địa chỉ công khai bị nhận ra', () => {
  assert.equal(laNoiBo('https://postgrest-production-1234.up.railway.app'), false)
  assert.equal(laNoiBo('https://db.vbuilding.vn'), false)
})

test('tên miền chỉ CHỨA chuỗi nội bộ nhưng không kết thúc bằng nó thì KHÔNG phải nội bộ', () => {
  // 'railway.internal.kegian.com' là tên miền của người khác. Dùng includes()
  // thay vì endsWith() ở đây là mở đúng cái cửa mình đang định đóng.
  assert.equal(laNoiBo('https://postgrest.railway.internal.kegian.com'), false)
})

test('thiếu biến hoặc URL hỏng thì trả null, không trả false', () => {
  // null là "không biết", false là "biết và nó công khai". Gộp hai thứ đó thì
  // màn hình báo động đỏ cho một hệ chỉ đang thiếu cấu hình.
  assert.equal(laNoiBo(undefined), null)
  assert.equal(laNoiBo(''), null)
  // Node NHẬN chuỗi này: nó đọc "postgrest.railway.internal:" thành scheme và
  // "3000" thành đường dẫn, hostname rỗng. Không chặn thì một cấu hình chỉ
  // thiếu "http://" bị báo là công khai — báo động sai về đúng chuyện đáng sợ
  // nhất trên màn này.
  assert.equal(laNoiBo('postgrest.railway.internal:3000'), null)
  assert.equal(laNoiBo('ftp://postgrest.railway.internal'), null)
})

// ── Giữ cho màn hình không hứa nhiều hơn cái nó kiểm được ────────────────────

const doc = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('cả màn thật lẫn bản demo đều có hai mục mới', () => {
  for (const f of ['app/bql/go-live/page.tsx', 'app/demo/bql/go-live/page.tsx']) {
    const t = doc(f)
    assert.ok(t.includes('Ảnh nằm trên Volume'), `${f} thiếu mục kiểm Volume`)
    assert.ok(t.includes('App gọi PostgREST qua địa chỉ nội bộ'), `${f} thiếu mục kiểm PostgREST`)
  }
})

test('mục PostgREST KHÔNG hứa là đã kiểm tên miền công khai', () => {
  // App không hỏi Railway được, nên nó chỉ biết mình đang đi đường nào. Một mục
  // xanh hứa nhiều hơn cái nó kiểm được là thứ tệ nhất trên một danh sách quyết
  // định có mở cửa cho cả tòa hay không — nó khiến người đọc BỎ QUA việc phải
  // tự sang Railway nhìn.
  for (const f of ['app/bql/go-live/page.tsx', 'app/demo/bql/go-live/page.tsx']) {
    const t = doc(f)
    const i = t.indexOf('App gọi PostgREST qua địa chỉ nội bộ')
    const khoi = t.slice(i, i + 900)
    assert.match(khoi, /không thấy được nó có tên miền công khai/,
      `${f}: mục PostgREST không nói rõ giới hạn của chính nó`)
  }
})

test('thẻ "ngoài phần mềm" không còn dặn tự kiểm Volume nữa', () => {
  // Việc đã kiểm được thì để lại lời dặn tự kiểm là dạy người đọc lướt qua cả
  // thẻ đó — và trong thẻ đó vẫn còn những việc THẬT SỰ không kiểm được.
  for (const f of ['app/bql/go-live/page.tsx', 'app/demo/bql/go-live/page.tsx']) {
    assert.ok(!doc(f).includes('Volume cho ảnh.'), `${f} còn đoạn văn dặn tự gắn Volume`)
  }
})
