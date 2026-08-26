import { test } from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { sheetToRows } from './xlsx.ts'
import { validateUnitRows } from './units.ts'

async function buildXlsx(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  rows.forEach((r) => ws.addRow(r))
  return Buffer.from(await wb.xlsx.writeBuffer())
}

test('không lệch cột: ô đầu tiên phải là ô đầu tiên', async () => {
  const buf = await buildXlsx([
    ['Tòa', 'Mã căn', 'Tầng'],
    ['P1', 'P1-10.01', 10],
  ])
  const rows = await sheetToRows(buf)
  assert.deepEqual(rows[0], ['Tòa', 'Mã căn', 'Tầng'])
  assert.equal(rows[1][0], 'P1')
})

test('đi hết đường: xlsx bẩn -> lỗi đúng dòng', async () => {
  const buf = await buildXlsx([
    ['Tòa', 'Mã căn', 'Tầng', 'Diện tích (m2)'],
    ['P1', 'P1-10.01', 10, 75.5],
    [],                                    // dòng trống giữa file
    ['P9', 'P9-01.01', 10, 60],            // tòa không tồn tại
    ['P1', 'P1-10.01', 11, 80],            // trùng mã căn
    ['P1', 'P1-10.03', 'mười', 70],        // tầng ghi chữ
  ])
  const rows = await sheetToRows(buf)
  const r = validateUnitRows(rows, ['P1', 'P2'])

  assert.equal(r.ok.length, 1)
  assert.equal(r.ok[0].code, 'P1-10.01')
  assert.equal(r.skippedBlank, 1)
  assert.deepEqual(r.issues.map((i) => i.row), [4, 5, 6])
  assert.match(r.issues[0].message, /P9/)
  assert.match(r.issues[1].message, /trùng với dòng 2/)
  assert.match(r.issues[2].message, /mười/)
})

test('ô số của Excel vào thẳng, không thành chuỗi lạ', async () => {
  const buf = await buildXlsx([['Tòa', 'Mã căn', 'Tầng', 'Diện tích'], ['P1', 'A1', 10, 75.5]])
  const r = validateUnitRows(await sheetToRows(buf), ['P1'])
  assert.deepEqual(r.issues, [])
  assert.equal(r.ok[0].floor_no, 10)
  assert.equal(r.ok[0].area_m2, 75.5)
})

test('ô công thức lấy kết quả, không lấy công thức', async () => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('S')
  ws.addRow(['Tòa', 'Mã căn', 'Tầng'])
  const row = ws.addRow(['P1', 'A1', null])
  row.getCell(3).value = { formula: 'A1', result: 12 }
  const rows = await sheetToRows(Buffer.from(await wb.xlsx.writeBuffer()))
  const r = validateUnitRows(rows, ['P1'])
  assert.deepEqual(r.issues, [])
  assert.equal(r.ok[0].floor_no, 12)
})
