// Chạy: npm run test:js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateReadingRows, mapHeaders } from './chi-so.ts'

const CAN = ['P1-10.01', 'P1-10.02', 'P1-10.03']
const CUOI = { 'P1-10.01': 1200, 'P1-10.02': 850, 'P1-10.03': 300 }

test('nhận tiêu đề tiếng Việt, và "chỉ số cũ" không bị "chỉ số" nuốt mất', () => {
  // Nuốt nhầm ở đây là cột cũ và cột mới hoán chỗ — cả hai đều là số hợp lệ nên
  // không có gì kêu lên, chỉ có hóa đơn ra số khổng lồ.
  assert.deepEqual(mapHeaders(['Mã căn', 'Chỉ số cũ', 'Chỉ số mới']),
    { 0: 'unit_code', 1: 'prev_index', 2: 'curr_index' })
  assert.deepEqual(mapHeaders(['Căn hộ', 'Đầu kỳ', 'Cuối kỳ']),
    { 0: 'unit_code', 1: 'prev_index', 2: 'curr_index' })
})

test('dòng hợp lệ đi qua', () => {
  const r = validateReadingRows([
    ['Mã căn', 'Chỉ số cũ', 'Chỉ số mới'],
    ['P1-10.01', '1200', '1245'],
  ], CAN, CUOI)
  assert.deepEqual(r.issues, [])
  assert.deepEqual(r.ok, [{ unit_code: 'P1-10.01', prev_index: 1200, curr_index: 1245 }])
})

test('thiếu cột "chỉ số cũ" thì lấy chỉ số cuối kỳ trước', () => {
  // Đây là dạng file hay gặp nhất: người đi đọc chỉ ghi số vừa đọc được.
  const r = validateReadingRows([
    ['Mã căn', 'Chỉ số mới'],
    ['P1-10.01', '1245'],
  ], CAN, CUOI)
  assert.deepEqual(r.issues, [])
  assert.equal(r.ok[0].prev_index, 1200)
})

test('KHÔNG bao giờ mặc định chỉ số cũ về 0', () => {
  // Trên công tơ đã chạy nhiều năm, 0 biến toàn bộ lượng dùng từ ngày lắp thành
  // lượng dùng của tháng này. Không có chỉ số cũ thì phải DỪNG, không phải đoán.
  const r = validateReadingRows([
    ['Mã căn', 'Chỉ số mới'],
    ['P1-10.01', '1245'],
  ], CAN, {})   // hệ thống chưa có chỉ số nào
  assert.equal(r.ok.length, 0)
  assert.match(r.issues[0].message, /chưa từng có chỉ số/)
})

test('file ghi chỉ số cũ LỆCH với hệ thống thì dừng, không tự chọn bên nào', () => {
  // Lệch = công tơ vừa thay, hoặc đọc nhầm đồng hồ. Hai chuyện khác hẳn nhau,
  // và đoán sai chuyện nào cũng ra hóa đơn sai mà nhìn vẫn bình thường.
  const r = validateReadingRows([
    ['Mã căn', 'Chỉ số cũ', 'Chỉ số mới'],
    ['P1-10.01', '900', '1245'],
  ], CAN, CUOI)
  assert.equal(r.ok.length, 0)
  assert.match(r.issues[0].message, /File ghi 900 nhưng cuối kỳ trước hệ thống ghi 1200/)
})

test('công tơ không quay ngược', () => {
  const r = validateReadingRows([
    ['Mã căn', 'Chỉ số cũ', 'Chỉ số mới'],
    ['P1-10.01', '1200', '1100'],
  ], CAN, CUOI)
  assert.equal(r.ok.length, 0)
  assert.match(r.issues[0].message, /nhỏ hơn chỉ số cũ/)
})

test('căn không thuộc khu này bị chặn', () => {
  // Quan trọng với nhiều khu: file của khu B nhập nhầm vào khu A thì mọi mã căn
  // đều lạ, và phải nói ra chứ không im lặng nhập 0 dòng.
  const r = validateReadingRows([
    ['Mã căn', 'Chỉ số mới'],
    ['GV1-08.03', '500'],
  ], CAN, CUOI)
  assert.equal(r.ok.length, 0)
  assert.match(r.issues[0].message, /không có trong khu này/)
})

test('cùng một căn hai dòng thì chặn cả dòng sau', () => {
  const r = validateReadingRows([
    ['Mã căn', 'Chỉ số mới'],
    ['P1-10.01', '1245'],
    ['P1-10.01', '1300'],
  ], CAN, CUOI)
  assert.equal(r.ok.length, 1)
  assert.match(r.issues[0].message, /đã có ở dòng 2/)
})

test('dòng trống bị bỏ qua, không tính là lỗi', () => {
  const r = validateReadingRows([
    ['Mã căn', 'Chỉ số mới'],
    ['', '', ''],
    ['P1-10.01', '1245'],
  ], CAN, CUOI)
  assert.deepEqual(r.issues, [])
  assert.equal(r.skippedBlank, 1)
  assert.equal(r.ok.length, 1)
})

test('căn có trong hệ thống mà file bỏ sót thì được KỂ TÊN', () => {
  // Không phải lỗi — công tơ khoá cửa không đọc được là chuyện thường. Nhưng im
  // lặng bỏ qua thì tháng đó mấy hộ không có hóa đơn nước và không ai biết.
  const r = validateReadingRows([
    ['Mã căn', 'Chỉ số mới'],
    ['P1-10.01', '1245'],
  ], CAN, CUOI)
  assert.deepEqual(r.thieu, ['P1-10.02', 'P1-10.03'])
})

test('số kiểu Excel Việt Nam: 1.234,5', () => {
  const r = validateReadingRows([
    ['Mã căn', 'Chỉ số cũ', 'Chỉ số mới'],
    ['P1-10.02', '850', '1.234,5'],
  ], CAN, CUOI)
  assert.deepEqual(r.issues, [])
  assert.equal(r.ok[0].curr_index, 1234.5)
})

test('thiếu cột bắt buộc thì báo ngay, không đọc tiếp dòng nào', () => {
  const r = validateReadingRows([['Mã căn', 'Ghi chú'], ['P1-10.01', 'x']], CAN, CUOI)
  assert.equal(r.ok.length, 0)
  assert.equal(r.issues.length, 1)
  assert.match(r.issues[0].message, /Không tìm thấy cột bắt buộc/)
})
