import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  NHAN_CHO, NHAN_MUC_DO, NHAN_TRANG_THAI_YC, TONE_CHO, TONE_MUC_DO,
  coBanGiaoDuoc, loiDangTruc, loiGioCa, loiThoiGian, mucCho, quaDem,
} from './ca-truc.ts'

test('mức chờ cắt theo độ dài một ca, không theo số tròn', () => {
  // Dưới 1 giờ người nhận ca còn đang đi vòng kiểm tra — chưa phải chuyện.
  assert.equal(mucCho(0.2), 'moi')
  assert.equal(mucCho(3.9), 'moi')
  // Quá 4 giờ là đã qua một phần ba ca mà chưa ai đọc.
  assert.equal(mucCho(4), 'lau')
  assert.equal(mucCho(11.9), 'lau')
  // Quá 12 giờ là gần hết một ca: biên bản coi như chưa từng tới tay ai.
  assert.equal(mucCho(12), 'qua_lau')
  assert.equal(mucCho(30), 'qua_lau')
})

test('mức chờ nào cũng có nhãn và tông, và chỉ mức lâu mới tô đỏ', () => {
  for (const m of Object.keys(NHAN_CHO) as (keyof typeof NHAN_CHO)[]) {
    assert.ok(NHAN_CHO[m], m)
    assert.ok(TONE_CHO[m], m)
  }
  assert.equal(TONE_CHO.moi, 'trung')
  assert.equal(TONE_CHO.qua_lau, 'xau')
})

test('thời gian đọc bằng giờ và phút, không phải số thập phân', () => {
  // "3,3 giờ" thì người đọc phải tự nhẩm ra 20 phút.
  assert.equal(loiThoiGian(3.3333), '3 giờ 20 phút')
  assert.equal(loiThoiGian(2), '2 giờ')
  assert.equal(loiThoiGian(0.5), '30 phút')
  // Không bao giờ hiện "0 phút": vừa xong thì nói 1 phút.
  assert.equal(loiThoiGian(0.001), '1 phút')
})

test('ca qua đêm suy ra từ giờ, không lưu thêm một cột', () => {
  // Hai cột nói cùng một chuyện là hai cột sẽ lệch nhau.
  assert.equal(quaDem('18:00:00', '06:00:00'), true)
  assert.equal(quaDem('06:00:00', '18:00:00'), false)
  // Ca 24 giờ (cùng giờ vào và ra) vẫn là ca qua đêm, không phải ca 0 phút.
  assert.equal(quaDem('08:00:00', '08:00:00'), true)
  assert.equal(loiGioCa('18:00:00', '06:00:00'), '18:00 – 06:00 (qua đêm)')
  assert.equal(loiGioCa('06:00:00', '18:00:00'), '06:00 – 18:00')
})

test('trực quá dài được gọi tên là quên bấm kết ca', () => {
  // Đây thường không phải người anh hùng trực 20 tiếng, mà là một phiên chưa
  // đóng — và mọi con số bên dưới sai theo.
  const bayGio = Date.parse('2026-09-05T12:00:00Z')
  const dai = loiDangTruc('2026-09-04T20:00:00Z', bayGio)
  assert.equal(dai.tone, 'xau')
  assert.match(dai.loi, /quên bấm kết ca/)

  const thuong = loiDangTruc('2026-09-05T06:00:00Z', bayGio)
  assert.equal(thuong.tone, 'trung')
  assert.match(thuong.loi, /6 giờ/)
})

test('đồng hồ lệch không được hiện "đã trực -1 phút"', () => {
  // Đồng hồ máy chủ và trình duyệt lệch vài giây là chuyện thường; một con số
  // âm trên màn hình làm người dùng mất tin vào cả trang.
  const bayGio = Date.parse('2026-09-05T12:00:00Z')
  const r = loiDangTruc('2026-09-05T12:00:30Z', bayGio)
  assert.equal(r.loi, 'Vừa vào ca.')
  assert.doesNotMatch(r.loi, /-/)
})

test('"chưa ai của ca sau vào ca" đọc như một sự cố, không như lỗi thao tác', () => {
  const chuaVaoCa = coBanGiaoDuoc(null, [{ phien_id: 'x' }])
  assert.equal(chuaVaoCa.duoc, false)
  assert.match(chuaVaoCa.loi, /chưa vào ca nào/)

  const khongCoAi = coBanGiaoDuoc({ phien_id: 'a' }, [])
  assert.equal(khongCoAi.duoc, false)
  assert.match(khongCoAi.loi, /sự cố vận hành/)
  // Và phải chỉ ra lối đi, chứ không bỏ người ta đứng đó.
  assert.match(khongCoAi.loi, /kết ca kèm lý do/)

  assert.equal(coBanGiaoDuoc({ phien_id: 'a' }, [{ phien_id: 'b' }]).duoc, true)
})

test('nhãn trạng thái và mức độ phủ đúng enum trong SQL', () => {
  // Nhãn TypeScript trôi khỏi enum SQL là màn hình hiện một mã trần như
  // "in_progress" giữa một bảng tiếng Việt.
  const sql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
  const st = sql.match(/create type ticket_status\s+as enum \(([^)]+)\)/)
  const pr = sql.match(/create type ticket_priority as enum \(([^)]+)\)/)
  assert.ok(st && pr, 'không tìm thấy enum ticket_status / ticket_priority')
  const lay = (m: RegExpMatchArray) => m[1].split(',').map((x) => x.trim().replace(/'/g, ''))
  for (const v of lay(st!)) assert.ok(NHAN_TRANG_THAI_YC[v], `thiếu nhãn trạng thái "${v}"`)
  for (const v of lay(pr!)) {
    assert.ok(NHAN_MUC_DO[v], `thiếu nhãn mức độ "${v}"`)
    assert.ok(TONE_MUC_DO[v], `thiếu tông cho mức độ "${v}"`)
  }
  assert.equal(TONE_MUC_DO.urgent, 'xau')
})
