import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  HAN_DOI_CHIEU_NGAY, NGUONG_VUNG_MU, TOI_THIEU_DANH_GIA,
  duMauDanhGia, quyChua, quyHomNay, quyTruoc, soatQuy, vungMuSla,
} from './bqt.ts'
import { soDuTaiNgay } from './quy.ts'

test('quý chứa một ngày, cả bốn quý và biên của chúng', () => {
  assert.deepEqual(quyChua('2026-01-01'), { tu: '2026-01-01', den: '2026-03-31', nhan: 'Quý 1/2026' })
  assert.deepEqual(quyChua('2026-03-31'), { tu: '2026-01-01', den: '2026-03-31', nhan: 'Quý 1/2026' })
  assert.deepEqual(quyChua('2026-04-01'), { tu: '2026-04-01', den: '2026-06-30', nhan: 'Quý 2/2026' })
  assert.deepEqual(quyChua('2026-09-12'), { tu: '2026-07-01', den: '2026-09-30', nhan: 'Quý 3/2026' })
  assert.deepEqual(quyChua('2026-12-31'), { tu: '2026-10-01', den: '2026-12-31', nhan: 'Quý 4/2026' })
})

test('quý 1 của năm nhuận kết thúc 31/03, không phải 30/03', () => {
  // cuoiThang đi qua Date.UTC nên 29/02 phải tự đúng; chốt lại bằng test vì
  // một lỗi lệch ngày ở đây làm báo cáo quý thiếu mất một ngày giao dịch.
  assert.equal(quyChua('2024-02-29').den, '2024-03-31')
  assert.equal(quyChua('2024-02-29').tu, '2024-01-01')
})

test('quý trước bắc qua giao thừa', () => {
  assert.equal(quyTruoc(quyChua('2026-01-15')).nhan, 'Quý 4/2025')
  assert.equal(quyTruoc(quyChua('2026-01-15')).tu, '2025-10-01')
  assert.equal(quyTruoc(quyChua('2026-01-15')).den, '2025-12-31')
  assert.equal(quyTruoc(quyChua('2026-09-12')).nhan, 'Quý 2/2026')
})

test('quý hôm nay tính theo giờ VN', () => {
  // Không chốt được giá trị (nó đổi theo ngày chạy test), nhưng chốt được hình
  // dạng và tính nhất quán — đủ để bắt một lần đổi sang giờ server.
  const k = quyHomNay()
  assert.match(k.nhan, /^Quý [1-4]\/\d{4}$/)
  assert.deepEqual(quyChua(k.tu), k)
  assert.deepEqual(quyChua(k.den), k)
})

const SO = [
  { ngay: '2026-01-10', luy_ke: 500_000_000 },
  { ngay: '2026-03-31', luy_ke: 620_000_000 },
  { ngay: '2026-07-05', luy_ke: 480_000_000 },
]

test('số dư sổ tại một ngày lấy dòng cuối cùng KHÔNG vượt mốc', () => {
  assert.equal(soDuTaiNgay(SO, '2026-01-09'), 0, 'trước dòng đầu thì sổ chưa có gì')
  assert.equal(soDuTaiNgay(SO, '2026-01-10'), 500_000_000, 'đúng ngày đó thì tính vào')
  assert.equal(soDuTaiNgay(SO, '2026-05-20'), 620_000_000)
  assert.equal(soDuTaiNgay(SO, '2026-12-31'), 480_000_000)
  assert.equal(soDuTaiNgay([], '2026-05-20'), 0)
})

