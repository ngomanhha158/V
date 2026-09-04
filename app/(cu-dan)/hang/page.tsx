import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong, cx, ngayGioVN } from '@/components/ui'
import { NHAN_TRANG_THAI, TONE_TRANG_THAI, loiKienCuaToi, nhanLoaiHoa } from '@/lib/kien-hang'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: ds, error } = await db.rpc('kien_cua_toi')
  const rows = ds ?? []
  const dangGiu = rows.filter((k) => k.trang_thai === 'dang_giu')

  return (
    <div className="space-y-5">
      <PageHead
        title="Hàng gửi ở quầy"
        sub="Lễ tân giữ hộ — tới lấy thì đưa thẻ cư dân cho bảo vệ quét"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần nhận hàng hộ chưa có trên database. Báo ban quản lý.'
            : error.message}
        </Hop>
      )}

      {!error && dangGiu.length > 0 && (
        <Hop tone="canh" title={`Quầy đang giữ ${dangGiu.length} kiện của bạn`}>
          Mang theo điện thoại — bảo vệ quét thẻ cư dân là trao ngay, không phải
          ký sổ. Người nhà trong căn cũng lấy hộ được, và tên người lấy sẽ hiện
          ở đây.
        </Hop>
      )}

      <Card>
        <CardHead title="Tất cả kiện" sub={`${rows.length} lượt gần đây`} />
        {rows.length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có kiện nào">
              Khi lễ tân nhận hàng hộ, bạn có thông báo ngay và kiện hiện ở đây.
            </Trong>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((k) => (
              <div
                key={k.id}
                className={cx('px-4 py-3', k.trang_thai !== 'dang_giu' && 'opacity-70')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">
                      {nhanLoaiHoa(k.loai)}
                      {k.nha_van_chuyen && (
                        <span className="ml-1.5 text-[0.8125rem] font-normal text-muted">
                          · {k.nha_van_chuyen}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[0.8125rem] text-muted">{loiKienCuaToi(k)}</div>
                    <div className="num mt-0.5 text-[0.75rem] text-faint">
                      Nhận {ngayGioVN(k.nhan_luc)}
                      {k.tra_luc && ` · trao ${ngayGioVN(k.tra_luc)}`}
                    </div>
                  </div>
                  <span className="shrink-0">
                    <Pill tone={TONE_TRANG_THAI[k.trang_thai] ?? 'trung'}>
                      {NHAN_TRANG_THAI[k.trang_thai] ?? k.trang_thai}
                    </Pill>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Hop tone="trung" title="Vì sao phải quét thẻ mới lấy được">
        Trước đây bảo vệ giữ hộ hàng chục kiện mỗi ngày mà không ai ký nhận —
        mất hàng là tranh cãi không có bằng chứng. Quét thẻ ghi lại đúng con
        người đã lấy, nên nếu có chuyện thì cả hai bên đều có chỗ để tra.
      </Hop>
    </div>
  )
}
