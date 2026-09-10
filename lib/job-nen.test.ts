import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  JOB, TEN_JOB, XAU, cachDay, soatJobNen, type DongJobChay, type TenJob,
} from './job-nen.ts'

const doc = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** Bảng đối chiếu ở đầu cron.sql, đọc thành cặp (đường dẫn, lịch cron). */
function bangCronSql(): Map<string, string> {
  const sql = doc('cron.sql')
  const ra = new Map<string, string>()
  for (const m of sql.matchAll(/-> \/api\/cron\/([a-z-]+)\s+(\S.*?)\s*$/gm)) {
    ra.set(m[1], m[2])
  }
  return ra
}

test('danh mục job KHỚP bảng đối chiếu ở đầu cron.sql', () => {
  // Đây là test đắt nhất của file này. Nó chặn đúng lỗi đã xảy ra thật: thêm
  // job vào route mà quên bảng đối chiếu, rồi quên luôn Cron Service trên
  // Railway — job không chạy suốt và không màn nào báo.
  const bang = bangCronSql()
  assert.deepEqual(
    [...bang.keys()].sort(), [...TEN_JOB].sort(),
    'cron.sql và lib/job-nen.ts đang khai hai danh sách job khác nhau')
  for (const ten of TEN_JOB) {
    assert.equal(bang.get(ten), JOB[ten].cron, `lịch của "${ten}" lệch giữa hai nơi`)
  }
})

test('bảng Cron Service trong runbook KHỚP danh mục', () => {
  // railway/GD1-runbook.sh là file người dựng hệ thống làm theo từng dòng. Bản
  // cũ ghi "7 Cron Service" rồi liệt kê 8 dòng và thiếu hẳn day-thong-bao —
  // nên trên production đúng 7 service được tạo, và hai job kia chưa bao giờ
  // chạy. Không có gì bắt được chuyện đó cho tới khi có test này.
  const sh = readFileSync(new URL('../railway/GD1-runbook.sh', import.meta.url), 'utf8')
  const bang = new Map<string, string>()
  for (const m of sh.matchAll(/^ {6}cron-\S+\s+(\S.*?)\s+\/api\/cron\/([a-z-]+)$/gm)) {
    bang.set(m[2], m[1])
  }
  assert.deepEqual(
    [...bang.keys()].sort(), [...TEN_JOB].sort(),
    'bảng Cron Service trong runbook thiếu hoặc thừa job so với lib/job-nen.ts')
  for (const ten of TEN_JOB) {
    assert.equal(bang.get(ten), JOB[ten].cron, `lịch của "${ten}" trong runbook lệch`)
  }
})

test('runbook không đếm số Cron Service bằng tay', () => {
  // Con số đó chính là thứ đã sai. Số service phải đọc từ bảng ngay dưới nó.
  const sh = readFileSync(new URL('../railway/GD1-runbook.sh', import.meta.url), 'utf8')
  assert.ok(
    !/\d+ Cron Service/.test(sh),
    'runbook lại đang viết cứng số lượng Cron Service')
})

test('job nào cũng có mặt trong GO-LIVE.md', () => {
  // GO-LIVE.md là thứ người dựng hệ thống đọc để biết phải đặt bao nhiêu lịch.
  // Thiếu một dòng ở đó thì thiếu một Cron Service, y như lần trước.
  const md = doc('GO-LIVE.md')
  for (const ten of TEN_JOB) {
    assert.ok(md.includes(`\`${ten}\``), `GO-LIVE.md chưa nhắc job "${ten}"`)
  }
})

test('hạn báo trễ rộng hơn chu kỳ, nhưng không rộng vô nghĩa', () => {
  // Quá chặt thì màn hình kêu oan mỗi lần deploy; quá lỏng thì một job chết ba
  // ngày vẫn xanh. Cả hai đều dẫn tới cùng một kết cục: không ai tin màn hình.
  for (const ten of TEN_JOB) {
    const { cron, hanGiay } = JOB[ten]
    const moiPhut = cron.match(/^\*\/(\d+) \* \* \* \*$/)
    if (moiPhut) {
      const chuKy = Number(moiPhut[1]) * 60
      assert.ok(hanGiay >= 2 * chuKy, `${ten}: hạn ${hanGiay}s quá sát chu kỳ ${chuKy}s`)
      assert.ok(hanGiay <= 12 * chuKy, `${ten}: hạn ${hanGiay}s quá lỏng so với ${chuKy}s`)
    } else if (/^\d+ \d+ \* \* \*$/.test(cron)) {
      assert.ok(hanGiay > 24 * 3600, `${ten}: job ngày mà hạn chưa tới 24 giờ`)
      assert.ok(hanGiay <= 48 * 3600, `${ten}: job ngày mà hạn quá 2 ngày`)
    } else {
      // Còn lại là job quý. Hạn phải ôm được khoảng cách xa nhất (~92 ngày).
      assert.ok(hanGiay >= 92 * 86400, `${ten}: hạn không ôm nổi một quý`)
    }
  }
})

