import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LY_DO_THE, NHAN_VAI_CAN, TEN_VAI_TRO, tenVaiTro, vaiCan } from './vai-tro.ts'
import { TEN_GIA_TRI } from './nhat-ky.ts'

test('mọi vai trò trong enum unit_role đều có nhãn', () => {
  // Thiếu một cái là màn nào đó hiện đúng chuỗi mã máy ra cho cư dân đọc.
  for (const v of ['owner', 'authorized', 'tenant', 'family']) {
    assert.ok(NHAN_VAI_CAN[v], `thiếu nhãn cho ${v}`)
  }
})

test('nhãn vai trò KHỚP với nhật ký kiểm toán', () => {
  // Đây là lỗi đã có thật trước khi gom về một chỗ: cùng `family` mà màn trang
  // chủ gọi là "Thành viên", nhật ký gọi là "Người nhà". Hai tên cho một thứ
  // thì người đọc tưởng là hai thứ, và sổ kiểm toán mất luôn tác dụng đối chiếu.
  for (const [ma, nhan] of Object.entries(NHAN_VAI_CAN)) {
    assert.equal(TEN_GIA_TRI[ma], nhan, `lệch nhãn cho ${ma}`)
  }
})

test('vai trò NHÂN SỰ và vai trò TRONG CĂN là hai bộ tách biệt', () => {
  // Hai thứ khác nhau, cùng nằm một file. Trùng khóa giữa hai bộ là một màn
  // nào đó tra nhầm bảng rồi gọi bảo vệ là chủ hộ.
  for (const k of Object.keys(TEN_VAI_TRO)) {
    assert.equal(NHAN_VAI_CAN[k], undefined, `khóa ${k} nằm ở cả hai bộ`)
  }
  assert.equal(tenVaiTro('security'), 'Bảo vệ')
  assert.equal(tenVaiTro('mot_vai_tro_moi'), 'mot_vai_tro_moi')
})

test('vai trò lạ thì hiện nguyên văn, không thành trống', () => {
  assert.equal(vaiCan('mot_vai_tro_moi'), 'mot_vai_tro_moi')
  assert.equal(vaiCan(null), '—')
  assert.equal(vaiCan(''), '—')
})

test('mọi lý do mà kiem_the() trả về đều có câu tiếng Việt', () => {
  // Danh sách này là hợp đồng với nhánh CASE trong hàm kiem_the ở schema.sql.
  // Thêm lý do bên SQL mà quên bên này là bảo vệ nhận một chuỗi mã máy.
  for (const l of ['het_han', 'chua_toi_han', 'cho_duyet', 'da_thu_hoi', 'ngung', 'khong_thuoc']) {
    const c = LY_DO_THE[l]
    assert.ok(c && c.length > 20, `thiếu hoặc quá ngắn: ${l}`)
    assert.doesNotMatch(c, /[a-z]_[a-z]/, `${l} lộ mã máy: ${c}`)
  }
})

test('mỗi lý do nói một việc khác nhau', () => {
  const c = Object.values(LY_DO_THE)
  assert.equal(new Set(c).size, c.length, 'có hai lý do dùng chung một câu')
})
