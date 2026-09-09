// Chạy: npm run test:js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chonKhu, docToken, LoiCauHinh } from './ket-noi.ts'
import type { Client } from '../lib/db/postgrest.ts'

/** Client giả: chỉ cần .from('projects').select().order() trả về gì đó. */
function dbGia(ds: { id: string; name: string }[] | null, loi?: { code: string; message: string }) {
  return {
    from: () => ({
      select: () => ({ order: async () => ({ data: ds, error: loi ?? null }) }),
    }),
  } as unknown as Client
}

const KHU = [
  { id: 'a', name: 'Sunrise Riverside' },
  { id: 'b', name: 'Sunrise City' },
  { id: 'c', name: 'Green Park' },
]

test('thiếu VBUILDING_TOKEN -> nói rõ phát ở đâu, và đừng đặt khoá ký ở máy này', () => {
  const cu = process.env.VBUILDING_TOKEN
  delete process.env.VBUILDING_TOKEN
  try {
    assert.throws(() => docToken(), (e: Error) => {
      assert.ok(e instanceof LoiCauHinh)
      assert.match(e.message, /tao-token-mcp/)
      // Điểm chính: câu lỗi phải CHẶN người dùng đi đường tắt nguy hiểm nhất.
      assert.match(e.message, /Đừng đặt AUTH_JWT_SECRET/)
      return true
    })
  } finally { if (cu) process.env.VBUILDING_TOKEN = cu }
})

test('dán nhầm khoá ký vào chỗ token -> bắt tại chỗ, không đẩy sang PostgREST', () => {
  const cu = process.env.VBUILDING_TOKEN
  // Chuỗi hex 64 ký tự: đúng hình dạng AUTH_JWT_SECRET mà runbook bảo tạo.
  process.env.VBUILDING_TOKEN = 'a'.repeat(64)
  try {
    assert.throws(() => docToken(), (e: Error) => {
      // Nếu để lọt, PostgREST trả "JWSError" — đúng và vô dụng với người đang
      // dán nhầm. Câu ở đây phải gọi tên đúng thứ họ vừa làm.
      assert.match(e.message, /AUTH_JWT_SECRET/)
      return true
    })
  } finally {
    if (cu) process.env.VBUILDING_TOKEN = cu; else delete process.env.VBUILDING_TOKEN
  }
})

test('một khu thì tự lấy, không bắt gõ tên', async () => {
  const k = await chonKhu(dbGia([KHU[2]]))
  assert.equal(k.name, 'Green Park')
})

test('NHIỀU khu mà không nói tên -> DỪNG và liệt kê, không chọn hộ', async () => {
  // Đây là điểm chính của cả hàm. "Khu đầu bảng" khi có ba khu là chọn bừa, và
  // nó im lặng: người hỏi "công nợ bao nhiêu" nhận về số của một khu họ không
  // hề nghĩ tới, mà không có gì trên màn hình nói ra điều đó.
  await assert.rejects(() => chonKhu(dbGia(KHU)), (e: Error) => {
    assert.match(e.message, /Sunrise Riverside/)
    assert.match(e.message, /Green Park/)
    return true
  })
})

test('tên khớp một phần thì nhận, khớp nhiều thì bắt nói rõ hơn', async () => {
  assert.equal((await chonKhu(dbGia(KHU), 'green')).id, 'c')
  assert.equal((await chonKhu(dbGia(KHU), 'riverside')).id, 'a')
  // "sunrise" khớp cả hai -> không được đoán.
  await assert.rejects(() => chonKhu(dbGia(KHU), 'sunrise'), /khớp nhiều khu/)
  await assert.rejects(() => chonKhu(dbGia(KHU), 'khong-co'), /Đang có:/)
})

test('không thấy khu nào -> chỉ đúng chỗ phải sửa quyền', async () => {
  await assert.rejects(() => chonKhu(dbGia([])), /staff_assignments/)
})
