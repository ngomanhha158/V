import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BAO_CAO, baoCao, DINH_DANG, docKy, kyHienTai, mocKy, tenTep,
} from './bao-cao.ts'
import { dungWorkbook } from './excel.ts'
import ExcelJS from 'exceljs'

// ───────────────────────────── định nghĩa báo cáo ─────────────────────────────

test('mọi báo cáo đều có id riêng và ít nhất một cột', () => {
  const ids = BAO_CAO.map((b) => b.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const b of BAO_CAO) {
    assert.ok(b.cot.length > 0, `${b.id} không có cột nào`)
    assert.ok(b.ten && b.tep && b.moTa, `${b.id} thiếu tên/tệp/mô tả`)
  }
})

test('khóa cột không trùng trong cùng một báo cáo', () => {
  // Trùng khóa nghĩa là hai cột lấy cùng một giá trị — bảng vẫn ra, chỉ là sai.
  for (const b of BAO_CAO) {
    const k = b.cot.map((c) => c.khoa)
    assert.equal(new Set(k).size, k.length, `${b.id} có khóa cột trùng`)
  }
})

test('tên tệp không dấu, để không phải mã hóa RFC 5987', () => {
  for (const b of BAO_CAO) {
    assert.match(b.tep, /^[a-z0-9-]+$/, `${b.id} có tên tệp không thuần ASCII`)
  }
})

test('mã định dạng tiền dùng dấu PHẨY làm chỗ đặt phân nhóm', () => {
  // Excel thay dấu phẩy bằng dấu phân nhóm theo vùng của người mở file. Đổi
  // thành '#.##0' cho "đúng kiểu Việt" là biến dấu chấm thành dấu thập phân.
  assert.equal(DINH_DANG.tien, '#,##0')
  assert.equal(DINH_DANG.chu, undefined)
})

test('công nợ là ảnh chụp, không gắn kỳ', () => {
  assert.equal(baoCao('cong-no')?.theoKy, false)
  assert.equal(baoCao('so-quy')?.theoKy, true)
  assert.equal(baoCao('khong-co'), undefined)
})

// ───────────────────────────── kỳ ─────────────────────────────

test('chỉ nhận kỳ dạng YYYY-MM có tháng thật', () => {
  assert.equal(docKy('2026-09'), '2026-09')
  assert.equal(docKy(' 2026-01 '), '2026-01')
  assert.equal(docKy('2026-13'), null)
  assert.equal(docKy('2026-00'), null)
  assert.equal(docKy('2026-9'), null)
  assert.equal(docKy(''), null)
  assert.equal(docKy(undefined), null)
})

test('kỳ hiện tại đọc theo UTC, có đệm số 0', () => {
  assert.equal(kyHienTai(new Date('2026-03-01T00:00:00Z')), '2026-03')
  assert.equal(kyHienTai(new Date('2026-12-31T23:59:00Z')), '2026-12')
})

test('mốc kỳ cắt theo giờ Việt Nam, không phải UTC', () => {
  // Tiền về 3 giờ sáng 1/9 giờ VN = 20 giờ 31/8 giờ UTC. Cắt theo UTC là đẩy
  // giao dịch đó sang tháng 8 — sổ quỹ tháng 9 thiếu đúng những dòng rạng sáng.
  const { tu, den } = mocKy('2026-09')
  assert.equal(tu, '2026-09-01T00:00:00+07:00')
  assert.equal(den, '2026-10-01T00:00:00+07:00')
  assert.equal(new Date(tu).toISOString(), '2026-08-31T17:00:00.000Z')

  const bien = new Date('2026-09-01T03:00:00+07:00')
  assert.ok(bien >= new Date(tu) && bien < new Date(den))
})

test('tháng 12 sang năm sau, không thành tháng 13', () => {
  assert.equal(mocKy('2026-12').den, '2027-01-01T00:00:00+07:00')
})

// ───────────────────────────── tên tệp ─────────────────────────────

test('tên tệp có kỳ và mốc chốt, hai lần xuất không đè lên nhau', () => {
  const bc = baoCao('so-quy')!
  const a = tenTep(bc, '2026-09', new Date('2026-09-02T05:30:00Z'))
  const b = tenTep(bc, '2026-09', new Date('2026-09-02T06:31:00Z'))
  assert.equal(a, 'so-quy_2026-09_20260902-0530.xlsx')
  assert.notEqual(a, b)
})

test('báo cáo ảnh chụp thì tên tệp không có kỳ', () => {
  const t = tenTep(baoCao('cong-no')!, '2026-09', new Date('2026-09-02T05:30:00Z'))
  assert.equal(t, 'cong-no_20260902-0530.xlsx')
})

// ───────────────────────────── file dựng ra ─────────────────────────────

async function doc(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}

const CHOT = {
  duAn: 'Sunrise Riverside', ky: '2026-09',
  chotLuc: new Date('2026-09-02T05:30:00Z'), nguoiXuat: 'bql@example.vn',
}

