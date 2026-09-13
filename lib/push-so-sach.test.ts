import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lechDanhDau, soatGhiSo, type BuocGhiSo } from './push-so-sach.ts'

const loi = { message: 'could not connect to server' }

const daDay = (l: BuocGhiSo['loi']): BuocGhiSo => ({
  ten: 'thong_bao_da_day', loi: l, chan: true, hauQua: 'đẩy lại 96 lần trong 24 giờ',
})
const ghiNhan = (l: BuocGhiSo['loi']): BuocGhiSo => ({
  ten: 'push_ghi_nhan_day', loi: l, chan: false, hauQua: 'một màn thiếu một tín hiệu',
})

test('ghi sổ trót lọt thì không ném, không cảnh báo', () => {
  assert.deepEqual(soatGhiSo([daDay(null), ghiNhan(undefined)]),
    { nem: null, canhBao: [] })
})

test('bước CHẶN hỏng thì ném, kèm tên hàm và hậu quả', () => {
  const r = soatGhiSo([daDay(loi)])
  assert.ok(r.nem, 'không ném khi thong_bao_da_day hỏng')
  assert.match(r.nem, /thong_bao_da_day\(\)/)
  assert.match(r.nem, /could not connect/, 'nuốt mất nguyên nhân thật')
  assert.match(r.nem, /96 lần/, 'không nói ra hậu quả')
  assert.deepEqual(r.canhBao, [])
})

test('bước KHÔNG chặn hỏng thì cảnh báo chứ không làm job đỏ', () => {
  // Cho tất cả thành đỏ thì job đỏ vì một chuyện hình thức, và người trực ban
  // học cách lờ màu đỏ — đúng thứ phải tránh nhất trên một bảng job.
  const r = soatGhiSo([ghiNhan(loi)])
  assert.equal(r.nem, null, 'làm job đỏ vì một tín hiệu giao diện')
  assert.equal(r.canhBao.length, 1)
  assert.match(r.canhBao[0], /push_ghi_nhan_day\(\)/)
})

test('nhiều bước chặn cùng hỏng thì nói ra CẢ HAI', () => {
  // Ném cái đầu rồi bỏ cái sau là giấu mất một nửa sự việc, và người đọc log
  // sửa xong cái đầu sẽ tưởng đã xong.
  const r = soatGhiSo([
    daDay(loi),
    { ten: 'push_go_endpoint_chet', loi: { message: 'timeout' }, chan: true,
      hauQua: 'endpoint chết nằm lại' },
  ])
  assert.match(r.nem!, /thong_bao_da_day/)
  assert.match(r.nem!, /push_go_endpoint_chet/)
  assert.match(r.nem!, /timeout/)
})

test('đánh dấu đủ thì không kêu', () => {
  assert.equal(lechDanhDau(40, 40), null)
  assert.equal(lechDanhDau(0, 0), null)
})

test('đánh dấu hụt thì kêu, và nói ra nghi phạm đúng', () => {
  // Đếm hụt KHÔNG làm thông báo lặp lại: thong_bao_da_day() chỉ đếm dòng nó
  // thật sự đổi, nên hụt nghĩa là một lần chạy khác đã đánh dấu hộ — tức là
  // hai lần chạy chồng nhau, tức là có người đã nhận hai lần.
  const c = lechDanhDau(40, 31)
  assert.ok(c)
  assert.match(c, /40/)
  assert.match(c, /31/)
  assert.match(c, /chồng lên nhau/)
})

test('đánh dấu nhiều hơn số đẩy thì im, không vỡ', () => {
  assert.equal(lechDanhDau(3, 5), null)
})

// ── Giữ cho ba lời gọi ghi sổ không quay lại kiểu nuốt lỗi ──────────────────

const doc = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('job đẩy thông báo không gọi hàm ghi sổ nào mà bỏ kết quả đi', () => {
  // Kiểu cũ là `await db.rpc('push_go_endpoint_chet', …)` đứng một mình: không
  // gán cho gì cả, nên không có chỗ nào để đọc `error`. Cấm đúng dạng đó.
  const src = doc('lib/push.ts')
  const re = /^\s*await db\.rpc\('(thong_bao_da_day|push_go_endpoint_chet|push_ghi_nhan_day)'/gm
  const pham = [...src.matchAll(re)].map((m) => m[1])
  assert.deepEqual(pham, [], `gọi rồi bỏ kết quả: ${pham.join(', ')}`)
})

test('job đẩy thông báo có ném khi sổ sách hỏng', () => {
  const src = doc('lib/push.ts')
  assert.match(src, /soatGhiSo\(/, 'không soát sổ sách')
  assert.match(src, /if \(sach\.nem\) throw new Error\(sach\.nem\)/,
    'soát xong rồi không ném — job vẫn xanh như cũ')
})
