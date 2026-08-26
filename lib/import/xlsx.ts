// Bóc sheet đầu tiên thành mảng 2 chiều. Tách riêng khỏi server action để test
// được: exceljs trả row.values là mảng 1-BASED (phần tử [0] luôn rỗng), quên
// slice(1) là lệch toàn bộ bảng đi một cột mà vẫn chạy, vẫn ra số liệu.
import ExcelJS from 'exceljs'

export async function sheetToRows(data: ArrayBuffer | Buffer): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(data as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('File không có sheet nào.')

  const rows: unknown[][] = []
  ws.eachRow({ includeEmpty: true }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : []
    // Ô công thức trả về { formula, result }; ô rich text trả về { richText }.
    rows.push(values.map(flatten))
  })
  return rows
}

function flatten(v: unknown): unknown {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('result' in o) return o.result
    if ('text' in o) return o.text
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((t) => t.text).join('')
    }
    if ('hyperlink' in o && 'text' in o) return o.text
  }
  return v
}
