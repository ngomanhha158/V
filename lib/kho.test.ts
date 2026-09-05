import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  NHAN_LOAI, TONE_LOAI, dauPhieu, giaBinhQuan, loiTon, soVN, soatPhieuXuat, tongPhieu,
  type Ton,
} from './kho.ts'

const t = (p: Partial<Ton>): Ton => ({
  id: 'id-led', ma: 'LED9', ten: 'Bóng LED 9W', don_vi: 'cái',
  ton: 40, ton_toi_thieu: 10, don_gia: 22_000, gia_tri: 880_000, sap_het: false, ...p,
})

test('nhãn loại phiếu phủ đúng ràng buộc trong SQL', () => {
  const sql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
  const m = sql.match(/loai\s+text not null check \(loai in \('nhap'[^)]*\)\)/)
  assert.ok(m, 'không tìm thấy ràng buộc loai của phieu_kho')
  const trong = m![0].match(/'([a-z_]+)'/g)!.map((x) => x.replace(/'/g, ''))
  assert.deepEqual([...trong].sort(), Object.keys(NHAN_LOAI).sort())
  for (const l of trong) assert.ok(TONE_LOAI[l as keyof typeof TONE_LOAI], l)
})

test('dấu phiếu: nhập cộng, xuất trừ, kiểm kê hai chiều', () => {
  assert.equal(dauPhieu('nhap'), '+')
  assert.equal(dauPhieu('xuat'), '−')
  // Kiểm kê có thể âm hoặc dương, nên một dấu cố định là nói dối một nửa số ca.
  assert.equal(dauPhieu('kiem_ke'), '±')
})

test('"còn 3" chỉ có nghĩa khi nói kèm ngưỡng và thiếu bao nhiêu', () => {
  const canh = loiTon(t({ ton: 8, ton_toi_thieu: 10 }))
  assert.equal(canh.tone, 'canh')
  assert.match(canh.loi, /dưới mức tối thiểu 10/)
  // Người đi mua cần con số "mua thêm ít nhất bao nhiêu", không phải tự trừ.
  assert.match(canh.loi, /ít nhất 3 cái/)

  assert.equal(loiTon(t({ ton: 40 })).tone, 'tot')
  // Đúng bằng ngưỡng vẫn là cảnh báo: hết tới nơi rồi.
  assert.equal(loiTon(t({ ton: 10, ton_toi_thieu: 10 })).tone, 'canh')
})

test('hết sạch nói rõ hệ quả: mọi lần xuất bị chặn', () => {
  const r = loiTon(t({ ton: 0 }))
  assert.equal(r.tone, 'xau')
  assert.match(r.loi, /bị chặn/)
})

test('soát phiếu xuất chặn ngay lúc gõ, kèm con số còn lại', () => {
  // Để database chặn là đúng, nhưng người đứng ở kho đang cầm tuốc nơ vít —
  // họ cần biết ngay, không phải sau khi bấm.
  const ton = new Map([['a', t({ ton: 3, ten: 'Băng tan', don_vi: 'cuộn' })]])
  const loi = soatPhieuXuat([{ vat_tu: 'a', so_luong: 5 }], ton)
  assert.equal(loi.length, 1)
  assert.match(loi[0], /chỉ còn 3 cuộn/)
  assert.equal(soatPhieuXuat([{ vat_tu: 'a', so_luong: 3 }], ton).length, 0)
  // Vật tư không có trong danh mục cũng phải kêu, không im lặng bỏ qua.
  assert.equal(soatPhieuXuat([{ vat_tu: 'z', so_luong: 1 }], ton).length, 1)
  // Dòng chưa gõ số lượng thì chưa phải lỗi.
  assert.equal(soatPhieuXuat([{ vat_tu: 'a', so_luong: 0 }], ton).length, 0)
})

test('tổng phiếu xuất tính theo giá KHO, không theo giá người gõ', () => {
  const ton = new Map([
    ['a', t({ don_gia: 22_000 })],
    ['b', t({ don_gia: 8_000 })],
  ])
  assert.equal(tongPhieu([{ vat_tu: 'a', so_luong: 2 }, { vat_tu: 'b', so_luong: 1 }], ton), 52_000)
  assert.equal(tongPhieu([{ vat_tu: 'a', so_luong: 0 }], ton), 0)
  assert.equal(tongPhieu([{ vat_tu: 'z', so_luong: 5 }], ton), 0)
})

test('bình quân gia quyền: lô nhỏ mua đắt không kéo giá cả kho lên', () => {
  // 40 cái giá 20.000 + 20 cái giá 26.000 = 60 cái giá 22.000.
  assert.equal(giaBinhQuan(40, 20_000, 20, 26_000), 22_000)
  // Lấy thẳng giá lô mới sẽ ra 26.000 — sai 4.000 đồng trên mỗi cái trong kho.
  assert.notEqual(giaBinhQuan(40, 20_000, 20, 26_000), 26_000)
  // Kho rỗng thì giá kho chính là giá lô đầu.
  assert.equal(giaBinhQuan(0, 0, 10, 15_000), 15_000)
})

test('số lượng lẻ hiện đúng, số tròn không có ".00" thừa', () => {
  assert.equal(soVN(12), '12')
  assert.equal(soVN(12.5), '12,5')
  assert.equal(soVN(1234), '1.234')
})
