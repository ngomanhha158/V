// Chạy: npm run test:js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateUnitRows, normalizeHeader, mapHeaders } from './units.ts'

const B = ['P1', 'P2']

test('nhận tiêu đề tiếng Việt có dấu và biến thể', () => {
  assert.equal(normalizeHeader('Diện tích (m2)'), 'dien tich m2')
  assert.equal(normalizeHeader('  TÒA  '), 'toa')
  const m = mapHeaders(['Tòa', 'Mã căn', 'Tầng', 'Diện tích (m2)', 'Ghi chú'])
  assert.deepEqual(m, { 0: 'building_code', 1: 'code', 2: 'floor_no', 3: 'area_m2' })
})

test('dòng hợp lệ đi qua, mặc định kind/state được điền', () => {
  const r = validateUnitRows([
    ['Tòa', 'Mã căn', 'Tầng', 'Diện tích'],
    ['P1', 'P1-10.01', '10', '75.5'],
  ], B)
  assert.deepEqual(r.issues, [])
  assert.deepEqual(r.ok, [{
    building_code: 'P1', code: 'P1-10.01', floor_no: 10,
    area_m2: 75.5, kind: 'apartment', state: 'vacant',
  }])
})

test('diện tích kiểu Việt Nam: 75,5 và 1.234,5', () => {
  const r = validateUnitRows([
    ['Tòa', 'Mã căn', 'Tầng', 'Diện tích'],
    ['P1', 'A1', '10', '75,5'],
    ['P1', 'A2', '10', '1.234,5'],
  ], B)
  assert.deepEqual(r.issues, [])
  assert.deepEqual(r.ok.map((u) => u.area_m2), [75.5, 1234.5])
})

test('tòa chưa tồn tại thì báo đúng dòng, không nuốt', () => {
  const r = validateUnitRows([
    ['Tòa', 'Mã căn', 'Tầng'],
    ['P1', 'A1', '10'],
    ['P9', 'A2', '10'],
  ], B)
  assert.equal(r.ok.length, 1)
  assert.equal(r.issues.length, 1)
  assert.equal(r.issues[0].row, 3)
  assert.match(r.issues[0].message, /P9.*chưa có/)
})

test('trùng mã căn trong cùng file chỉ đến dòng trước', () => {
  const r = validateUnitRows([
    ['Tòa', 'Mã căn', 'Tầng'],
    ['P1', 'A1', '10'],
    ['P1', 'A1', '11'],
  ], B)
  assert.equal(r.ok.length, 1)
  assert.equal(r.issues[0].row, 3)
  assert.match(r.issues[0].message, /trùng với dòng 2/)
})

test('trùng với mã căn đã có trong DB', () => {
  const r = validateUnitRows([
    ['Tòa', 'Mã căn', 'Tầng'],
    ['P1', 'A1', '10'],
  ], B, ['A1'])
  assert.equal(r.ok.length, 0)
  assert.match(r.issues[0].message, /đã có trong hệ thống/)
})

test('tầng ghi chữ -> báo lỗi kèm giá trị gốc', () => {
  const r = validateUnitRows([
    ['Tòa', 'Mã căn', 'Tầng'],
    ['P1', 'A1', 'tầng 10'],
  ], B)
  assert.equal(r.ok.length, 0)
  assert.match(r.issues[0].message, /"tầng 10"/)
})

test('dòng trống bị bỏ qua, KHÔNG tính là lỗi', () => {
  const r = validateUnitRows([
    ['Tòa', 'Mã căn', 'Tầng'],
    ['P1', 'A1', '10'],
    ['', '', ''],
    [null, undefined, ''],
    ['P1', 'A2', '11'],
  ], B)
  assert.deepEqual(r.issues, [])
  assert.equal(r.ok.length, 2)
  assert.equal(r.skippedBlank, 2)
})

test('một dòng nhiều lỗi -> báo hết, không dừng ở lỗi đầu', () => {
  const r = validateUnitRows([
    ['Tòa', 'Mã căn', 'Tầng', 'Diện tích'],
    ['P9', '', 'x', 'abc'],
  ], B)
  assert.equal(r.ok.length, 0)
  assert.equal(r.issues.length, 4)
  assert.deepEqual([...new Set(r.issues.map((i) => i.row))], [2])
})

test('dòng lỗi không lọt vào ok dù các cột khác đúng', () => {
  const r = validateUnitRows([
    ['Tòa', 'Mã căn', 'Tầng', 'Diện tích'],
    ['P1', 'A1', '10', '-5'],
  ], B)
  assert.equal(r.ok.length, 0)
  assert.match(r.issues[0].message, /lớn hơn 0/)
})

test('thiếu cột bắt buộc -> dừng ngay, không báo 400 lỗi con', () => {
  const r = validateUnitRows([['Tòa', 'Diện tích'], ['P1', '75']], B)
  assert.equal(r.ok.length, 0)
  assert.equal(r.issues.length, 2)
  assert.ok(r.issues.every((i) => i.row === 1))
  assert.match(r.issues.map((i) => i.column).join(','), /code/)
})

test('enum sai -> liệt kê giá trị hợp lệ', () => {
  const r = validateUnitRows([
    ['Tòa', 'Mã căn', 'Tầng', 'Loại'],
    ['P1', 'A1', '10', 'chung cu'],
  ], B)
  assert.match(r.issues[0].message, /apartment, shophouse, office, penthouse/)
})

test('file rỗng', () => {
  const r = validateUnitRows([], B)
  assert.match(r.issues[0].message, /rỗng/)
})