test('job chạy bằng Node được nối vào route, job SQL thì không', () => {
  const ts = doc('app/api/cron/[viec]/route.ts')
  const khoi = ts.slice(ts.indexOf('const VIEC_NODE'), ts.indexOf('function soDong'))
  for (const ten of TEN_JOB) {
    const coTrongRoute = khoi.includes(`'${ten}'`)
    assert.equal(
      coTrongRoute, JOB[ten].ham === null,
      JOB[ten].ham === null
        ? `"${ten}" khai ham: null mà route không có hàm Node nào để gọi`
        : `"${ten}" có hàm SQL nhưng lại bị nối vào nhánh Node`)
  }
})

const dong = (o: Partial<DongJobChay> & { viec: TenJob }): DongJobChay =>
  ({ ok_luc: null, ok_so: null, ok_ms: null, loi_luc: null, loi: null, ...o })

const BAY_GIO = new Date('2026-09-10T12:00:00Z')
const truoc = (giay: number) => new Date(BAY_GIO.getTime() - giay * 1000).toISOString()
const tim = (ds: ReturnType<typeof soatJobNen>, ten: TenJob) => ds.find((x) => x.ten === ten)!

test('bảng trống: MỌI job đều báo chưa chạy', () => {
  // Đúng tình trạng ngay sau khi dựng xong hệ thống, và là lúc cần hét to
  // nhất — chưa job nào từng chạy nghĩa là chưa có Cron Service nào.
  const ds = soatJobNen([], BAY_GIO)
  assert.equal(ds.length, TEN_JOB.length)
  assert.ok(ds.every((x) => x.trangThai === 'chua_chay'))
})

test('job quý chưa tới lượt thì KHÔNG bị đánh là hỏng', () => {
  // Hệ mới dựng 2 ngày. Job 5 phút đã chạy, nên biết cron hoạt động. Job quý
  // chưa chạy là bình thường — đánh đỏ ở đây là dạy người ta bỏ qua màu đỏ.
  const ds = soatJobNen([
    dong({ viec: 'leo-thang-ticket', ok_luc: truoc(60) }),
    dong({ viec: 'nhac-no', ok_luc: truoc(2 * 86400) }),
  ], BAY_GIO)
  assert.equal(tim(ds, 'bao-cao-quy').trangThai, 'chua_toi_luot')
  assert.equal(tim(ds, 'leo-thang-ticket').trangThai, 'ok')
})

test('job chưa chạy mà hệ đã sống quá hạn của nó thì báo hỏng', () => {
  // Cùng dữ liệu như trên nhưng hệ đã sống 200 ngày: job quý lẽ ra phải chạy
  // ít nhất một lần rồi.
  const ds = soatJobNen([
    dong({ viec: 'leo-thang-ticket', ok_luc: truoc(60) }),
    dong({ viec: 'nhac-no', ok_luc: truoc(200 * 86400) }),
  ], BAY_GIO)
  assert.equal(tim(ds, 'bao-cao-quy').trangThai, 'chua_chay')
})

test('lịch bị xoá: job từng chạy rồi im quá hạn thì báo trễ', () => {
  const ds = soatJobNen([
    dong({ viec: 'leo-thang-ticket', ok_luc: truoc(3 * 86400) }),
  ], BAY_GIO)
  assert.equal(tim(ds, 'leo-thang-ticket').trangThai, 'tre')
})

test('lỗi mới hơn thành công thì báo lỗi, và giữ nguyên câu lỗi', () => {
  const ds = soatJobNen([
    dong({
      viec: 'day-thong-bao',
      ok_luc: truoc(600), ok_so: 4,
      loi_luc: truoc(60), loi: 'Chưa cấu hình push. Thiếu VAPID_PUBLIC_KEY.',
    }),
  ], BAY_GIO)
  const x = tim(ds, 'day-thong-bao')
  assert.equal(x.trangThai, 'loi')
  assert.match(x.loi!, /VAPID_PUBLIC_KEY/)
})

