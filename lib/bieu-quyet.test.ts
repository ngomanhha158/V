import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  GIAI_THICH_Y_KIEN,
  NHAN_DOAN,
  NHAN_Y_KIEN,
  Y_KIEN,
  doanThanh,
  giaiThichKetQua,
  loiConCanChuaBo,
  m2,
  phanTram,
  thieuDeDuHop,
  trangThaiBQ,
  tyLe,
  type KetQua,
} from './bieu-quyet.ts'

/** Dựng một kết quả kiểm phiếu đúng như SQL sẽ trả về, từ ba con số diện tích. */
function kq(tt: number, ktt: number, tr: number, tong: number, nDuHop = 50, nThongQua = 50): KetQua {
  const bo = tt + ktt + tr
  const tyDuHop = tyLe(bo, tong)
  const tyTanThanh = tyLe(tt, bo)
  return {
    dien_tich_bo_phieu: bo,
    tan_thanh: tt,
    khong_tan_thanh: ktt,
    trang: tr,
    tong_dien_tich: tong,
    so_can_da_bo: 0,
    ty_le_du_hop: tyDuHop,
    ty_le_tan_thanh: tyTanThanh,
    du_hop: tong > 0 && (100 * bo) / tong >= nDuHop,
    thong_qua: bo > 0 && tong > 0 && (100 * bo) / tong >= nDuHop && (100 * tt) / bo >= nThongQua,
  }
}

