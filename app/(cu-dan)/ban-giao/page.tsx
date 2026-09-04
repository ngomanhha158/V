import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Trong, ngayVN, vnd } from '@/components/ui'
import { ChotSo, type BanChot } from '@/components/chot-so'

/**
 * Bản chốt bàn giao, cho cư dân.
 *
 * Công khai chính là cơ chế giám sát — cùng lý do với quỹ bảo trì. Nhưng chi
 * tiết công nợ thì mỗi người chỉ thấy dòng của CĂN MÌNH: công nợ hàng xóm
 * không phải việc của họ, và RLS chot_can_read là chỗ chặn.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: ds, error } = await db
    .from('chot_ban_giao')
    .select('id, ngay_chot, so_can, so_can_no, tong_phai_thu, qua_han_90, quy_bao_tri, quy_doi_chieu, audit_den, lap_luc, ky_bql_luc, ky_bqt_luc, huy_luc, ly_do_huy, ghi_chu')
    .order('ngay_chot', { ascending: false })
    .limit(12)

  const rows = (ds ?? []) as BanChot[]
  const { data: cuaToi } = rows.length
    ? await db
        .from('chot_ban_giao_can')
        .select('chot_id, ma_can, phai_thu, qua_han_90, hoa_don_cu_nhat')
        .in('chot_id', rows.map((r) => r.id))
    : { data: [] }

  return (
    <div className="space-y-5">
      <PageHead
        title="Chốt sổ bàn giao"
        sub="Số liệu hai bên thống nhất tại mốc bàn giao — đóng băng, không đổi về sau"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được bản chốt">
          {error.code === '42P01'
            ? 'Phần chốt sổ bàn giao chưa có trên database. Báo ban quản lý.'
            : error.message}
        </Hop>
      )}

      {!error && rows.length === 0 && (
        <Trong title="Chưa có bản chốt nào">
          Bản chốt được lập khi tòa nhà đổi đơn vị quản lý, hoặc khi ban quản trị
          muốn khóa lại số liệu của một mốc. Có bản nào thì nó hiện ở đây.
        </Trong>
      )}

      {rows.map((c) => {
        const toi = (cuaToi ?? []).filter((x) => x.chot_id === c.id)
        return (
          <div key={c.id} className="space-y-2">
            <ChotSo c={c} />
            <Card>
              <CardHead title="Căn của bạn tại mốc này" />
              {toi.length === 0 ? (
                <p className="p-4 text-[0.8125rem] text-muted">
                  Căn của bạn không có công nợ tại ngày {ngayVN(c.ngay_chot)}.
                </p>
              ) : (
                <dl className="divide-y divide-line px-4 text-sm">
                  {toi.map((x) => (
                    <div key={x.ma_can} className="py-2.5">
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="num text-muted">{x.ma_can}</dt>
                        <dd className="num text-right font-medium text-ink">{vnd(x.phai_thu)}</dd>
                      </div>
                      {x.qua_han_90 > 0 && (
                        <p className="num mt-0.5 text-[0.75rem] text-bad">
                          Trong đó {vnd(x.qua_han_90)} quá hạn trên 90 ngày
                          {x.hoa_don_cu_nhat && ` · hóa đơn cũ nhất ${ngayVN(x.hoa_don_cu_nhat)}`}
                        </p>
                      )}
                    </div>
                  ))}
                </dl>
              )}
              <p className="border-t border-line px-4 py-2.5 text-[0.75rem] leading-relaxed text-faint">
                Bạn chỉ thấy dòng của căn mình — công nợ của các căn khác không
                hiện ra ở đây.
              </p>
            </Card>
          </div>
        )
      })}

      <Hop tone="trung" title="Con số này không đổi nữa">
        Bản chốt ghi lại tình trạng tại đúng ngày chốt. Về sau ai trả thêm hay nợ
        thêm thì số trên đây vẫn giữ nguyên — đó là cả lý do nó tồn tại. Muốn xem
        công nợ hiện tại thì mở{' '}
        <Link href="/invoices" className="font-medium text-brand hover:underline">Hóa đơn</Link>.
      </Hop>
    </div>
  )
}
