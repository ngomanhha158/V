'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  // VN nhập 0912..., Supabase cần E.164 +84912...
  const e164 = (v: string) => (v.startsWith('0') ? '+84' + v.slice(1) : v)

  async function send() {
    setBusy(true); setError(null)
    // Tạo client trong handler, không ở thân component: lúc prerender không có
    // biến môi trường nên createClient() ở render sẽ làm chết build.
    const { error } = await createClient().auth.signInWithOtp({ phone: e164(phone) })
    setBusy(false)
    if (error) return setError(error.message)
    setSent(true)
  }

  async function verify() {
    setBusy(true); setError(null)
    const { error } = await createClient().auth.verifyOtp({
      phone: e164(phone), token: code, type: 'sms',
    })
    setBusy(false)
    if (error) return setError(error.message)
    router.replace('/')
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Đăng nhập</h1>
      <input
        className="w-full rounded border p-3"
        inputMode="tel" placeholder="Số điện thoại"
        value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent}
      />
      {sent && (
        <input
          className="w-full rounded border p-3"
          inputMode="numeric" placeholder="Mã OTP"
          value={code} onChange={(e) => setCode(e.target.value)}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        className="w-full rounded bg-neutral-900 p-3 text-white disabled:opacity-50"
        onClick={sent ? verify : send}
        disabled={busy || (sent ? code.length < 4 : phone.length < 9)}
      >
        {busy ? 'Đang xử lý…' : sent ? 'Xác nhận' : 'Gửi mã OTP'}
      </button>
    </main>
  )
}