test('ĐỐI CHIẾU SO TẠI NGÀY ĐỐI CHIẾU, không so với số dư hôm nay', () => {
  // Đây là bẫy chính của màn này. Sao kê ngày 31/03 khớp với sổ ngày 31/03.
  // Sau đó quỹ chi 140 triệu. Nếu đem số dư sổ HÔM NAY so với sao kê cũ thì ra
  // "lệch 140 triệu" — một báo động sai, ngày nào cũng kêu, cho tới lần đối
  // chiếu sau. Ban quản trị nhìn thấy nó vài lần là thôi không nhìn nữa.
  const r = soatQuy(SO, 620_000_000, '2026-03-31', '2026-07-10')
  assert.equal(r.tinh, 'cu', 'khớp tại ngày đối chiếu, chỉ là đã quá cũ')
  assert.equal(r.lech, 0)
  assert.equal(r.soDuLucDoiChieu, 620_000_000)
  assert.equal(r.soDuSo, 480_000_000, 'số dư hôm nay vẫn phải hiện, chỉ là không dùng để so')
})

test('lệch thật thì báo lệch, kèm dấu', () => {
  const r = soatQuy(SO, 600_000_000, '2026-03-31', '2026-04-02')
  assert.equal(r.tinh, 'lech')
  assert.equal(r.lech, 20_000_000, 'dương = sổ ghi nhiều hơn ngân hàng đang giữ')

  const nguoc = soatQuy(SO, 650_000_000, '2026-03-31', '2026-04-02')
  assert.equal(nguoc.lech, -30_000_000)
})

test('lệch xét TRƯỚC cũ', () => {
  // Cũ mà còn lệch thì việc phải làm là đi tìm khoản lệch, không phải đi đối
  // chiếu lại. Báo "cũ" ở đây là giấu mất việc nặng hơn.
  const r = soatQuy(SO, 600_000_000, '2026-03-31', '2027-01-01')
  assert.equal(r.tinh, 'lech')
})

test('khớp và còn mới thì mới là khớp', () => {
  const r = soatQuy(SO, 620_000_000, '2026-03-31', '2026-04-02')
  assert.equal(r.tinh, 'khop')
  assert.equal(r.soNgayCach, 2)
})

test('biên của hạn đối chiếu: đúng hạn còn khớp, quá một ngày là cũ', () => {
  const dung = soatQuy(SO, 620_000_000, '2026-03-31', '2026-05-15')  // 45 ngày
  assert.equal(dung.soNgayCach, HAN_DOI_CHIEU_NGAY)
  assert.equal(dung.tinh, 'khop')
  const qua = soatQuy(SO, 620_000_000, '2026-03-31', '2026-05-16')
  assert.equal(qua.tinh, 'cu')
})

test('chưa từng đối chiếu là một tình trạng RIÊNG, không phải khớp', () => {
  // Không có gì để so thì không được kết luận là khớp. Quỹ bảo trì là khoản
  // tiền lớn nhất ban quản trị chịu trách nhiệm; im lặng ở đây là tệ nhất.
  for (const r of [
    soatQuy(SO, null, null, '2026-07-10'),
    soatQuy(SO, 620_000_000, null, '2026-07-10'),
    soatQuy(SO, null, '2026-03-31', '2026-07-10'),
  ]) {
    assert.equal(r.tinh, 'chua_doi_chieu')
    assert.equal(r.lech, null)
    assert.equal(r.soDuLucDoiChieu, null)
  }
})

const TK = (o: Partial<Parameters<typeof vungMuSla>[0]> = {}) => ({
  tong_ticket: 100, ticket_tu_choi: 0, ticket_khong_co_sla: 0,
  ticket_co_ket_luan: 90, ty_le_dung_sla: 95, ...o,
})

test('vùng mù SLA gộp ĐÚNG hai lối lách: từ chối và danh mục chưa khai SLA', () => {
  const v = vungMuSla(TK({ ticket_tu_choi: 12, ticket_khong_co_sla: 18 }))
  assert.equal(v.soNgoai, 30)
  assert.equal(v.tyLe, 0.3)
  assert.equal(v.dangNgai, true, '30% ngoài phép đo thì tỷ lệ đúng hạn không còn đáng tin')
})

test('lẻ tẻ thì không kêu — kêu oan là dạy người ta bỏ qua', () => {
  const v = vungMuSla(TK({ ticket_tu_choi: 3, ticket_khong_co_sla: 2 }))
  assert.equal(v.tyLe, 0.05)
  assert.equal(v.dangNgai, false)
})

