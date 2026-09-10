/**
 * GO-LIVE.md phải nói đúng về chính cái repo này.
 *
 * Tài liệu đó là thứ DUY NHẤT người dựng hệ thống cầm theo lúc go-live, và mọi
 * chỗ nó sai đều lộ ra đúng lúc không còn ai để hỏi. Nguy nhất là con số gõ
 * tay: "67 route", "30 file SQL" — trông có thẩm quyền, rồi lặng lẽ lệch sau
 * mỗi lần thêm file, mà không có gì báo. Đã lệch thật: doc ghi 67 màn trong khi
 * trên đĩa có 66.
 *
 * Bài đắt nhất là danh sách job nền. Doc liệt kê 8 đường `/api/cron/<tên>` để
 * người ta chép vào lịch của Railway. Tên nào lệch với bản đồ VIEC trong route
 * handler thì lịch đó gọi vào một 404 — và theo đúng cảnh báo của chính doc,
 * job nền hỏng thì "không có gì báo": hóa đơn không được nhắc, ticket quá hạn
 * không leo thang, sổ ra vào giữ mãi quá hạn lưu 90 ngày đã hứa với cư dân.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const doc = readFileSync('GO-LIVE.md', 'utf8')
let hong = 0
const ok  = (t) => console.log(`OK    ${t}`)
const xau = (t, vi) => { console.error(`HỎNG  ${t}\n      ${vi}`); hong += 1 }

/** Mọi .tsx/.ts dưới app/, bỏ bản demo. */
function quet(thuMuc, ten, bo = true) {
  const ra = []
  for (const m of readdirSync(thuMuc)) {
    const p = join(thuMuc, m)
    if (statSync(p).isDirectory()) {
      if (bo && m === 'demo') continue
      ra.push(...quet(p, ten, bo))
    } else if (m === ten) ra.push(p)
  }
  return ra
}

