import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canhBaoKhu, khuDaChon, nenHienHopChon, soLieuKhu, type Khu } from './khu.ts'

const k = (id: string, o: Partial<Khu> = {}): Khu => ({
  id, name: id.toUpperCase(), so_toa: 1, so_can: 100, vai_tro: 'bql_manager', ...o,
})
const DS = [k('a'), k('b'), k('c')]

test('không quản lý khu nào thì không có khu đang xem', () => {
  assert.equal(khuDaChon([], null), null)
  assert.equal(khuDaChon([], 'a'), null)
})

test('chưa chọn bao giờ thì lấy khu đầu danh sách', () => {
  assert.equal(khuDaChon(DS, null)?.id, 'a')
  assert.equal(khuDaChon(DS, undefined)?.id, 'a')
  // Cookie rỗng khác cookie không có, nhưng câu trả lời phải giống nhau —
  // '' không được lọt vào find() rồi khớp với một id rỗng nào đó.
  assert.equal(khuDaChon(DS, '')?.id, 'a')
})

test('đã chọn thì giữ đúng khu đó, không phải khu đầu', () => {
  assert.equal(khuDaChon(DS, 'c')?.id, 'c')
})

test('cookie bịa rơi về khu đầu chứ không làm màn hình trống', () => {
  const r = khuDaChon(DS, 'khong-co-that')
  assert.notEqual(r, null)
  assert.equal(r?.id, 'a')
})

test('khu vừa bị gỡ quyền rơi về khu đầu', () => {
  // Cookie còn nhớ 'c' nhưng người này vừa bị gỡ khỏi khu đó.
  assert.equal(khuDaChon([k('a'), k('b')], 'c')?.id, 'a')
})

test('hộp chọn chỉ hiện khi có từ hai khu', () => {
  assert.equal(nenHienHopChon([]), false)
  assert.equal(nenHienHopChon([k('a')]), false)
  assert.equal(nenHienHopChon([k('a'), k('b')]), true)
})

test('số liệu nhận dạng khu', () => {
  assert.equal(soLieuKhu(k('a', { so_toa: 3, so_can: 468 })), '3 tòa · 468 căn')
  assert.equal(soLieuKhu(k('a', { so_toa: 0, so_can: 0 })), '0 tòa · 0 căn')
})

test('khu chưa có căn nào thì nói rõ phải làm gì', () => {
  assert.equal(canhBaoKhu(k('a', { so_can: 0 })), 'Khu này chưa có căn nào. Nhập danh sách căn ở màn “Nhập từ Excel” trước khi phát hành hóa đơn hay mở biểu quyết.')
  assert.equal(canhBaoKhu(k('a', { so_can: 1 })), null)
  assert.equal(canhBaoKhu(k('a', { so_can: 468 })), null)
})