test('tiền ghi vào ô dạng SỐ, không phải chuỗi', async () => {
  // Đây là cả lý do tồn tại của tính năng: kế toán phải bôi đen cột và cộng
  // được. Ghi "1.287.000đ" thành chữ thì file nhìn đẹp mà vô dụng.
  const bc = baoCao('cong-no')!
  const wb = await doc(await dungWorkbook(bc, [{
    building_code: 'P1', unit_code: 'P1-10.01', so_hoa_don: 3, con_no: 1287000,
    han_cu_nhat: '2026-08-15', so_ngay_qua_han: 18,
    ten_lien_he: 'Ngô Mạnh Hà', dien_thoai: '0901234567',
  }], CHOT))

  const ct = wb.getWorksheet('Chi tiết')!
  const cot = bc.cot.findIndex((c) => c.khoa === 'con_no') + 1
  const o = ct.getRow(2).getCell(cot)
  assert.equal(typeof o.value, 'number')
  assert.equal(o.value, 1287000)
  assert.equal(o.numFmt, '#,##0')
})

test('ngày ghi vào ô dạng Date, để lọc và sắp xếp được', async () => {
  const bc = baoCao('cong-no')!
  const wb = await doc(await dungWorkbook(bc, [{ han_cu_nhat: '2026-08-15' }], CHOT))
  const cot = bc.cot.findIndex((c) => c.khoa === 'han_cu_nhat') + 1
  assert.ok(wb.getWorksheet('Chi tiết')!.getRow(2).getCell(cot).value instanceof Date)
})

test('sheet Tổng hợp đứng trước và ghi đúng mốc chốt', async () => {
  const wb = await doc(await dungWorkbook(baoCao('so-quy')!, [], CHOT))
  assert.equal(wb.worksheets[0].name, 'Tổng hợp')
  assert.equal(wb.worksheets[1].name, 'Chi tiết')
  const nhan = wb.worksheets[0].getColumn(1).values.map((v) => String(v ?? ''))
  assert.ok(nhan.includes('Chốt lúc'), 'thiếu dòng mốc chốt số')
  assert.ok(nhan.includes('Người xuất'))
})

test('tổng ở sheet Tổng hợp khớp với tổng cột bên chi tiết', async () => {
  // Lệch nhau là dấu hiệu file hỏng, và người mở nhìn ra ngay — đó là mục đích.
  const bc = baoCao('cong-no')!
  const dong = [{ con_no: 1_000_000 }, { con_no: 2_500_000 }, { con_no: 500_000 }]
  const wb = await doc(await dungWorkbook(bc, dong, CHOT))
  const th = wb.worksheets[0]

  let tong: unknown = null
  th.eachRow((r) => { if (r.getCell(1).value === 'Còn nợ') tong = r.getCell(2).value })
  assert.equal(tong, 4_000_000)

  const cot = bc.cot.findIndex((c) => c.khoa === 'con_no') + 1
  let cong = 0
  wb.worksheets[1].eachRow((r, i) => {
    if (i > 1) cong += Number(r.getCell(cot).value) || 0
  })
  assert.equal(cong, tong)
})

test('không có dòng nào vẫn ra file mở được, ghi rõ 0 dòng', async () => {
  // "Chưa có số liệu" phải phân biệt được với "hệ thống hỏng".
  const wb = await doc(await dungWorkbook(baoCao('doi-soat')!, [], CHOT))
  const th = wb.worksheets[0]
  let soDong: unknown = null
  th.eachRow((r) => { if (r.getCell(1).value === 'Số dòng') soDong = r.getCell(2).value })
  assert.equal(soDong, 0)
  assert.equal(wb.worksheets[1].getRow(1).getCell(1).value, 'Thời điểm')
})

test('ô rỗng để trống, không thành chữ "null" hay số 0', async () => {
  const bc = baoCao('cong-no')!
  const wb = await doc(await dungWorkbook(bc, [{ unit_code: 'P1-10.01', ten_lien_he: null }], CHOT))
  const cot = bc.cot.findIndex((c) => c.khoa === 'ten_lien_he') + 1
  const v = wb.getWorksheet('Chi tiết')!.getRow(2).getCell(cot).value
  assert.ok(v === null || v === undefined, `ô rỗng đang là ${JSON.stringify(v)}`)
})

test('số không đọc được thì giữ nguyên chữ, không hóa thành 0', async () => {
  // Ô 0đ trông như đã thu đủ; ô ghi chữ thì người đọc biết có gì đó lạ.
  const bc = baoCao('cong-no')!
  const wb = await doc(await dungWorkbook(bc, [{ con_no: 'chưa chốt' }], CHOT))
  const cot = bc.cot.findIndex((c) => c.khoa === 'con_no') + 1
  assert.equal(wb.getWorksheet('Chi tiết')!.getRow(2).getCell(cot).value, 'chưa chốt')
})

test('dòng tiêu đề đóng băng và bật lọc', async () => {
  const wb = await doc(await dungWorkbook(baoCao('hoa-don')!, [], CHOT))
  const ct = wb.worksheets[1]
  assert.equal(ct.views[0]?.state, 'frozen')
  assert.ok(ct.autoFilter, 'chưa bật lọc trên dòng tiêu đề')
})