// ── 1. Job nền: doc ↔ code, KHỚP CẢ HAI CHIỀU ───────────────────────────────
// Thiếu chiều ngược lại thì thêm một job vào code mà quên ghi vào doc sẽ lọt:
// người dựng hệ thống đặt đủ số lịch doc bảo, và job mới không bao giờ chạy.
{
  // Neo vào cụm "job nền và giờ chạy", KHÔNG vào chữ số viết bằng chữ: đổi
  // "Tám" thành "Chín" mà quên sửa chỗ này thì cả bài kiểm im lặng đọc ra 0 job
  // và báo "doc không nhắc job nào" — một bài kiểm sai theo kiểu khó truy nhất.
  const khoiJob = doc.match(/^[^\n]*job nền và giờ chạy[\s\S]*?(?=^## )/m)?.[0] ?? ''
  const trongDoc = [...khoiJob.matchAll(/^- `([a-z-]+)`/gm)].map((m) => m[1])
  // MỘT danh mục cho cả hệ thống — lib/job-nen.ts. Trước đây chỗ này đọc hai
  // bản đồ rời trong route handler, và sót một bản đồ nghĩa là job Node không
  // ai bắt phải ghi vào doc, nên lịch cron cho nó không bao giờ được đặt. Đúng
  // chuyện đã xảy ra với day-thong-bao.
  const nguon = readFileSync('lib/job-nen.ts', 'utf8')
  const khoi = nguon.match(/export const JOB = \{[\s\S]*?\n\} as const/)?.[0] ?? ''
  const trongCode = [...khoi.matchAll(/^  '([a-z-]+)': \{$/gm)].map((m) => m[1])

  const thieuTrongCode = trongDoc.filter((t) => !trongCode.includes(t))
  const thieuTrongDoc  = trongCode.filter((t) => !trongDoc.includes(t))
  if (trongCode.length === 0) {
    xau('job nền doc ↔ code', 'không đọc được danh mục JOB từ lib/job-nen.ts '
      + '— cả bài kiểm này rỗng, không kết luận được gì')
  } else if (thieuTrongCode.length) {
    xau('job nền doc ↔ code', `doc bảo đặt lịch cho ${thieuTrongCode.join(', ')} `
      + '— danh mục không có, lịch đó gọi vào 404 và không có gì báo')
  } else if (thieuTrongDoc.length) {
    xau('job nền doc ↔ code', `code có ${thieuTrongDoc.join(', ')} mà doc không nhắc `
      + '— người dựng đặt đủ số lịch doc bảo, job này không bao giờ chạy')
  } else if (trongDoc.length === 0) {
    xau('job nền doc ↔ code', 'không đọc được danh sách job nào từ GO-LIVE.md')
  } else {
    ok(`${trongDoc.length} job nền: tên trong GO-LIVE.md khớp danh mục lib/job-nen.ts`)
  }

  // Bảng chữ số phải RỘNG hơn số job hiện có. Thiếu một mục thì `chuSo` là
  // undefined và nhánh dưới đây từng lặng lẽ nhảy sang "OK" — một bài kiểm tự
  // tắt khi hệ thống lớn thêm, đúng lúc nó cần thiết nhất.
  const CHU = { 5: 'Năm', 6: 'Sáu', 7: 'Bảy', 8: 'Tám', 9: 'Chín', 10: 'Mười',
                11: 'Mười một', 12: 'Mười hai' }
  const chuSo = CHU[trongCode.length]
  if (!chuSo) {
    xau('số job nền viết bằng chữ',
      `chưa có chữ số tiếng Việt cho ${trongCode.length} job — thêm vào bảng CHU trong file này`)
  } else if (!doc.includes(`${chuSo} job nền`)) {
    xau('số job nền viết bằng chữ', `code có ${trongCode.length} job, doc không mở đầu bằng "${chuSo} job nền"`)
  } else ok(`doc nói đúng số job nền bằng chữ (${chuSo})`)
}

// ── 2. Con số gõ tay trong bảng "Đã sẵn sàng" ───────────────────────────────
{
  const soFileSql = readdirSync('.').filter((f) => /^test_.*\.sql$/.test(f)).length
  const soMan = quet('app', 'page.tsx').length

  const dong = doc.match(/^\| Bộ test \| (.+) \|$/m)?.[1] ?? ''
  const nSql = Number(dong.match(/(\d+) file SQL/)?.[1])
  if (nSql !== soFileSql) {
    xau('số file test SQL', `GO-LIVE.md ghi ${nSql}, trên đĩa có ${soFileSql}`)
  } else ok(`số file test SQL khớp (${soFileSql})`)

  // Chạy thật bộ JS rồi đếm, không đoán: đây là con số dễ lệch nhất vì thêm
  // một `test(...)` là nó đổi, mà chẳng ai nhớ mở doc ra sửa.
  // Glob ĐỌC TỪ package.json, không chép lại ở đây. Bản chép tay vừa lệch
  // thật: thêm mcp/**/*.test.ts vào `test:js` mà quên chỗ này, thế là bộ đếm
  // chạy ít test hơn bộ test thật rồi báo doc sai — trong khi doc mới là cái
  // đúng. Một chỗ giữ sự thật thì hết cả lớp lỗi đó.
  const lenh = JSON.parse(readFileSync('package.json', 'utf8')).scripts['test:js']
  const glob = [...lenh.matchAll(/"([^"]+\.test\.ts)"/g)].map((m) => m[1])
  if (glob.length === 0) throw new Error('Không đọc được glob test từ package.json scripts["test:js"]')
  const ra = execFileSync('node',
    ['--experimental-strip-types', '--test', ...glob],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const soJs = Number(ra.match(/^# pass (\d+)$/m)?.[1])
  const nJs = Number(dong.match(/(\d+) test JS/)?.[1])
  if (nJs !== soJs) {
    xau('số test JS', `GO-LIVE.md ghi ${nJs}, chạy thật ra ${soJs}`)
  } else ok(`số test JS khớp (${soJs})`)

  const nMan = Number(doc.match(/^\| Giao diện \| (\d+) route thật/m)?.[1])
  if (nMan !== soMan) {
    xau('số màn', `GO-LIVE.md ghi ${nMan} route thật, đếm được ${soMan} page.tsx (không kể demo)`)
  } else ok(`số màn khớp (${soMan})`)
}

// ── 3. Mọi đường dẫn doc nhắc tới phải có thật ──────────────────────────────
// Doc chỉ người ta mở `reset_demo_data.sql`, `railway/GD1-runbook.sh`… Đổi tên
// một file mà quên sửa doc thì họ đi tìm một file không tồn tại.
{
  const bo = new Set()
  for (const m of doc.matchAll(/`([\w./-]+\.(?:sql|sh|yml|ts|tsx|json|md))`/g)) bo.add(m[1])
  const thieu = [...bo].filter((f) => {
    try { statSync(f); return false } catch { return true }
  })
  if (thieu.length) xau('file doc nhắc tới', `không có trên đĩa: ${thieu.join(', ')}`)
  else ok(`${bo.size} đường dẫn file trong GO-LIVE.md đều có thật`)
}

// ── 4. Mọi màn /bql/... doc bảo mở phải có thật ─────────────────────────────
{
  const bo = new Set([...doc.matchAll(/`(\/[a-z][\w/-]*)`/g)].map((m) => m[1])
    .filter((d) => !d.startsWith('/api/') && !d.startsWith('/data/')))
  const thieu = [...bo].filter((d) => {
    const s = d.replace(/^\//, '')
    return !quet('app', 'page.tsx').some((p) =>
      p.replace(/^app\//, '').replace(/\/page\.tsx$/, '').replace(/\([^)]*\)\//g, '') === s)
  })
  if (thieu.length) xau('màn doc bảo mở', `không có route: ${thieu.join(', ')}`)
  else ok(`${bo.size} đường dẫn màn trong GO-LIVE.md đều có route`)
}

console.log(hong === 0 ? '\nGO-LIVE.md khớp với repo.' : `\n${hong} chỗ lệch.`)
process.exit(hong === 0 ? 0 : 1)
