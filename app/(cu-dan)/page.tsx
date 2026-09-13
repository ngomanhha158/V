import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, LinkButton, Pill, Trong } from '@/components/ui'
import { vaiCan } from '@/lib/vai-tro'
import { IcHoaDon, IcPhai, IcThe, IcThem, IcToaNha } from '@/components/icons'
import { danhSach } from '@/lib/chot-quyen'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()

  // RLS lo phần lọc: chỉ trả về căn hộ user thực sự có quyền.
  const { data: memberships } = await db
    .from('unit_memberships')
    .select('id, role, status, valid_to, units(id, code, floor_no, area_m2, buildings(name))')
    .eq('user_id', user?.id ?? '')

  // Chỉ để hiện/ẩn link. RLS mới là chốt chặn thật cho trang BQL.
  //
  // Hỏi "tôi có là nhân sự ở BẤT KỲ khu nào không", chứ không hỏi is_staff của
  // một khu lấy đại. Người vừa quản lý khu A vừa ở khu B mà khu B lên trước
  // thì is_staff(B) = false và link vào /bql biến mất — họ mất đường vào phần
  // mình phụ trách, không kèm một lời giải thích nào.
  //
  // Nuốt lỗi ở đây thì một lần đọc hỏng cũng làm link /bql biến mất — cùng một
  // màn hình với "bạn không quản lý khu nào", mà nguyên nhân thì khác hẳn.
  const khuQuanLy = danhSach<{ vai_tro: string }>(
    await db.rpc('du_an_cua_toi'), 'du_an_cua_toi')
  const isStaff = khuQuanLy.length > 0
  // Ban quản trị có lối vào RIÊNG. Họ là bên giám sát đơn vị quản lý, nên đẩy
  // họ vào thanh điều hướng vận hành ba mươi mục của chính bên bị giám sát là
  // sai vai — và phần lớn mục ở đó họ bấm vào cũng chỉ nhận về lỗi quyền.
  //
  // vai_tro là vai CAO NHẤT ở khu đó, nên người vừa là trưởng BQL vừa là BQT
  // sẽ không thấy link này. Đúng với ý định: lối chính của họ là màn BQL, và
  // /bqt vẫn mở nếu họ gõ thẳng địa chỉ.
  const laBQT = khuQuanLy.some((k) => k.vai_tro === 'bqt')

  const active = memberships?.filter((m) => m.status === 'active') ?? []
  const pending = memberships?.filter((m) => m.status === 'pending') ?? []

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div className="rounded-card border border-warn-line bg-warn-soft px-4 py-3 text-[0.8125rem] text-warn">
          Đang chờ chủ hộ duyệt <b className="font-semibold">{pending.length}</b> yêu cầu gia nhập.
        </div>
      )}

      {active.length === 0 && pending.length === 0 ? (
        <Trong
          title="Chưa gắn với căn hộ nào"
          action={<LinkButton href="/onboarding" dang="chinh" co="sm">Xin gia nhập căn hộ</LinkButton>}
        >
          Chọn căn hộ của bạn để BQL duyệt. Sau khi được duyệt bạn sẽ thấy hóa
          đơn và gửi được yêu cầu sửa chữa.
        </Trong>
      ) : (
        <Card>
          <CardHead
            title="Căn hộ của tôi"
            right={<span className="text-[0.8125rem] text-faint">{active.length}</span>}
          />
          <ul className="divide-y divide-line">
            {active.map((m) => (
              <li key={m.id}>
                <Link
                  href={m.units?.id ? `/unit/${m.units.id}` : '#'}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-faint">
                    <IcToaNha />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">{m.units?.code}</div>
                    <div className="truncate text-[0.8125rem] text-muted">
                      {m.units?.buildings?.name}
                      {m.units?.floor_no != null && ` · tầng ${m.units.floor_no}`}
                      {m.units?.area_m2 != null && ` · ${m.units.area_m2} m²`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Pill tone={m.role === 'owner' ? 'brand' : 'trung'} cham={false}>
                      {vaiCan(m.role)}
                    </Pill>
                    <span className="text-faint"><IcPhai width={16} height={16} /></span>
                  </div>
                </Link>
                {m.valid_to && (
                  <div className="px-4 pb-2 text-[0.75rem] text-faint">
                    Hợp đồng đến {m.valid_to}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <LinkButton href="/tickets/new" dang="chinh" className="h-11">
          <IcThem width={16} height={16} /> Báo sự cố
        </LinkButton>
        <LinkButton href="/invoices" dang="phu" className="h-11">
          <IcHoaDon width={16} height={16} /> Xem hóa đơn
        </LinkButton>
      </div>

      {/* Thẻ cư dân ở đây chứ không thêm vào thanh tab dưới: năm ô đó đã đầy,
          và thêm ô thứ sáu là bốn ô kia hẹp lại cho tất cả mọi người. Chỗ này
          là màn cư dân mở đầu tiên khi tới cửa, một chạm là ra thẻ. */}
      <LinkButton href="/the" dang="phu" className="h-11 w-full">
        <IcThe width={16} height={16} /> Thẻ cư dân
      </LinkButton>

      {/* Duyệt thành viên nằm ở đây chứ không ở thanh tab dưới: phần lớn cư
          dân không bao giờ duyệt ai, chỉ chủ hộ mới cần và chỉ khi có người
          xin vào. */}
      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[0.8125rem]">
        <Link href="/onboarding" className="font-medium text-muted hover:text-ink">Thêm căn hộ</Link>
        <Link href="/approvals" className="font-medium text-muted hover:text-ink">Duyệt thành viên</Link>
        <Link href="/thong-bao" className="font-medium text-muted hover:text-ink">Thông báo</Link>
        <Link href="/hang" className="font-medium text-muted hover:text-ink">Hàng ở quầy</Link>
        <Link href="/tien-ich" className="font-medium text-muted hover:text-ink">Đặt tiện ích</Link>
        <Link href="/khach" className="font-medium text-muted hover:text-ink">Khách thăm</Link>
        <Link href="/quy-bao-tri" className="font-medium text-muted hover:text-ink">Quỹ bảo trì</Link>
        <Link href="/bieu-quyet" className="font-medium text-muted hover:text-ink">Biểu quyết</Link>
        <Link href="/tra-gop" className="font-medium text-muted hover:text-ink">Khoản chia đợt</Link>
        <Link href="/thi-cong" className="font-medium text-muted hover:text-ink">Chuyển nhà &amp; sửa chữa</Link>
        <Link href="/bao-cao" className="font-medium text-muted hover:text-ink">Báo cáo quý</Link>
        <Link href="/ho-so" className="font-medium text-muted hover:text-ink">Tài khoản</Link>
        {laBQT && (
          <Link href="/bqt" className="font-medium text-brand hover:underline">
            Ban quản trị — giám sát →
          </Link>
        )}
        {isStaff && !laBQT && (
          <Link href="/bql" className="font-medium text-brand hover:underline">
            Quản lý tòa nhà (BQL) →
          </Link>
        )}
      </nav>
    </div>
  )
}
