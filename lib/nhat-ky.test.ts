import { test } from 'node:test'
import assert from 'node:assert/strict'
import { docGiaTri, docNguoi, docThayDoi, TEN_THAO_TAC, tenBang, tenCot } from './nhat-ky.ts'

test('tên bảng và tên cột dịch ra tiếng Việt, không lộ tên kỹ thuật', () => {
  assert.equal(tenBang('fee_types'), 'Biểu phí')
  assert.equal(tenCot('unit_price'), 'Đơn giá')
  // Cột lạ thì giữ nguyên tên chứ không nuốt mất — thà xấu còn hơn giấu.
  assert.equal(tenBang('bang_moi'), 'bang_moi')
  assert.equal(tenCot('cot_la'), 'cot_la')
})

test('ba thao tác đều có nhãn và màu riêng', () => {
  for (const k of ['INSERT', 'UPDATE', 'DELETE']) {
    assert.ok(TEN_THAO_TAC[k]?.nhan, `thiếu nhãn cho ${k}`)
  }
  assert.equal(TEN_THAO_TAC.DELETE.tone, 'xau')
})

test('null hiện thành "(trống)", không phải chuỗi rỗng', () => {
  // Ô trống nhìn giống hệt "không có gì đổi", trong khi xóa giá trị đi là thay
  // đổi có thật và thường là thay đổi đáng chú ý nhất.
  assert.equal(docGiaTri('name', null), '(trống)')
  assert.equal(docGiaTri('name', undefined), '(trống)')
  assert.equal(docGiaTri('name', ''), '(rỗng)')
})

test('cột tiền có dấu phân nhóm, cột số thường thì không có đuôi đ', () => {
  // 16500 với 165000 không có dấu phân nhóm thì nhìn như nhau.
  assert.equal(docGiaTri('unit_price', 16500), '16.500đ')
  assert.equal(docGiaTri('total_amount', 1287000), '1.287.000đ')
  assert.equal(docGiaTri('floor_no', 12), '12')
  assert.match(docGiaTri('floor_no', 12), /^12$/)
})

test('boolean đọc thành Có/Không', () => {
  assert.equal(docGiaTri('is_active', true), 'Có')
  assert.equal(docGiaTri('is_active', false), 'Không')
})

test('chuỗi quá dài bị cắt, không phá vỡ bảng', () => {
  const dai = 'x'.repeat(200)
  const r = docGiaTri('content', dai)
  assert.ok(r.length < 90, `dài ${r.length}`)
  assert.ok(r.endsWith('…'))
})

test('cột chỉ có ở một bên vẫn hiện ra', () => {
  // Tạo mới thì `truoc` rỗng, xóa thì `sau` rỗng. Lấy giao thay vì hợp là mất
  // đúng phần nội dung người ta cần tra.
  const tao = docThayDoi({}, { name: 'Phí quản lý', unit_price: 16500 })
  assert.equal(tao.length, 2)
  assert.equal(tao.find((t) => t.cot === 'name')?.truoc, '(trống)')

  const xoa = docThayDoi({ amount: 1023000 }, {})
  assert.equal(xoa.length, 1)
  assert.equal(xoa[0].sau, '(trống)')
  assert.equal(xoa[0].truoc, '1.023.000đ')
})

test('danh sách thay đổi sắp xếp ổn định', () => {
  const a = docThayDoi({ b: 1, a: 2 }, { a: 3, b: 4 }).map((t) => t.cot)
  const b = docThayDoi({ a: 2, b: 1 }, { b: 4, a: 3 }).map((t) => t.cot)
  assert.deepEqual(a, b)
  assert.deepEqual(a, ['a', 'b'])
})

test('không có người thao tác thì nói rõ ai làm thay', () => {
  // Cron tự chạy, webhook ngân hàng, và người gõ tay trong SQL editor là ba
  // chuyện rất khác nhau khi truy trách nhiệm — gộp cả ba thành "—" là bỏ mất
  // đúng thông tin cần lúc điều tra.
  assert.equal(docNguoi(null, 'service_role'), 'Hệ thống (khóa máy chủ)')
  assert.match(docNguoi(null, 'postgres'), /database/)
  assert.notEqual(docNguoi(null, 'service_role'), docNguoi(null, 'postgres'))
  assert.equal(docNguoi('abcdef12-0000-0000-0000-000000000000', 'authenticated', 'Ngô Mạnh Hà'), 'Ngô Mạnh Hà')
})

test('có id nhưng chưa tra được tên thì hiện đầu id, không hiện rỗng', () => {
  assert.equal(docNguoi('abcdef12-0000-0000-0000-000000000000', 'authenticated'), 'abcdef12')
})

test('mốc thời gian thô đổi sang giờ Việt, không để ISO giữa bảng tiếng Việt', () => {
  // "2026-08-27T02:30:00.000Z" giữa một bảng tiếng Việt vừa lộ ruột kỹ thuật
  // vừa lệch 7 tiếng so với giờ người đọc đang sống.
  assert.equal(docGiaTri('approved_at', '2026-08-27T02:30:00.000Z'), '27/08/2026 09:30')
  assert.equal(docGiaTri('due_date', '2026-09-15'), '15/09/2026')
})

test('giá trị enum dịch ra tiếng người', () => {
  // Sổ kiểm toán mà BQT đọc không nổi thì đúng bằng không có sổ.
  assert.equal(docGiaTri('trang_thai', 'chua_khop'), 'Chưa khớp')
  assert.equal(docGiaTri('status', 'issued'), 'Đã phát hành')
  assert.equal(docGiaTri('role', 'bql_manager'), 'Trưởng ban quản lý')
  assert.equal(docGiaTri('priority', 'urgent'), 'Khẩn cấp')
  assert.equal(docGiaTri('calc_method', 'per_m2'), 'Theo m²')
})

test('giá trị lạ giữ nguyên, không bịa ra nhãn', () => {
  assert.equal(docGiaTri('status', 'trang_thai_moi'), 'trang_thai_moi')
})

test('cột đã ẩn vẫn đọc được là đã ẩn', () => {
  // Trigger ghi "(đã ẩn)" thay cho nội dung; màn phải hiện đúng chữ đó chứ
  // không được nuốt mất, nếu không người đọc tưởng cột đó không đổi.
  assert.equal(docGiaTri('raw_payload', '(đã ẩn)'), '(đã ẩn)')
})
