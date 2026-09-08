// Chạy: npm run test:js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

/** Bóc các khai báo `--ten: giá trị;` trong một khối, trả về map đã chuẩn hoá. */
function bienTrong(khoi: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const [, ten, gt] of khoi.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    m.set(ten, gt.trim().replace(/\s+/g, ' '))
  }
  return m
}

/** Lấy thân của khối bắt đầu tại `tuKhoa`, cân bằng ngoặc nhọn. */
function khoiSau(tuKhoa: string): string {
  const i = CSS.indexOf(tuKhoa)
  assert.notEqual(i, -1, `không tìm thấy khối: ${tuKhoa}`)
  let sau = 0, dem = 0
  for (let j = CSS.indexOf('{', i); j < CSS.length; j++) {
    if (CSS[j] === '{') dem++
    else if (CSS[j] === '}' && --dem === 0) { sau = j; break }
  }
  return CSS.slice(CSS.indexOf('{', i) + 1, sau)
}

/**
 * BẢNG MÀU NỀN TỐI ĐANG NẰM Ở HAI CHỖ, và CSS thuần không có cách nào gộp lại
 * mà không đánh đổi: light-dark() thì thiết bị cũ mất sạch màu, còn tách file
 * thì mất luôn khả năng đọc cả bảng màu trong một màn hình.
 *
 * Nên chấp nhận nhân đôi, và chốt bằng test này. Không phải giả định — lúc
 * thêm bóng đổ cho nền tối, sửa xong khối thứ nhất là đã suýt dừng lại.
 * Hỏng kiểu đó im lặng tuyệt đối: người để "theo hệ thống" thấy đúng, người
 * bấm nút chuyển sang tối thấy sai, và không ai báo vì ai cũng tưởng mình
 * đang nhìn thứ người kia nhìn.
 */
test('hai khối nền tối khai báo y hệt nhau', () => {
  const nut = bienTrong(khoiSau(':root[data-theme="dark"]'))
  const heDh = bienTrong(khoiSau('@media (prefers-color-scheme: dark)'))

  assert.ok(nut.size >= 20, `khối nút chỉ có ${nut.size} biến — có phải đọc nhầm khối?`)
  assert.deepEqual(
    [...heDh.keys()].sort(), [...nut.keys()].sort(),
    'Một khối nền tối có biến mà khối kia không có.',
  )
  for (const [ten, gt] of nut) {
    assert.equal(heDh.get(ten), gt, `${ten} lệch giữa hai khối nền tối.`)
  }
})

/**
 * Bóng đổ phải KHÁC NHAU giữa hai nền, không phải cùng một giá trị.
 *
 * Trước đây --shadow-card là hằng số dùng chung, và nó là bóng của nền sáng:
 * rgb(16 24 40 / 0.04) trên canvas #0b0f17 thì mắt không thấy gì. Nền tối coi
 * như mất hẳn tầng độ cao — mọi thẻ dán phẳng lên nền.
 */
test('nền tối có bóng riêng, đậm hơn nền sáng', () => {
  const sang = bienTrong(khoiSau(':root {'))
  const toi = bienTrong(khoiSau(':root[data-theme="dark"]'))

  for (const ten of ['--s-card', '--s-pop']) {
    assert.ok(sang.has(ten), `nền sáng thiếu ${ten}`)
    assert.ok(toi.has(ten), `nền tối thiếu ${ten}`)
    assert.notEqual(toi.get(ten), sang.get(ten), `${ten} dùng chung cho cả hai nền`)
  }
  // Độ đục lớn nhất của nền tối phải cao hơn hẳn nền sáng.
  const ducNhat = (s: string) =>
    Math.max(...[...s.matchAll(/\/\s*([\d.]+)\)/g)].map((m) => Number(m[1])))
  assert.ok(
    ducNhat(toi.get('--s-card')!) > ducNhat(sang.get('--s-card')!) * 3,
    'bóng nền tối chưa đủ đậm để nhìn thấy trên canvas tối',
  )
})

/**
 * Vòng focus KHÔNG được đặt border-radius.
 *
 * Dòng `border-radius: 4px` cũ bẻ bo góc của chính phần tử lúc focus, nên Chip
 * và Pill vốn bo tròn hoàn toàn bị giật thành gần vuông ngay khi Tab tới —
 * chỉ người đi bằng bàn phím mới thấy, tức là đúng nhóm mà vòng focus sinh ra
 * để phục vụ.
 */
test('vòng focus không bẻ bo góc của phần tử', () => {
  const khoi = khoiSau(':focus-visible')
  assert.match(khoi, /outline:/)
  assert.doesNotMatch(khoi, /border-radius/)
})

/** Người đã khai báo không chịu được chuyển động thì phải được tắt. */
test('có tôn trọng prefers-reduced-motion', () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)/)
  const khoi = khoiSau('@media (prefers-reduced-motion: reduce)')
  assert.match(khoi, /transition-duration:\s*0\.01ms\s*!important/)
  // 0.01ms chứ không phải 0: để 0 thì sự kiện transitionend không bao giờ bắn
  // và những màn chờ nó sẽ kẹt lại giữa chừng.
  assert.doesNotMatch(khoi, /transition-duration:\s*0s/)
})
