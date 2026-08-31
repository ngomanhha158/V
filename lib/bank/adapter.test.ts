import test from 'node:test'
import assert from 'node:assert/strict'
import { docWebhook, gioVN } from './adapter.ts'

test('SePay: mốc thời gian không có múi giờ được hiểu là giờ VN', () => {
  // 14:02:37 giờ VN = 07:02:37 UTC. Hiểu nhầm thành UTC là lệch 7 tiếng, đủ
  // để một giao dịch rơi sang ngày khác — và sang THÁNG khác nếu là ngày 1.
  assert.equal(gioVN('2023-03-25 14:02:37'), '2023-03-25T07:02:37.000Z')
  assert.equal(gioVN('2026-09-01 05:30:00'), '2026-08-31T22:30:00.000Z')
})

test('mốc thời gian đã có múi giờ thì giữ nguyên, không cộng thêm 7 tiếng', () => {
  assert.equal(gioVN('2023-03-25T07:02:37Z'), '2023-03-25T07:02:37.000Z')
  assert.equal(gioVN('2023-03-25T14:02:37+07:00'), '2023-03-25T07:02:37.000Z')
})

test('ngày trần (Casso hay gửi) tính từ 00:00 giờ VN', () => {
  assert.equal(gioVN('2020-11-02'), '2020-11-01T17:00:00.000Z')
})

const SEPAY = {
  id: 92704, gateway: 'Vietcombank', transactionDate: '2023-03-25 14:02:37',
  accountNumber: '0123499999', code: null, content: 'VB P1-10.01 202608',
  transferType: 'in', transferAmount: 2277000, accumulated: 19077000,
  subAccount: null, referenceCode: 'MBVCB.3278907687', description: 'CT DEN ...',
}

test('SePay: đọc đủ trường, id làm khóa chống bắn trùng', () => {
  const [g] = docWebhook('sepay', SEPAY)
  assert.equal(g.providerRef, '92704')
  assert.equal(g.bankRef, 'MBVCB.3278907687')
  assert.equal(g.amount, 2277000)
  assert.equal(g.content, 'VB P1-10.01 202608')
  assert.equal(g.accountNumber, '0123499999')
  assert.equal(g.paidAt, '2023-03-25T07:02:37.000Z')
})

test('SePay: TIỀN RA bị bỏ, không gạch vào công nợ cư dân', () => {
  assert.deepEqual(docWebhook('sepay', { ...SEPAY, transferType: 'out' }), [])
})

test('SePay: tài khoản ảo (subAccount) được ưu tiên hơn tài khoản tổng', () => {
  const [g] = docWebhook('sepay', { ...SEPAY, subAccount: '99988877' })
  assert.equal(g.accountNumber, '99988877')
})

test('SePay: content rỗng thì lùi về description, không mất nội dung', () => {
  const [g] = docWebhook('sepay', { ...SEPAY, content: '' })
  assert.equal(g.content, 'CT DEN ...')
})

test('SePay: số tiền rác thì ném lỗi thay vì ghi 0 đồng vào sổ', () => {
  assert.throws(() => docWebhook('sepay', { ...SEPAY, transferAmount: 'nhieu' }), /transferAmount/)
  assert.throws(() => docWebhook('sepay', { ...SEPAY, transferAmount: 0 }), /transferAmount/)
})

const CASSO = {
  error: 0,
  data: [
    { id: 1, when: '2026-08-20 09:15:00', amount: 200500, description: 'VB P1-10.01 202608',
      cusum_balance: 15900500, tid: 'TF80307914', subAccId: '123456789' },
    { id: 2, when: '2026-08-21 10:00:00', amount: -50000, description: 'Chi phi',
      cusum_balance: 15850500, tid: 'TF80307915', subAccId: '123456789' },
  ],
}

test('Casso: đọc cả lô, bỏ giao dịch tiền ra (số âm)', () => {
  const g = docWebhook('casso', CASSO)
  assert.equal(g.length, 1)
  assert.equal(g[0].providerRef, '1')
  assert.equal(g[0].bankRef, 'TF80307914')
  assert.equal(g[0].amount, 200500)
  assert.equal(g[0].paidAt, '2026-08-20T02:15:00.000Z')
})

test('Casso: thiếu mảng data là lỗi, không âm thầm coi như không có giao dịch', () => {
  assert.throws(() => docWebhook('casso', { error: 0 }), /data/)
})

test('hai nhà cung cấp cho ra CÙNG một dạng dữ liệu', () => {
  const a = docWebhook('sepay', SEPAY)[0]
  const b = docWebhook('casso', CASSO)[0]
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort())
})
