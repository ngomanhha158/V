'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { cachDangNhap } from '@/lib/auth-method'
import { normalizeEmail, toE164VN } from '@/lib/phone'
import { BIET_TRANG_THAI, goYNguoiSua, loiDangNhap } from '@/lib/auth-loi'
import { Button, Field, Hop, Input } from '@/components/ui'
import { IcTrai } from '@/components/icons'

// Người tới đây từ một LINK hỏng trong thư, không phải từ ô nhập mã. Câu chữ
// phải nói về cái link chứ không phải về dãy số họ chưa hề gõ.
const LOI_URL: Record<string, string> = {
  thieu_ma: 'Link trong thư không hợp lệ. Thử gửi lại mã.',
  sai: 'Link trong thư không còn đúng. Gửi lại mã mới.',
  het_han: 'Link đã hết hạn hoặc đã dùng rồi. Gửi lại mã mới.',
  qua_nhieu: 'Tài khoản này vừa bị nhập sai quá nhiều lần nên tạm khóa. '
    + 'Chờ 10 phút rồi thử lại.',
}

/** Gọi một endpoint đăng nhập. Trả về trạng thái mà lib/auth-loi.ts hiểu. */
/** Máy chủ gửi kèm `cau` (câu cho người dùng) và `goY` (gợi ý cho người sửa).
 *  Bản cũ của route chưa gửi hai thứ đó, nên vẫn để optional. */
