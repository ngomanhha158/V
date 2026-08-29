'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Field, Hop, Input } from '@/components/ui'
import { IcTrai } from '@/components/icons'

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
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mb-4 inline-grid size-12 place-items-center rounded-xl bg-brand text-lg font-bold text-on-brand">
            VB
          </span>
          <h1 className="text-xl font-semibold text-ink">Đăng nhập VBuilding</h1>
          <p className="mt-1.5 text-[0.8125rem] text-muted">
            {sent
              ? `Mã xác thực đã gửi tới ${phone}`
              : 'Nhập số điện thoại đã đăng ký với ban quản lý'}
          </p>
        </div>

        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); sent ? verify() : send() }}
          >
            <Field label="Số điện thoại">
              <Input
                inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxx"
                className="num"
                value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent || busy}
              />
            </Field>

            {sent && (
              <Field label="Mã OTP" hint="Sáu chữ số vừa gửi qua tin nhắn">
                <Input
                  inputMode="numeric" autoComplete="one-time-code" placeholder="••••••"
                  className="num tracking-[0.4em]" autoFocus
                  value={code} onChange={(e) => setCode(e.target.value)} disabled={busy}
                />
              </Field>
            )}

            {error && <Hop tone="xau" title="Không đăng nhập được">{error}</Hop>}

            <Button
              type="submit" dang="chinh" className="w-full"
              disabled={busy || (sent ? code.length < 4 : phone.length < 9)}
            >
              {busy ? 'Đang xử lý…' : sent ? 'Xác nhận' : 'Gửi mã OTP'}
            </Button>

            {sent && !busy && (
              <button
                type="button"
                onClick={() => { setSent(false); setCode(''); setError(null) }}
                className="inline-flex w-full items-center justify-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-ink"
              >
                <IcTrai width={14} height={14} /> Đổi số điện thoại
              </button>
            )}
          </form>
        </div>

        <p className="mt-5 text-center text-[0.75rem] leading-relaxed text-faint">
          Chưa có tài khoản? Số điện thoại phải được ban quản lý đăng ký trước.
          Liên hệ BQL tòa nhà của bạn.
        </p>
      </div>
    </div>
  )
}
