import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong } from '@/components/ui'
import { vaiCan } from '@/lib/vai-tro'
import { TheSong } from './the-song'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()

  // Đọc thẳng unit_memberships: policy membership_read cho mỗi người thấy dòng
  // của chính mình. Lọc hạn ở đây cho khớp current_unit_ids() — thẻ chỉ hiện
  // cho căn ĐANG có hiệu lực, không hiện cho hợp đồng đã hết.
  const homNay = new Date().toISOString().slice(0, 10)
  const { data: ds, error } = await db
    .from('unit_memberships')
    .select('unit_id, role, valid_to, units(code, buildings(name))')
    .eq('user_id', user?.id ?? '')
    .eq('status', 'active')
    .lte('valid_from', homNay)
    .or(`valid_to.is.null,valid_to.gte.${homNay}`)
    .order('unit_id')

  return (
    <div className="space-y-5">
      <PageHead
        title="Thẻ cư dân"
        sub="Đưa mã cho bảo vệ quét khi ra vào — không cần mang thẻ nhựa"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được thẻ">
          {error.code === '42P01'
            ? 'Phần thẻ cư dân chưa có trên database. Chạy lại schema.sql.'
            : error.message}
        </Hop>
      )}

      {!error && (ds ?? []).length === 0 && (
        <Trong title="Chưa có thẻ nào">
          Thẻ hiện ra khi bạn đã được duyệt là thành viên của một căn hộ. Nếu vừa
          gửi yêu cầu gia nhập, chờ ban quản lý duyệt.
        </Trong>
      )}

      {(ds ?? []).map((m) => {
        const u = Array.isArray(m.units) ? m.units[0] : m.units
        const b = u && (Array.isArray(u.buildings) ? u.buildings[0] : u.buildings)
        return (
          <Card key={m.unit_id}>
            <CardHead
              title={u?.code ?? 'Căn hộ'}
              sub={b?.name ?? undefined}
              right={<Pill tone="tot">{vaiCan(m.role)}</Pill>}
            />
            <div className="p-4">
              <TheSong unit={m.unit_id} />
              {m.valid_to && (
                // Nói ngày hết hạn ngay trên thẻ. Người thuê biết trước hôm nào
                // thẻ ngừng chạy thì họ đi gia hạn, chứ không đứng ở cửa mới biết.
                <p className="mt-3 text-center text-[0.75rem] text-faint">
                  Hợp đồng đến hết ngày{' '}
                  {new Date(`${m.valid_to}T00:00:00+07:00`).toLocaleDateString('vi-VN', {
                    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
                  })}
                  {' '}— sau ngày đó thẻ tự ngừng.
                </p>
              )}
            </div>
          </Card>
        )
      })}

      <Hop tone="trung" title="Vì sao mã lại đổi liên tục">
        Mã chỉ sống một phút, nên ảnh chụp màn hình gửi cho người khác dùng không
        được. Và thẻ không nằm trong máy bạn: mỗi lần quét, hệ thống hỏi lại
        database xem hợp đồng còn hiệu lực không — nên trả nhà xong là thẻ ngừng
        ngay, không phải chờ ai thu hồi.
      </Hop>
    </div>
  )
}
