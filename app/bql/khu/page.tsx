import { createClient } from '@/lib/db/server'
import { khuDangXem } from '@/lib/du-an'
import { canhBaoKhu, nenHienHopChon, soLieuKhu, type Khu } from '@/lib/khu'
import { Hop, PageHead, Card, CardHead, Pill, cx } from '@/components/ui'
import { IcCheck, IcToaNha } from '@/components/icons'
import { tenVaiTro } from '@/lib/vai-tro'
import { chonKhu } from '../chon-khu'
import { FormTaiKhoan } from './form-tk'

export const dynamic = 'force-dynamic'

/**
 * Các khu người đang đăng nhập được quản lý.
 *
 * Hộp chọn trên thanh bên đủ dùng để nhảy qua nhảy lại, nhưng nó không trả lời
 * được "tôi đang có quyền gì ở đâu". Với người vận hành nhiều khu thì đó là câu
 * hỏi đầu tiên mỗi khi có việc lạ — và câu trả lời phải đọc được cả trên giấy.
 */
export default async function Page() {
  const { dang, ds, loi } = await khuDangXem()

  // Tài khoản nhận tiền của khu ĐANG XEM. Chỉ khu đang xem, không phải cả
  // danh sách: khai tài khoản là việc làm một lần lúc dựng khu, còn bày sáu ô
  // nhập cho sáu khu trên cùng một màn là mời người ta gõ nhầm dòng.
  const db = await createClient()
  const { data: tkRows } = dang
    ? await db.rpc('tk_nhan_tien', { p_project: dang.id })
    : { data: null }
  const tk = (tkRows ?? [])[0]

  return (
    <div className="space-y-5">
      <PageHead
        title="Khu đang quản lý"
        sub="Quyền tính riêng từng khu — chốt đó nằm ở database, không ở màn hình"
      />

      {loi && (
        <Hop tone="xau" title="Không đọc được danh sách khu">
          {loi === 'TypeError: fetch failed'
            ? 'Không gọi được database. Đây là sự cố hệ thống, không phải bạn bị gỡ quyền — báo kỹ thuật thay vì đi xin lại quyền.'
            : loi}
        </Hop>
      )}

      {!loi && ds.length === 0 && (
        <Hop tone="canh" title="Bạn chưa được phân công khu nào">
          Trưởng BQL thêm bạn ở màn “Người dùng &amp; phân quyền”. Chưa có dòng phân
          công thì mọi màn BQL đều trống — đó là RLS chặn ở database, không phải lỗi.
        </Hop>
      )}

      {!loi && ds.length > 0 && !nenHienHopChon(ds) && (
        <Hop tone="trung" title="Một khu thì không có gì để chọn">
          Hộp chọn khu chỉ hiện khi bạn quản lý từ hai khu trở lên. Một hộp chọn có
          đúng một lựa chọn chỉ chiếm chỗ và làm người dùng tưởng mình thiếu quyền.
        </Hop>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {ds.map((k: Khu) => {
          const dangXem = k.id === dang?.id
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
                  <form action={chonKhu} className="shrink-0">
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

      {dang && (
        <Card>
          <CardHead
            title={`Tài khoản nhận tiền — ${dang.name}`}
            sub="Mã QR trên hóa đơn của khu này trỏ vào đúng tài khoản khai ở đây"
            xuongDong
          />
          {!tk?.so_tk && (
            <div className="px-4 pt-4">
              <Hop tone="canh" title="Khu này chưa khai tài khoản riêng">
                Đang dùng tài khoản cấu hình chung của cả cài đặt. Với một khu thì
                không sao; từ khu thứ hai trở đi thì mỗi khu phải có tài khoản
                riêng, nếu không tiền về không biết vào sổ của khu nào.
              </Hop>
            </div>
          )}
          <FormTaiKhoan
            khu={dang.id}
            bin={tk?.bin ?? ''}
            soTk={tk?.so_tk ?? ''}
            chuTk={tk?.chu_tk ?? ''}
          />
        </Card>
      )}

      {nenHienHopChon(ds) && (
        <Hop tone="trung" title="Lựa chọn này lưu ở đâu">
          Khu đang xem lưu trong một cookie của trình duyệt, và được kiểm lại ở
          database mỗi lần đọc. Sửa tay cookie thành một khu không phải của bạn thì
          màn hình rơi về khu đầu tiên chứ không mở ra dữ liệu khu đó — cửa quyền
          nằm trong RLS, cookie chỉ là chỗ nhớ lựa chọn.
        </Hop>
      )}
    </div>
  )
}
