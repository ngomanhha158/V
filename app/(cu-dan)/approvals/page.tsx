import { createClient } from '@/lib/db/server'
import { decide } from './actions'
import { Button, Card, Field, Input, PageHead, Pill, Trong, ngayVN } from '@/components/ui'
import { IcNguoi } from '@/components/icons'

export const dynamic = 'force-dynamic'

const VAI: Record<string, string> = {
  owner: 'Chủ hộ', authorized: 'Được ủy quyền', tenant: 'Người thuê', family: 'Thành viên',
}

export default async function Approvals() {
  const db = await createClient()
  const { data: pending } = await db
    .from('unit_memberships')
    // Phải chỉ đích danh FK: unit_memberships có 2 đường sang profiles
    // (user_id và approved_by). Để trống thì PostgREST không đoán được và query lỗi.
    .select('id, role, created_at, profiles!unit_memberships_user_id_fkey(full_name, phone), units(code)')
    .eq('status', 'pending')

  const ds = pending ?? []

  return (
    <div className="space-y-5">
      <PageHead
        title="Yêu cầu chờ duyệt"
        sub="Người xin gia nhập căn hộ bạn đang quản lý"
        actions={ds.length ? <Pill tone="canh">{ds.length} chờ xử lý</Pill> : undefined}
      />

      {!ds.length ? (
        <Trong title="Không có yêu cầu nào">
          Khi có người xin gia nhập căn hộ của bạn, họ sẽ xuất hiện ở đây để bạn
          duyệt hoặc từ chối.
        </Trong>
      ) : (
        <div className="space-y-3">
          {ds.map((m) => (
            <Card key={m.id}>
              <form action={decide}>
                <input type="hidden" name="id" value={m.id} />

                <div className="flex items-start gap-3 px-4 py-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sunken text-faint">
                    <IcNguoi />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">
                      {m.profiles?.full_name}
                    </div>
                    <div className="num mt-0.5 text-[0.8125rem] text-muted">
                      {m.profiles?.phone ?? 'Chưa có số điện thoại'}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Pill tone="brand" cham={false}>{VAI[m.role] ?? m.role}</Pill>
                      <span className="text-[0.75rem] text-faint">
                        xin vào {m.units?.code} · {ngayVN(String(m.created_at))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Người thuê / ủy quyền phải có hạn, nếu không quyền không bao giờ tự thu hồi */}
                {(m.role === 'tenant' || m.role === 'authorized') && (
                  <div className="border-t border-line px-4 py-3">
                    <Field
                      label="Hợp đồng hết hạn"
                      hint="Bắt buộc — hết ngày này hệ thống tự thu quyền, không cần ai nhớ."
                    >
                      <Input type="date" name="valid_to" required className="max-w-48" />
                    </Field>
                  </div>
                )}

                <div className="flex gap-2 border-t border-line bg-raised px-4 py-3">
                  <Button name="approve" value="1" dang="chinh" co="sm">Duyệt</Button>
                  <Button name="approve" value="0" dang="nguy" co="sm">Từ chối</Button>
                </div>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
