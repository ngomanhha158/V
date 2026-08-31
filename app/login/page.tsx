'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cachDangNhap } from '@/lib/auth-method'
import { normalizeEmail, toE164VN } from '@/lib/phone'
import { dichLoiAuth } from '@/lib/auth-loi'
import { Button, Field, Hop, Input } from '@/components/ui'
import { IcTrai } from '@/components/icons'

const LOI_URL: Record<string, string> = {
  thieu_ma: 'Link trong email không hợp lệ. Thử gửi lại mã.',
  het_han: 'Link đã hết hạn hoặc đã dùng rồi. Gửi lại mã mới.',
}

/**
 * Hai lối vào, cùng một tài khoản.
 *
 * `ma` — mã một lần gửi qua email/SMS: mặc định cho cư dân vì không phải nhớ gì.
 * `matkhau` — dành cho người dùng thường xuyên (ban quản lý) và cho lúc hạn gửi
 * thư của dự án đã cạn. Mã một lần phụ thuộc vào việc thư đi được; mật khẩu thì
 * không, nên đây cũng là đường vào lúc SMTP hỏng.
 */
type CheDo = 'ma' | 'matkhau'

function LoginForm() {
  const cach = cachDangNhap()
  const laEmail = cach === 'email'

  const [cheDo, setCheDo] = useState<CheDo>('ma')
  const [danhTinh, setDanhTinh] = useState('')
  const [code, setCode] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [daGui, setDaGui] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const loiUrl = LOI_URL[useSearchParams().get('loi') ?? '']

  const laMatKhau = cheDo === 'matkhau'
  const tenDanhTinh = laEmail ? 'email' : 'số điện thoại'

  /** Chuẩn hóa trước khi gửi đi. Trả null nghĩa là người dùng gõ sai. */
  const chuanHoa = () => (laEmail ? normalizeEmail(danhTinh) : toE164VN(danhTinh))

  const loiDanhTinh = () =>
    setError(laEmail
      ? 'Địa chỉ email không hợp lệ.'
      : 'Số điện thoại không hợp lệ. Nhập số di động 10 chữ số, ví dụ 0901234567.')

  async function gui() {
    const v = chuanHoa()
    if (!v) return loiDanhTinh()
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
    if (error) return setError(dichLoiAuth(error))
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
    if (error) return setError(dichLoiAuth(error))
    router.replace('/')
  }

  async function dangNhapMatKhau() {
    const v = chuanHoa()
    if (!v) return loiDanhTinh()
    setBusy(true); setError(null)
    const { error } = await createClient().auth.signInWithPassword(
      laEmail ? { email: v, password: matKhau } : { phone: v, password: matKhau },
    )
    setBusy(false)
    // 'matkhau': cùng mã invalid_credentials nhưng lời khuyên phải khác.
    if (error) return setError(dichLoiAuth(error, 'matkhau'))
    router.replace('/')
  }

  /** Đổi lối vào thì dọn sạch trạng thái của lối cũ, không để lẫn. */
  function doiCheDo(sang: CheDo) {
    setCheDo(sang)
    setDaGui(false); setCode(''); setMatKhau(''); setError(null)
  }

  const guiDi = () => { laMatKhau ? dangNhapMatKhau() : daGui ? xacNhan() : gui() }

  const khoaNut = busy || (laMatKhau
    ? danhTinh.length < 5 || matKhau.length < 6
    : daGui ? code.length < 4 : danhTinh.length < 5)

  const nhan = busy ? 'Đang xử lý…'
    : laMatKhau ? 'Đăng nhập'
      : daGui ? 'Xác nhận' : 'Gửi mã đăng nhập'

  const phuDe = laMatKhau
    ? `Nhập ${tenDanhTinh} và mật khẩu ban quản lý đã đặt`
    : daGui
      ? `Đã gửi mã tới ${danhTinh}`
      : `Nhập ${tenDanhTinh} đã đăng ký với ban quản lý`

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mb-4 inline-grid size-12 place-items-center rounded-xl bg-brand text-lg font-bold text-on-brand">
            VB
          </span>
          <h1 className="text-xl font-semibold text-ink">Đăng nhập VBuilding</h1>
          <p className="mt-1.5 text-[0.8125rem] text-muted">{phuDe}</p>
        </div>

        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); guiDi() }}>
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

            {laMatKhau && (
              <Field label="Mật khẩu">
                <Input
                  type="password" autoComplete="current-password" placeholder="••••••••"
                  value={matKhau} onChange={(e) => setMatKhau(e.target.value)} disabled={busy}
                />
              </Field>
            )}

            {!laMatKhau && daGui && (
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

            {(error || (!daGui && !laMatKhau && loiUrl)) && (
              <Hop tone="xau" title="Không đăng nhập được">{error ?? loiUrl}</Hop>
            )}

            <Button type="submit" dang="chinh" className="w-full" disabled={khoaNut}>
              {nhan}
            </Button>

            {!laMatKhau && daGui && !busy && (
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

          {!busy && (
            <div className="mt-4 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => doiCheDo(laMatKhau ? 'ma' : 'matkhau')}
                className="w-full text-center text-[0.8125rem] font-medium text-brand hover:underline"
              >
                {laMatKhau
                  ? `Quay lại nhận mã qua ${laEmail ? 'email' : 'tin nhắn'}`
                  : 'Đăng nhập bằng mật khẩu'}
              </button>
            </div>
          )}
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
