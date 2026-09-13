import test from 'node:test'
import assert from 'node:assert/strict'
import { demNgoaiChuThich, docNguon as doc } from './soat-nguon.ts'

/**
 * Chứng từ in ra giấy: hóa đơn và phiếu thu.
 *
 * Không có hàm nào để gọi ở đây — phần phán xét nằm trong JSX. Nên bài này giữ
 * hai thứ mà mất đi thì chỉ lộ ra sau khi máy in đã chạy xong.
 */

const MAN_HOA_DON = [
  'app/(cu-dan)/invoices/[id]/page.tsx',
  'app/demo/(cu-dan)/invoices/[id]/page.tsx',
]

test('bản thật và bản demo dựng hóa đơn bằng CÙNG một component', () => {
  // Bản demo là thứ người ta xem trước khi quyết định mua. Dựng lại chứng từ
  // bằng tay ở đó thì sớm muộn nó hiện một tờ giấy mà hệ thống thật không in
  // ra được — và không ai phát hiện, vì hai màn không bao giờ mở cạnh nhau.
  for (const f of MAN_HOA_DON) {
    assert.match(doc(f), /<HoaDonGiay\b/, `${f} không dùng HoaDonGiay`)
  }
})

test('không màn nào tự cộng lại tiền hóa đơn bên ngoài chứng từ', () => {
  // Một route in riêng nghĩa là hai lần đọc database và hai phép cộng. Sau một
  // lần trả góp, tờ giấy in ra và màn hình đang mở nói hai con số khác nhau —
  // và người cầm tờ giấy đi hỏi BQL là người biết cuối cùng.
  const pham: string[] = []
  for (const f of MAN_HOA_DON) {
    const t = doc(f)
    // `conLai` để chọn nhãn trạng thái thì được; dựng lại bảng tổng thì không.
    if (demNgoaiChuThich(t, 'Còn phải trả') > 0) pham.push(f)
  }
  assert.deepEqual(pham, [], `${pham.join(', ')} chép lại phần tổng của chứng từ`)
})

test('hóa đơn có nút in, y như phiếu thu', () => {
  for (const f of [...MAN_HOA_DON, 'app/phieu-thu/[id]/page.tsx']) {
    assert.match(doc(f), /<NutIn\s*\/>/, `${f} thiếu nút In / Lưu PDF`)
  }
})

test('chỉ có MỘT nút in trong cả repo', () => {
  // Hai bản chép tay thì một ngày nào đó một bên sửa chữ trên nút, và cư dân
  // đọc hai câu khác nhau cho cùng một việc.
  assert.match(doc('components/nut-in.tsx'), /window\.print\(\)/)
  for (const f of MAN_HOA_DON) {
    assert.ok(!doc(f).includes('window.print()'), `${f} tự viết lại nút in`)
  }
})

test('vỏ điều hướng của cả ba shell KHÔNG ra giấy', () => {
  // Thiếu no-print ở đây thì mọi chứng từ in ra đều có một thanh menu ở đầu
  // trang — và người ta chỉ biết sau khi tờ giấy đã ra khỏi máy in. Đúng thứ
  // vừa xảy ra lúc dựng bài này.
  const vo: [string, RegExp][] = [
    ['components/shell/resident-shell.tsx', /<header className="no-print /],
    ['components/shell/resident-shell.tsx', /<nav className="no-print /],
    ['components/shell/bqt-shell.tsx', /<header className="no-print /],
    ['components/shell/bql-shell.tsx', /<aside className="no-print /],
  ]
  for (const [f, re] of vo) {
    assert.match(doc(f), re, `${f}: vỏ điều hướng thiếu no-print`)
  }
})

test('luật no-print có thật trong CSS, không chỉ có tên lớp', () => {
  // Rắc `no-print` khắp nơi mà quên luật thì mọi assert trên đây vẫn xanh và
  // mọi tờ giấy vẫn kèm thanh menu.
  const css = doc('app/globals.css')
  assert.match(css, /@media print/)
  assert.match(css, /\.no-print\s*\{\s*display:\s*none\s*!important/)
})
