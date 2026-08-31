'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cachDangNhap } from '@/lib/auth-method'
import { normalizeEmail, toE164VN } from '@/lib/phone'
import { Button, Field, Hop, Input } from '@/components/ui'
import { IcTrai } from '@/components/icons'

const LOI_URL: Record<string, string> = {
  thieu_ma: 'Link trong email không hợp lệ. Thử gửi lại mã.',
  het_han: 'Link đã hết hạn hoặc đã dùng rồi. Gửi lại mã mới.',
}

function LoginForm() {
  const cach = cachDangNhap()
  const laEmail = cach === 'email'

  const [danhTinh, setDanhTinh] = useState('')
  const [code, setCode] = useState('')
  const [daGui, setDaGui] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const loiUrl = LOI_URL[useSearchParams().get('loi') ?? '']

  /** Chuẩn hóa trước khi gửi đi. Trả null nghĩa là người dùng gõ sai. */
  const chuanHoa = () => (laEmail ? normalizeEmail(danhTinh) : toE164VN(danhTinh))

  async function gui() {
    const v = chuanHoa()
    if (!v) {
      return setError(laEmail
        ? 'Địa chỉ email không hợp lệ.'
        : 'Số điện thoại không hợp lệ. Nhập số di động 10 chữ số, ví dụ 0901234567.')
    }
    setBusy(true); setError(null)
    // Tạo client trong handler, không ở thân component: lúc prerender không có
    // biến môi trường nên createClient() ở render sẽ làm chết build.
    const { error } = await createClient().auth.signInWithOtp(
      laEmail
        // emailRedirectTo: đích của LINK trong email, khớp với app/auth/confirm.
        // Không đặt thì link trỏ về Site URL và rơi vào trang không xử lý được.
        ? { email: v, options: { emailRedirectTo: `${location.origin}/auth/confirm` } }
        : { phone: v },
    )
    setBusy(false)
    if (error) return setError(error.message)
    setDaGui(true)
  }

  async function xacNhan() {
    const v = chuanHoa()
    if (!v) return
    setBusy(true); setError(null)
    const { error } = await createClient().auth.verifyOtp(
      laEmail ? { email: v, token: code, type: 'email' }
              : { phone: v, token: code, type: 'sms' },
    )
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
            {daGui
              ? `Đã gửi mã tới ${danhTinh}`
              : laEmail
                ? 'Nhập email đã đăng ký với ban quản lý'
                : 'Nhập số điện thoại đã đăng ký với ban quản lý'}
          </p>
        </div>

        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); daGui ? xacNhan() : gui() }}
          >
            <Field label={laEmail ? 'Địa chỉ email' : 'Số điện thoại'}>
              <Input
                type={laEmail ? 'email' : 'tel'}
                inputMode={laEmail ? 'email' : 'tel'}
                autoComplete={laEmail ? 'email' : 'tel'}
                placeholder={laEmail ? 'ten@example.com' : '09xx xxx xxx'}
                className={laEmail ? undefined : 'num'}
                value={danhTinh} onChange={(e) => setDanhTinh(e.target.value)}
                disabled={daGui || busy}
              />
            </Field>

            {daGui && (
              <Field
                label="Mã xác thực"
                hint={laEmail
                  ? 'Sáu chữ số trong email. Nếu email chỉ có đường link thì bấm thẳng vào link đó.'
                  : 'Sáu chữ số vừa gửi qua tin nhắn'}
              >
                <Input
                  inputMode="numeric" autoComplete="one-time-code" placeholder="••••••"
                  className="num tracking-[0.4em]" autoFocus
                  value={code} onChange={(e) => setCode(e.target.value)} disabled={busy}
                />
              </Field>
            )}

            {(error || (!daGui && loiUrl)) && (
              <Hop tone="xau" title="Không đăng nhập được">{error ?? loiUrl}</Hop>
            )}

            <Button
              type="submit" dang="chinh" className="w-full"
              disabled={busy || (daGui ? code.length < 4 : danhTinh.length < 5)}
            >
              {busy ? 'Đang xử lý…' : daGui ? 'Xác nhận' : 'Gửi mã đăng nhập'}
            </Button>

            {daGui && !busy && (
              <button
                type="button"
                onClick={() => { setDaGui(false); setCode(''); setError(null) }}
                className="inline-flex w-full items-center justify-center gap-1 text-[0.8125rem] font-medium text-muted hover:text-ink"
              >
                <IcTrai width={14} height={14} />
                {laEmail ? 'Đổi email' : 'Đổi số điện thoại'}
              </button>
            )}
          </form>
        </div>

        <p className="mt-5 text-center text-[0.75rem] leading-relaxed text-faint">
          Chưa có tài khoản? {laEmail ? 'Địa chỉ email' : 'Số điện thoại'} phải được
          ban quản lý đăng ký trước. Liên hệ BQL tòa nhà của bạn.
        </p>
      </div>
    </div>
  )
}

export default function Login() {
  // useSearchParams cần Suspense, nếu không Next từ chối build trang này.
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <LoginForm />
    </Suspense>
  )
}