async function goi(
  duong: string, than: object,
): Promise<{ tt: string; giay?: number; cau?: string; goY?: string | null; maLoi?: string }> {
  try {
    const r = await fetch(duong, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(than),
    })
    return (await r.json()) as { tt: string; giay?: number; cau?: string; goY?: string | null; maLoi?: string }
  } catch {
    // Mất mạng giữa chừng. Phân biệt với lỗi máy chủ, vì hai bên làm hai việc
    // khác nhau: một bên bật lại wifi, một bên gọi ban quản lý.
    return { tt: 'mang', cau: loiDangNhap('mang') }
  }
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
  const [goY, setGoY] = useState<string | null>(null)
  // Mã lỗi thô của PostgREST, in kèm gợi ý. Gợi ý là SUY LUẬN từ chuỗi lỗi;
  // mã này là thứ máy chủ thật sự trả về. Khi hai cái nói khác nhau thì mã
  // đúng, và người đọc cần thấy được điều đó ngay trên màn hình.
  const [maLoi, setMaLoi] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const loiUrl = LOI_URL[useSearchParams().get('loi') ?? '']

  const laMatKhau = cheDo === 'matkhau'
  const tenDanhTinh = laEmail ? 'email' : 'số điện thoại'

  /** Chuẩn hóa trước khi gửi đi. Trả null nghĩa là người dùng gõ sai. */
  const chuanHoa = () => (laEmail ? normalizeEmail(danhTinh) : toE164VN(danhTinh))

  const loiDanhTinh = () =>
    setError(laEmail
      ? 'Địa chỉ email không hợp lệ.'
      : 'Số điện thoại không hợp lệ. Nhập số di động 10 chữ số, ví dụ 0901234567.')

  /**
   * Hiện lỗi: ƯU TIÊN câu chữ máy chủ gửi kèm.
   *
   * Tra ở trình duyệt là cách cũ, và nó hỏng đúng lúc cần nhất: máy chủ vừa
   * thêm một trạng thái, còn tab người dùng vẫn giữ bản JS trước đó — trạng
   * thái mới tra không ra, rơi vào "có lỗi không rõ, thử lại giúp em", mà thử
   * lại là đúng thứ không bao giờ qua được. Gặp thật ngay lần deploy đầu sau
   * khi thêm ba nhánh he_thong_*.
   */
  function hienLoi(r: { tt: string; giay?: number; cau?: string; goY?: string | null; maLoi?: string }) {
    setMaLoi(r.maLoi ?? null)
    if (r.cau) { setError(r.cau); setGoY(r.goY ?? null); return }
    // Máy chủ bản cũ: tra bảng như trước. Nhưng nếu trạng thái LẠ HẲN thì nói
    // thẳng là bản trong máy đã cũ — chứ không bảo họ thử lại.
    if (!BIET_TRANG_THAI.has(r.tt)) {
      setError('Bản trong trình duyệt đã cũ hơn máy chủ nên chưa đọc được câu trả lời. '
        + 'Tải lại trang (Ctrl+Shift+R) rồi thử lại.')
      setGoY(null); setMaLoi(null); return
    }
    setError(loiDangNhap(r.tt, r.giay)); setGoY(goYNguoiSua(r.tt))
  }

  /** Vào được rồi thì tải lại cả trang chứ không router.replace: cookie phiên
   *  vừa được máy chủ đặt, mà bộ nhớ đệm RSC của lần điều hướng trước thì chưa
   *  biết gì về nó. Đi bằng router là có lúc rơi vào màn "chưa đăng nhập" ngay
   *  sau khi đăng nhập thành công. */
  const vaoNha = () => { window.location.href = '/' }

  async function gui() {
    const v = chuanHoa()
    if (!v) return loiDanhTinh()
    setBusy(true); setError(null); setGoY(null); setMaLoi(null)
    const r = await goi('/api/auth/ma', { danhTinh: v })
    const { tt } = r
    setBusy(false)
    if (tt === 'ok') return setDaGui(true)
    hienLoi(r)
    // Bị chặn vì vừa gửi rồi: mở luôn ô nhập mã. Họ ĐANG cầm một mã trong tay,
    // bắt quay lại màn nhập email là bắt họ chờ hết một chu kỳ vô ích.
    if (tt === 'cho') setDaGui(true)
  }

  async function xacNhan() {
    const v = chuanHoa()
    if (!v) return
    setBusy(true); setError(null); setGoY(null); setMaLoi(null)
    const r = await goi('/api/auth/vao', { danhTinh: v, ma: code })
    const { tt } = r
    if (tt === 'ok') return vaoNha()
    setBusy(false)
    hienLoi(r)
  }

  async function dangNhapMatKhau() {
    const v = chuanHoa()
    if (!v) return loiDanhTinh()
    setBusy(true); setError(null); setGoY(null); setMaLoi(null)
    const r = await goi('/api/auth/vao', { danhTinh: v, matKhau })
    const { tt } = r
    if (tt === 'ok') return vaoNha()
    setBusy(false)
    hienLoi(r)
  }

  /** Đổi lối vào thì dọn sạch trạng thái của lối cũ, không để lẫn. */
  function doiCheDo(sang: CheDo) {
    setCheDo(sang)
    setDaGui(false); setCode(''); setMatKhau(''); setError(null); setGoY(null); setMaLoi(null)
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

            {/* Khối riêng cho NGƯỜI SỬA, chỉ hiện ở ba nhánh sự cố hệ thống.
                Người đang đứng trước màn này lúc cả tòa không ai vào được
                thường chính là người dựng hệ thống — bảo họ "báo ban quản lý"
                là đúng câu và vô dụng. Trước đây họ phải mở log máy chủ mới
                biết là khoá lệch, hay thiếu lớp đăng nhập, hay không nối được.
                Cả ba ra cùng một câu.

                Cố ý KHÔNG hiện ở lỗi sai mật khẩu: dựng một khối kỹ thuật ở đó
                là dọa người dùng bằng một sự cố không tồn tại. */}
            {goY && (
              <div className="rounded-card border border-line bg-sunken px-3.5 py-3">
                <p className="text-[0.75rem] font-semibold tracking-wide text-muted uppercase">
                  Dành cho người quản trị
                </p>
                <p className="num mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
                  {goY}
                </p>
                {maLoi && (
                  <p className="num mt-2 text-[0.75rem] text-faint">
                    Máy chủ dữ liệu trả mã: <span className="font-semibold">{maLoi}</span>
                    {' '}— nếu mã này không khớp với gợi ý ở trên thì tin mã.
                  </p>
                )}
              </div>
            )}

            <Button type="submit" dang="chinh" className="w-full" disabled={khoaNut}>
              {nhan}
            </Button>

            {!laMatKhau && daGui && !busy && (
              <button
                type="button"
                onClick={() => { setDaGui(false); setCode(''); setError(null); setGoY(null); setMaLoi(null) }}
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