test('nhãn ý kiến khớp đúng ba giá trị SQL nhận', () => {
  // Nhãn TypeScript và ràng buộc SQL trôi khỏi nhau là màn hình hiện một lựa
  // chọn mà database từ chối, và cư dân thấy "Y kien khong hop le" sau khi bấm.
  const sql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
  const m = sql.match(/y_kien\s+text not null check \(y_kien in \(([^)]+)\)\)/)
  assert.ok(m, 'không tìm thấy ràng buộc y_kien trong schema.sql')
  const trongSql = m![1].split(',').map((s) => s.trim().replace(/'/g, ''))
  assert.deepEqual([...trongSql].sort(), [...Y_KIEN].sort())
  for (const y of Y_KIEN) {
    assert.ok(NHAN_Y_KIEN[y], `thiếu nhãn cho ${y}`)
    assert.ok(GIAI_THICH_Y_KIEN[y], `thiếu giải thích cho ${y}`)
  }
})

test('tyLe làm tròn giống round(...,2) của Postgres', () => {
  assert.equal(tyLe(100, 150), 66.67)
  assert.equal(tyLe(100, 120), 83.33)
  assert.equal(tyLe(150, 170), 88.24)
  assert.equal(tyLe(30, 200), 15)
  // Ca .5 làm tròn LÊN như numeric của Postgres, không xuống như toFixed.
  assert.equal(tyLe(1.25, 100), 1.25)
  assert.equal(tyLe(0.125, 10), 1.25)
  // Mẫu số 0 không được ra NaN hay Infinity — nó rơi thẳng lên màn hình.
  assert.equal(tyLe(5, 0), 0)
  assert.equal(tyLe(0, 0), 0)
})

test('chưa đủ dự họp là một trạng thái RIÊNG, không phải "không thông qua"', () => {
  // 30/200 = 15% dự họp nhưng 100% tán thành trên phần đã bỏ. Nói gọn là
  // "không thông qua" thì mất mất khác biệt giữa "hội nghị không họp được" và
  // "hội nghị đã họp và bác nội dung" — hai kết luận đưa tới hai việc phải làm
  // khác hẳn nhau.
  const k = kq(30, 0, 0, 200)
  const r = giaiThichKetQua(k, 50, 50)
  assert.equal(r.ok, false)
  assert.match(r.tieu, /chưa đủ điều kiện/i)
  assert.doesNotMatch(r.tieu, /không thông qua/i)
  // Và phải nói ra rằng con số tán thành lúc này chưa có nghĩa.
  assert.match(r.than, /chưa nói lên điều gì/i)

  const bac = giaiThichKetQua(kq(40, 120, 0, 200), 50, 50)
  assert.equal(bac.ok, false)
  assert.match(bac.tieu, /không thông qua/i)
  assert.notEqual(bac.tieu, r.tieu)
})

test('câu kết quả luôn nói RÕ MẪU SỐ của từng tỷ lệ', () => {
  // Đây là lý do cả tệp này tồn tại: "66,67%" không kèm mẫu số là một con số
  // không kiểm chứng được, và biểu quyết là đúng chỗ người ta đem đi kiện nhau.
  const r = giaiThichKetQua(kq(100, 50, 0, 200, 50, 60), 50, 60)
  assert.equal(r.ok, true)
  assert.match(r.than, /66,67%/)
  assert.match(r.than, /ĐÃ BỎ PHIẾU/)
  assert.match(r.than, /100 m² trên 150 m²/)
  // Và tỷ lệ dự họp phải kèm mẫu số toàn khu.
  assert.match(r.than, /75%.*toàn khu/)
})

test('phiếu trắng được nói rõ là VẪN TÍNH vào mẫu số', () => {
  // Cư dân mặc định hiểu "trắng" là "không bỏ". Hiểu nhầm chỗ này làm người ta
  // bỏ trắng để phản đối, trong khi phiếu trắng lại kéo tỷ lệ tán thành xuống
  // đúng bằng cách nằm trong mẫu số.
  assert.match(GIAI_THICH_Y_KIEN.trang, /VẪN TÍNH/)
  assert.match(GIAI_THICH_Y_KIEN.trang, /không giống với việc không bỏ phiếu/)
  // Và phép tính phải hành xử đúng như lời hứa đó: 100 tán thành + 20 trắng
  // trên tổng 200 ra 83,33%, không phải 100%.
  const k = kq(100, 0, 20, 200, 50, 90)
  assert.equal(k.ty_le_tan_thanh, 83.33)
  assert.equal(k.thong_qua, false)
})

test('còn thiếu bao nhiêu m² nữa mới đủ dự họp', () => {
  // Ban quản trị đi gõ cửa từng nhà cần con số này, không cần phần trăm.
  assert.equal(thieuDeDuHop(kq(30, 0, 0, 200), 50), 70)
  assert.equal(thieuDeDuHop(kq(100, 50, 0, 200), 50), 0)
  // Đủ rồi thì không trả về số âm — "còn thiếu -30 m²" là câu vô nghĩa.
  assert.equal(thieuDeDuHop(kq(150, 40, 0, 200), 50), 0)
})

test('thanh kết quả vẽ theo TOÀN KHU nên phần chưa bỏ phiếu hiện ra', () => {
  // Vẽ theo diện tích đã bỏ thì thanh luôn đầy và giấu mất phần lớn nhất của
  // câu chuyện: 250/400 m² chưa ai đụng tới.
  const d = doanThanh(kq(100, 50, 0, 400))
  const chuaBo = d.find((x) => x.khoa === 'chua_bo')!
  assert.equal(chuaBo.m2, 250)
  assert.equal(chuaBo.pt, 62.5)
  assert.equal(d.reduce((s, x) => s + x.pt, 0), 100)
  for (const x of d) assert.ok(NHAN_DOAN[x.khoa], `thiếu nhãn cho ${x.khoa}`)
})

test('trạng thái: hủy thắng đóng, đóng thắng mở', () => {
  assert.equal(trangThaiBQ({ huy_luc: null, dong_luc: null }), 'dang_mo')
  assert.equal(trangThaiBQ({ huy_luc: null, dong_luc: 'x' }), 'da_dong')
  assert.equal(trangThaiBQ({ huy_luc: 'y', dong_luc: 'x' }), 'da_huy')
})

test('nhắc đúng số căn còn thiếu phiếu của chính mình', () => {
  const ds = [
    { ma_can: 'A-01.01', dien_tich: 120, da_bo: false },
    { ma_can: 'A-02.03', dien_tich: 85.5, da_bo: false },
    { ma_can: 'A-03.01', dien_tich: 60, da_bo: true },
  ]
  assert.equal(loiConCanChuaBo([ds[2]]), null)
  assert.match(loiConCanChuaBo([ds[0], ds[2]])!, /Căn A-01\.01 \(120 m²\)/)
  assert.match(loiConCanChuaBo(ds)!, /2 căn/)
  assert.match(loiConCanChuaBo(ds)!, /205,5 m²/)
})

test('số liệu in ra theo lối Việt Nam', () => {
  assert.equal(m2(1234.5), '1.234,5 m²')
  assert.equal(phanTram(66.67), '66,67%')
  assert.equal(phanTram(75), '75%')
})
