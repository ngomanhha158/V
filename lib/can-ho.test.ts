import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  coLoc, DIEN_TICH_TOI_DA, dieuKien, docDienTich, docLoc, queryLoc, soM2, taLoc, thoatMaCan,
} from './can-ho.ts'

const TOA = new Map([['P1', 'toa-1'], ['P2', 'toa-2']])

// ───────────────────────────── docDienTich ─────────────────────────────

test('đọc được cả dấu phẩy lẫn dấu chấm làm dấu thập phân', () => {
  assert.equal(docDienTich('78,5'), 78.5)
  assert.equal(docDienTich('78.5'), 78.5)
  assert.equal(docDienTich('62'), 62)
  assert.equal(docDienTich('96,40'), 96.4)
})

test('bỏ khoảng trắng và đuôi m2 người ta hay gõ theo', () => {
  assert.equal(docDienTich(' 78,5 '), 78.5)
  assert.equal(docDienTich('78,5m2'), 78.5)
  assert.equal(docDienTich('78,5 M²'), 78.5)
})

test('từ chối số không dùng để tính tiền được', () => {
  assert.equal(docDienTich(''), null)
  assert.equal(docDienTich('0'), null)
  assert.equal(docDienTich('-5'), null)
  assert.equal(docDienTich('abc'), null)
  assert.equal(docDienTich('78,5,5'), null)
})

test('quá hai chữ số thập phân thì từ chối, không làm tròn im lặng', () => {
  // numeric(8,2) sẽ tự làm tròn nếu để lọt — mà làm tròn im lặng một con số
  // dùng để nhân ra tiền là thứ không ai phát hiện cho tới lúc đối chiếu.
  assert.equal(docDienTich('78,567'), null)
  assert.equal(docDienTich('78,56'), 78.56)
})

test('chặn ở trần diện tích, vì trên mức đó là gõ nhầm đơn vị', () => {
  assert.equal(docDienTich(String(DIEN_TICH_TOI_DA)), DIEN_TICH_TOI_DA)
  assert.equal(docDienTich(String(DIEN_TICH_TOI_DA + 1)), null)
})

test('hiện số theo lối viết Việt', () => {
  assert.equal(soM2(78.5), '78,5')
  assert.equal(soM2(62), '62')
})

// ───────────────────────────── thoatMaCan ─────────────────────────────

test('ký tự đại diện không lọt vào chuỗi tìm mã căn', () => {
  // PostgREST dịch '*' thành '%', còn '%' và '_' vốn đã là ký tự đại diện.
  // Ô tìm này quyết định luôn tập bị sửa hàng loạt nên không được để lọt.
  assert.equal(thoatMaCan('%'), '')
  assert.equal(thoatMaCan('*'), '')
  assert.equal(thoatMaCan('_'), '')
  assert.equal(thoatMaCan('P1-08.0%'), 'P1-08.0')
  assert.equal(thoatMaCan('.01'), '.01')
  assert.equal(thoatMaCan('P1-08.01'), 'P1-08.01')
})

// ───────────────────────────── docLoc ─────────────────────────────

test('đọc bộ lọc từ tham số URL', () => {
  const l = docLoc({ toa: 'p1', tang: '08', ma: '.01', thieu: '1' }, TOA)
  assert.equal(l.toa, 'P1')
  assert.equal(l.toaId, 'toa-1')
  assert.equal(l.tang, 8)
  assert.equal(l.ma, '.01')
  assert.equal(l.chuaCo, true)
})

test('tham số rỗng nghĩa là không lọc gì, trừ khoanh vùng dự án', () => {
  const l = docLoc({}, TOA)
  assert.equal(coLoc(l), false)
  assert.equal(taLoc(l), 'toàn bộ căn trong khu')
  // Vẫn phải còn đúng một điều kiện: khoanh trong các tòa của dự án. Bỏ nó đi
  // thì màn đếm cả căn của khu khác — mà lệnh ghi lại bị RLS chặn đúng những
  // căn đó, nên nút hứa một đằng sửa một nẻo.
  assert.deepEqual(dieuKien(l), [{ kieu: 'trongDuAn', ids: ['toa-1', 'toa-2'] }])
})

test('mọi bộ lọc đều khoanh trong dự án', () => {
  for (const sp of [{}, { toa: 'P1' }, { tang: '8' }, { ma: '.01' }, { thieu: '1' }]) {
    assert.equal(dieuKien(docLoc(sp, TOA))[0].kieu, 'trongDuAn')
  }
})

test('tầng không phải số thì bỏ qua, không nhận NaN', () => {
  assert.equal(docLoc({ tang: 'tám' }, TOA).tang, null)
  assert.equal(docLoc({ tang: '-3' }, TOA).tang, null)
  assert.equal(docLoc({ tang: '1e3' }, TOA).tang, null)
  assert.equal(docLoc({ tang: '0' }, TOA).tang, 0)
})

// ───────────────────────────── dieuKien ─────────────────────────────

test('mã tòa không có thật thì khớp 0 căn, không phải khớp tất cả', () => {
  // Bỏ hẳn điều kiện tòa đi thì bộ lọc "tòa không tồn tại" lại trả về TOÀN BỘ
  // căn — và nút áp hàng loạt sẽ đụng vào tất cả.
  const l = docLoc({ toa: 'P9' }, TOA)
  assert.equal(l.toaId, null)
  const dk = dieuKien(l).filter((d) => d.kieu === 'toa')
  assert.equal(dk.length, 1)
  assert.notEqual(dk[0].kieu === 'toa' && dk[0].gt, 'toa-1')
})

test('mỗi phần của bộ lọc ra đúng một điều kiện', () => {
  const l = docLoc({ toa: 'P2', tang: '12', ma: '.04', thieu: '1' }, TOA)
  assert.deepEqual(dieuKien(l), [
    { kieu: 'trongDuAn', ids: ['toa-1', 'toa-2'] },
    { kieu: 'toa', gt: 'toa-2' },
    { kieu: 'tang', gt: 12 },
    { kieu: 'ma', mau: '%.04%' },
    { kieu: 'chuaCo' },
  ])
})

test('câu tả bộ lọc nói đúng cái nút áp hàng loạt sẽ đụng vào', () => {
  assert.equal(
    taLoc(docLoc({ toa: 'P1', tang: '8', thieu: '1' }, TOA)),
    'tòa P1, tầng 8, chưa có diện tích',
  )
})

// ───────────────────────────── queryLoc ─────────────────────────────

test('link phân trang giữ nguyên bộ lọc', () => {
  const l = docLoc({ toa: 'P1', ma: '.01' }, TOA)
  const q = queryLoc(l, { trang: '3' })
  const p = new URLSearchParams(q.slice(1))
  assert.equal(p.get('toa'), 'P1')
  assert.equal(p.get('ma'), '.01')
  assert.equal(p.get('trang'), '3')
})

test('không lọc gì thì không đẻ ra query string rỗng', () => {
  assert.equal(queryLoc(docLoc({}, TOA)), '')
})
