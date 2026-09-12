import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Trong } from '@/components/ui'
import { FormLienLac, FormMatKhau } from './form'

export const dynamic = 'force-dynamic'

export default async function HoSo() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return <Trong title="Chưa đăng nhập" />

  const [{ data: hs, error }, { data: daCo }] = await Promise.all([
    db.from('profiles').select('full_name, email, phone').eq('id', user.id).maybeSingle(),
    db.rpc('auth_co_mat_khau'),
  ])

  // Không nuốt lỗi: một form hiện ô trống vì đọc hỏng trông y hệt một tài khoản
  // chưa khai gì, mà bấm Lưu ở trạng thái đó là ghi đè thông tin thật bằng
  // khoảng trắng.
  if (error || !hs) {
    return (
      <div className="space-y-5">
        <PageHead title="Tài khoản" />
        <Hop tone="xau" title="Không đọc được hồ sơ">
          {error?.message ?? 'Không tìm thấy hồ sơ của bạn.'}
        </Hop>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHead
        title="Tài khoản"
        sub="Thông tin đăng nhập và liên hệ của riêng bạn"
      />

      <Card>
        <CardHead
          title="Thông tin liên hệ"
          sub="Email ở đây cũng là địa chỉ nhận mã đăng nhập"
        />
        <FormLienLac
          hoTen={hs.full_name ?? ''}
          email={hs.email ?? ''}
          phone={hs.phone ?? ''}
        />
      </Card>

      <Card>
        <CardHead
          title={daCo ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
          sub={daCo
            ? 'Đổi xong thì mọi mã đăng nhập một lần đang treo sẽ hết hiệu lực'
            : 'Có mật khẩu thì vào app không phải chờ thư'}
        />
        <FormMatKhau daCo={!!daCo} />
      </Card>
    </div>
  )
}
