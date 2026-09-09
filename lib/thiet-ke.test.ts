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

// ── Chữ số: đều bề rộng ở đâu, tỉ lệ ở đâu ──────────────────────────────────
// Hai luật ngược nhau, và cả hai đều TRÔNG NHƯ THIẾU SÓT nếu chỉ liếc qua:
// một chỗ có `num` mà chỗ kia không. Người đọc code sau sẽ thấy chênh và
// "sửa" cho đều — nên khoá lại ở đây kèm lý do.

const UI = readFileSync(new URL('../components/ui.tsx', import.meta.url), 'utf8')
const CHART = readFileSync(new URL('../components/chart.tsx', import.meta.url), 'utf8')

/** Lấy chuỗi lớp chứa `moc`, tính cả khi nó nối nhiều dòng. */
function lopChua(nguon: string, moc: string): string {
  const i = nguon.indexOf(moc)
  assert.notEqual(i, -1, `không thấy ${moc}`)
  const dau = nguon.lastIndexOf("'", i)
  const cuoi = nguon.indexOf("'", i)
  return nguon.slice(dau + 1, cuoi)
}

test('con số lớn trong Stat dùng chữ số TỈ LỆ, không phải đều bề rộng', () => {
  const lop = lopChua(UI, 'text-[1.625rem]')
  // tabular-nums đệm chữ số 1 thành ô rộng bằng chữ số 0. Ở cỡ hiển thị thì
  // "121" rời ra từng mảnh. Bốn ô thống kê nằm NGANG và đo bốn thứ khác nhau —
  // không có cột dọc nào để mà dóng, nên không có gì để đánh đổi lấy chuyện đó.
  assert.ok(!/\bnum\b/.test(lop), `Stat không được có \`num\`: "${lop}"`)
  assert.match(lop, /text-\[1\.875rem\]/, 'vẫn phải là bậc chữ lớn')
})

test('vạch trục Y của biểu đồ dùng chữ số ĐỀU BỀ RỘNG', () => {
  // Ngược lại: 50 / 75 / 100 xếp thành cột dọc, canh phải. Chữ số lệch bề rộng
  // thì mép phải răng cưa và ba con số không đọc thành một trục.
  assert.match(CHART, /className="num fill-faint text-\[0\.6875rem\]"/)
})

test('hàng bảng và cặp nhãn–giá trị VẪN đều bề rộng', () => {
  // Đây mới là chỗ tabular-nums sinh ra để dùng: số xếp thành cột dọc thật.
  // Bỏ nhầm ở đây thì bảng công nợ hết dóng được cột.
  assert.match(UI, /so && 'num'/, 'ô số trong bảng mất tabular-nums')
})

/**
 * KHÔNG con số cỡ hiển thị nào được mang tabular-nums, ở BẤT KỲ file nào.
 *
 * Luật này từng chỉ áp cho Stat, và thế là chưa đủ: bốn màn khác tự dựng số lớn
 * riêng — số dư quỹ, tỷ lệ thu, tiền phải trả — và cả bốn vẫn còn `num`. Sửa
 * một primitive không sửa được những chỗ không dùng primitive đó.
 *
 * Ngưỡng 1.25rem: dưới mức đó chưa phải cỡ hiển thị, và ở đó `num` thường ĐÚNG
 * — chot-so.tsx dùng 1.0625rem cho giá trị canh phải trong danh sách dọc, tức
 * là chúng thật sự xếp thành cột.
 */
test('không con số cỡ hiển thị nào còn tabular-nums', async () => {
  const { readdirSync, statSync } = await import('node:fs')
  const goc = new URL('../', import.meta.url).pathname
  const tep: string[] = []
  const quet = (d: string) => {
    for (const m of readdirSync(d)) {
      if (m === 'node_modules' || m === '.next' || m.startsWith('.')) continue
      const p = `${d}/${m}`
      if (statSync(p).isDirectory()) quet(p)
      else if (m.endsWith('.tsx')) tep.push(p)
    }
  }
  quet(`${goc}app`); quet(`${goc}components`)

  const pham: string[] = []
  for (const f of tep) {
    for (const [, lop] of readFileSync(f, 'utf8').matchAll(/className=\{?["'`]([^"'`]+)["'`]/g)) {
      if (!/\bnum\b/.test(lop)) continue
      // MIỄN TRỪ: tracking DƯƠNG nghĩa là con số này để đọc TỪNG KÝ TỰ, không
      // phải để nhìn một phát ra độ lớn — số chứng từ người ta đọc qua điện
      // thoại cho kế toán nghe. Ở đó chữ số đều bề rộng và tách nhau ra là
      // đúng, ngược hẳn với một con số hiển thị.
      if (/tracking-(wide|wider|widest)/.test(lop)) continue
      const co = [...lop.matchAll(/text-\[(\d+(?:\.\d+)?)rem\]/g)].map((m) => Number(m[1]))
      if (co.some((v) => v >= 1.25)) pham.push(`${f.replace(goc, '')}: "${lop}"`)
    }
  }
  assert.deepEqual(pham, [], `số cỡ hiển thị còn tabular-nums:\n${pham.join('\n')}`)
})