test('đúng ngưỡng là đã đáng ngại', () => {
  const v = vungMuSla(TK({ ticket_tu_choi: 25 }))
  assert.equal(v.tyLe, NGUONG_VUNG_MU)
  assert.equal(v.dangNgai, true)
})

test('kỳ không có yêu cầu nào thì KHÔNG phải vùng mù 100%', () => {
  // 0/0 mà viết ẩu thành NaN hoặc 1 là màn hình báo động đỏ cho một khu vừa
  // mới dựng, chưa ai gửi yêu cầu nào.
  const v = vungMuSla(TK({ tong_ticket: 0, ticket_co_ket_luan: 0, ty_le_dung_sla: null }))
  assert.equal(v.soNgoai, 0)
  assert.equal(v.tyLe, 0)
  assert.equal(v.dangNgai, false)
})

test('điểm hài lòng đòi đủ cỡ mẫu mới được coi là nói lên điều gì', () => {
  assert.equal(duMauDanhGia(TOI_THIEU_DANH_GIA), true)
  assert.equal(duMauDanhGia(TOI_THIEU_DANH_GIA - 1), false)
  assert.equal(duMauDanhGia(0), false)
})

// ── Những thứ không test được bằng cách gọi hàm, nhưng mất đi thì hỏng nặng ──

const doc = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('khu vực BQT chốt quyền ở LAYOUT, không phải ở từng trang', () => {
  // Chốt ở layout thì thêm màn con sau này vẫn được che. Chốt ở từng trang thì
  // màn thứ hai quên chốt là mở cửa lặng lẽ, và không có gì nhắc.
  const l = doc('app/bqt/layout.tsx')
  assert.match(l, /rpc\('is_bqt'/, 'layout /bqt không hỏi is_bqt')
  assert.match(l, /if \(!quyen\(kqBqt, 'is_bqt'\)\) redirect\('\/'\)/,
    'layout /bqt hỏi quyền rồi không chặn')
})

test('layout và trang BQT chọn CÙNG một khu', () => {
  // Hai chỗ tự chọn khu riêng là hai chỗ sẽ chọn khác nhau ở đúng những ca
  // hiếm — và ca hiếm ở đây nghĩa là chốt quyền trên khu A rồi hiện số khu B.
  for (const f of ['app/bqt/layout.tsx', 'app/bqt/page.tsx']) {
    assert.match(doc(f), /khuBQT\(\)/, `${f} không dùng khuBQT()`)
  }
})

test('thanh bên của BQT KHÔNG có màn vận hành hằng ngày', () => {
  // Ban quản trị giám sát đơn vị quản lý; đưa họ vào đối soát tiền về, kho vật
  // tư hay xếp ca là sai vai, và phần lớn mục bấm vào cũng chỉ nhận lỗi quyền.
  const src = doc('components/shell/bql-shell.tsx')
  const khoi = src.slice(src.indexOf('const navBqt = ('), src.indexOf('const navBql = ('))
  assert.ok(khoi.length > 0, 'không tìm thấy thanh bên riêng của BQT')
  for (const cam of ['doi-soat', 'kho', 'ca-truc', 'nguoi-dung', 'import', 'billing', 'tickets']) {
    assert.ok(!khoi.includes(`/bql/${cam}`), `thanh bên BQT lọt màn vận hành "${cam}"`)
  }
  // Và phải còn đủ bốn màn họ thật sự ký hoặc chốt.
  for (const can of ['quy-bao-tri', 'bieu-quyet', 'bao-cao', 'ban-giao']) {
    assert.ok(khoi.includes(`/bql/${can}`), `thanh bên BQT thiếu màn "${can}"`)
  }
})

test('màn cư dân có lối vào riêng cho BQT', () => {
  // Không có link thì khu vực này thành một địa chỉ chỉ người viết code biết.
  const p = doc('app/(cu-dan)/page.tsx')
  assert.match(p, /vai_tro === 'bqt'/)
  assert.match(p, /href="\/bqt"/)
})