test('chạy lại được sau khi lỗi thì hết đỏ, nhưng lần lỗi cũ không xoá lần OK cũ', () => {
  // Ngược lại chiều trên: sửa xong khoá VAPID, job chạy lại được. Nếu chỗ này
  // vẫn đỏ thì không ai biết mình đã sửa xong.
  const ds = soatJobNen([
    dong({
      viec: 'day-thong-bao',
      ok_luc: truoc(60), ok_so: 12,
      loi_luc: truoc(600), loi: 'Chưa cấu hình push.',
    }),
  ], BAY_GIO)
  const x = tim(ds, 'day-thong-bao')
  assert.equal(x.trangThai, 'ok')
  assert.equal(x.so, 12)
  assert.equal(x.loi, null, 'đã chạy lại được thì không kéo câu lỗi cũ ra màn hình')
})

test('XAU đúng với ba trạng thái cần người xử lý', () => {
  assert.ok(XAU('tre') && XAU('loi') && XAU('chua_chay'))
  assert.ok(!XAU('ok') && !XAU('chua_toi_luot'))
})

test('cachDay đọc được ở mọi khoảng', () => {
  assert.equal(cachDay(null), 'chưa bao giờ')
  assert.equal(cachDay(truoc(30), BAY_GIO), '30 giây trước')
  assert.equal(cachDay(truoc(600), BAY_GIO), '10 phút trước')
  assert.equal(cachDay(truoc(3 * 3600), BAY_GIO), '3 giờ trước')
  assert.equal(cachDay(truoc(5 * 86400), BAY_GIO), '5 ngày trước')
  // Đồng hồ máy chủ lệch vài giây không được phép in ra "-2 giây trước".
  assert.equal(cachDay(truoc(-5), BAY_GIO), 'vừa xong')
})

test('màn go-live không đếm số Cron Service bằng tay', () => {
  // Dòng cũ ghi "phải có đủ 5 Cron Service" từ thời còn 5 job. Nhìn thấy 7 lịch
  // là tưởng dư, trong khi đang thiếu 2. Con số phải suy ra từ danh mục.
  //
  // Luật này CỐ Ý bắt cả bình luận, không chỉ chuỗi hiện ra màn hình: một con
  // số viết cứng trong bình luận cũng cũ đi đúng như vậy, và người sửa sau đọc
  // nó rồi tin theo. Muốn nói tới số lượng thì viết chữ, hoặc đọc TEN_JOB.
  //
  // Quét CẢ bản demo: nó là bản chép của màn thật, và chuỗi sai cũ nằm ở cả
  // hai nơi — sửa một bên rồi tưởng xong là đúng cách lỗi này sống sót.
  for (const f of [
    'app/bql/go-live/page.tsx',
    'app/demo/bql/go-live/page.tsx',
    'components/job-nen.tsx',
  ]) {
    assert.ok(!/\d+ Cron Service/.test(doc(f)), `${f} đang viết cứng số lượng Cron Service`)
  }
})

test('màn go-live phân biệt ĐỌC KHÔNG ĐƯỢC với BẢNG RỖNG', () => {
  // Bảng rỗng = chưa job nào từng chạy (đỏ, đúng). Đọc lỗi = database chưa áp
  // schema có bảng này (job vẫn chạy đều). Nuốt lỗi thành mảng rỗng thì màn
  // hình hét "cả chín job đều hỏng" một cách sai, và báo động sai dạy người ta
  // bỏ qua màu đỏ — đúng thứ cả thay đổi này đi dẹp.
  const tsx = doc('app/bql/go-live/page.tsx')
  assert.match(tsx, /error:\s*loiJob\s*\}\s*=\s*await db\.from\('job_chay'\)/,
    'màn go-live đang bỏ qua lỗi đọc job_chay')
  assert.match(tsx, /<BangJobNen job=\{job\} loi=\{/,
    'màn go-live không chuyển lỗi đọc xuống bảng job nền')
})

test('màn thật và bản demo dùng CHUNG bảng job nền', () => {
  // Chép bảng này ra hai bản là dựng lại đúng cái bệnh mà cả thay đổi này đi
  // chữa: hai bản chép của một sự thật, rồi lệch nhau mà không ai biết.
  for (const f of ['app/bql/go-live/page.tsx', 'app/demo/bql/go-live/page.tsx']) {
    const tsx = doc(f)
    assert.ok(tsx.includes('<BangJobNen job={job}'), `${f} không dùng BangJobNen`)
    assert.ok(!tsx.includes('function HangJob'), `${f} tự vẽ lại dòng job thay vì dùng chung`)
  }
})
