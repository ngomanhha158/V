import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import {
  KhongHoiDuocQuyen, cauKhongHoiDuoc, danhSach, laKhongHoiDuocQuyen, quyen, xetQuyen,
} from './chot-quyen.ts'

const loi = { message: 'Could not find the function public.is_staff(p_project)' }

// ── Ba trạng thái, không phải hai ────────────────────────────────────────────

test('không lỗi, database nói true → cho qua', () => {
  assert.equal(xetQuyen({ data: true, error: null }), 'cho')
})

test('không lỗi, database nói false → chặn', () => {
  assert.equal(xetQuyen({ data: false, error: null }), 'chan')
})

test('không lỗi mà không có dữ liệu → chặn, không phải "không hỏi được"', () => {
  // Chốt quyền chỉ mở khi database nói đúng chữ "có". null/undefined không
  // phải "có", nhưng cũng không phải một lần hỏng — đừng ném oan.
  assert.equal(xetQuyen({ data: null, error: null }), 'chan')
  assert.equal(xetQuyen({ data: undefined, error: null }), 'chan')
})

test('có lỗi → "không hỏi được", KHÁC hẳn "bị chặn"', () => {
  assert.equal(xetQuyen({ data: undefined, error: loi }), 'khong_hoi_duoc')
})

test('lỗi THẮNG dữ liệu: vừa lỗi vừa có data:true vẫn không cho qua', () => {
  // Một kết quả vừa lỗi vừa có dữ liệu là kết quả không tin được, và bên không
  // tin được thì không được cho qua. Đây là ca duy nhất mà chọn sai nghĩa là
  // MỞ CỬA cho người không có quyền, nên nó phải có test riêng.
  assert.equal(xetQuyen({ data: true, error: loi }), 'khong_hoi_duoc')
  assert.throws(() => quyen({ data: true, error: loi }, 'is_staff'), KhongHoiDuocQuyen)
})

// ── quyen(): một dòng, không có chỗ nào để quên đọc error ───────────────────

test('quyen() trả boolean khi hỏi được', () => {
  assert.equal(quyen({ data: true, error: null }, 'is_staff'), true)
  assert.equal(quyen({ data: false, error: null }, 'is_staff'), false)
})

test('quyen() ném khi không hỏi được, và ném đúng lớp', () => {
  let bat: unknown
  try { quyen({ data: null, error: loi }, 'is_staff') } catch (e) { bat = e }
  assert.ok(laKhongHoiDuocQuyen(bat), 'không ném KhongHoiDuocQuyen')
  assert.equal((bat as KhongHoiDuocQuyen).ten, 'is_staff')
  assert.equal((bat as KhongHoiDuocQuyen).chiTiet, loi.message)
})

test('câu lỗi nói RÕ đây không phải một lần từ chối quyền', () => {
  // Câu này đi vào log Railway kèm digest. Người đọc log mà tưởng "người dùng
  // không có quyền" thì sẽ đi sửa phân công nhân sự, trong khi thứ hỏng là một
  // câu grant chưa chạy.
  const c = cauKhongHoiDuoc('is_staff', loi.message)
  assert.match(c, /is_staff\(\)/)
  assert.match(c, /KHÔNG phải/)
  assert.match(c, /grant execute|schema chưa áp/)
  assert.match(c, new RegExp(loi.message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'câu lỗi nuốt mất nguyên nhân thật')
})

// ── danhSach(): chỗ "data ?? []" từng nói dối về TƯ CÁCH người dùng ─────────

test('danhSach() trả đúng các dòng đọc được', () => {
  assert.deepEqual(danhSach<{ id: string }>({ data: [{ id: 'a' }], error: null }, 'khu_toi_o'),
    [{ id: 'a' }])
})

test('danhSach() trả mảng rỗng khi database thật sự không có dòng nào', () => {
  assert.deepEqual(danhSach({ data: [], error: null }, 'khu_toi_o'), [])
  assert.deepEqual(danhSach({ data: null, error: null }, 'khu_toi_o'), [])
})

test('danhSach() KHÔNG biến một lần đọc hỏng thành "bạn không ở khu nào"', () => {
  assert.throws(() => danhSach({ data: null, error: loi }, 'khu_toi_o'), KhongHoiDuocQuyen)
})

// ── Giữ cho màn thứ 44 không viết lại kiểu cũ ───────────────────────────────

const HAM_QUYEN = ['is_staff', 'is_bqt', 'is_bql_manager', 'du_an_cua_toi',
  'current_unit_ids', 'khu_toi_o']

function tepNguon(...goc: string[]): string[] {
  const ra: string[] = []
  for (const g of goc) {
    const d = new URL(`../${g}/`, import.meta.url)
    for (const m of readdirSync(d, { recursive: true, encoding: 'utf8' })) {
      if (m.endsWith('.ts') || m.endsWith('.tsx')) ra.push(`${g}/${m}`)
    }
  }
  return ra
}

const doc = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/**
 * Dòng chứa vị trí `i` có phải là chú thích không.
 *
 * Cần, vì docblock của chot-quyen.ts trích DẪN nguyên kiểu viết sai để giải
 * thích nó — và luật quét theo chuỗi thì không phân biệt được lời dạy với lỗi.
 * Nới luật cho khỏi kêu thì mất luôn luật; loại chú thích ra thì giữ được cả
 * hai. (Cùng một cái bẫy đã gặp lúc soát cron: regex bắt đúng chú thích của
 * chính mình.)
 */
function trongChuThich(src: string, i: number): boolean {
  const dau = src.lastIndexOf('\n', i) + 1
  return /^\s*(\/\/|\*|\/\*)/.test(src.slice(dau, i + 1))
}

test('không chỗ nào gọi hàm quyền rồi bỏ error đi', () => {
  // Đây là test QUAN TRỌNG NHẤT của file. Các test trên chứng minh hàm mới
  // đúng; test này giữ cho hàm mới thật sự được dùng. Viết lại kiểu cũ ở màn
  // thứ 44 thì màn đó lặng lẽ đá người dùng về trang chủ, và không ai biết —
  // đúng như 22 chỗ trước đây.
  const re = new RegExp(
    String.raw`\{([^}]*)\}\s*=\s*await\s+db\.rpc\(\s*'(${HAM_QUYEN.join('|')})'`, 'g')
  const pham: string[] = []
  for (const f of tepNguon('app', 'lib', 'components')) {
    if (f.endsWith('.test.ts')) continue
    const src = doc(f)
    for (const m of src.matchAll(re)) {
      if (m[1].includes('error')) continue
      if (trongChuThich(src, m.index)) continue
      pham.push(`${f} — rpc('${m[2]}') bỏ error`)
    }
  }
  assert.deepEqual(pham, [], `\n${pham.join('\n')}\n`)
})

test('mọi màn hỏi is_staff đều đi qua quyen()', () => {
  // Đọc được error chưa đủ: đọc rồi nuốt cũng ra đúng màn hình cũ. Bắt buộc đi
  // qua quyen(), vì quyen() không có đường nào để nuốt.
  const thieu: string[] = []
  for (const f of tepNguon('app')) {
    const t = doc(f)
    if (!/rpc\(\s*'(is_staff|is_bqt|is_bql_manager)'/.test(t)) continue
    // xetQuyen() cũng được: nó là CÙNG một phán xét ba trạng thái, chỉ khác ở
    // chỗ để người gọi tự chọn cách hiện ra. Cái bị cấm là tự viết luật riêng.
    if (!/\b(quyen|xetQuyen)\(/.test(t)) thieu.push(f)
  }
  assert.deepEqual(thieu, [], `\n${thieu.join('\n')}\n`)
})
