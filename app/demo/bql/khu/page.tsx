import { KHU_DEMO } from '@/lib/demo/data'
import { Hop, PageHead, Card, Pill, cx } from '@/components/ui'
import { IcCheck, IcToaNha } from '@/components/icons'
import { tenVaiTro } from '@/lib/vai-tro'
import { canhBaoKhu, soLieuKhu } from '@/lib/khu'
import { khuDemoDangXem } from '../khu-dang-xem'
import { chonKhuDemo } from '../chon-khu'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const dang = await khuDemoDangXem()

  return (
    <div className="space-y-5">
      <PageHead
        title="Khu đang quản lý"
        sub="Quyền tính riêng từng khu — chốt đó nằm ở database, không ở màn hình"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {KHU_DEMO.map((k) => {
          const dangXem = k.id === dang.id
          return (
            <Card key={k.id} className={cx(dangXem && 'border-brand')}>
              <div className="flex items-start gap-3 p-4">
                <IcToaNha className="mt-0.5 size-5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold break-words text-ink">{k.name}</h2>
                    {dangXem && <Pill tone="brand">Đang xem</Pill>}
                  </div>
                  <p className="num mt-1 text-[0.8125rem] text-muted">
                    {soLieuKhu(k)}
                    {k.vai_tro && (
                      <span className="text-faint"> · {tenVaiTro(k.vai_tro)}</span>
                    )}
                  </p>
                  {canhBaoKhu(k) && (
                    <p className="mt-2 text-[0.75rem] text-canh">{canhBaoKhu(k)}</p>
                  )}
                </div>

                {!dangXem && (
                  <form action={chonKhuDemo} className="shrink-0">
                    <button
                      type="submit" name="khu" value={k.id}
                      className="rounded-ctl border border-line-firm px-3 py-1.5 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-sunken"
                    >
                      Chuyển sang
                    </button>
                  </form>
                )}
                {dangXem && <IcCheck className="mt-0.5 size-5 shrink-0 text-brand" />}
              </div>
            </Card>
          )
        })}
      </div>

      <Hop tone="trung" title="Lựa chọn này lưu ở đâu">
        Khu đang xem lưu trong một cookie của trình duyệt, và được kiểm lại ở
        database mỗi lần đọc. Sửa tay cookie thành một khu không phải của bạn thì
        màn hình rơi về khu đầu tiên chứ không mở ra dữ liệu khu đó — cửa quyền
        nằm trong RLS, cookie chỉ là chỗ nhớ lựa chọn.
      </Hop>
    </div>
  )
}
