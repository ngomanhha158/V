import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { bankConfig } from '@/lib/bank'
import {
  Card, CardHead, Hop, LinkButton, PageHead, Pill, Stat, Trong, cx, soVN,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

type Muc = {
  ten: string
  xong: boolean
  /** null = không chặn go-live, chỉ nên có. */
  batBuoc: boolean
  chiTiet: string
  lam?: { nhan: string; href: string }
}

function Hang({ m }: { m: Muc }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        className={cx(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold',
          m.xong ? 'bg-ok-soft text-ok'
            : m.batBuoc ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn',
        )}
        // Dấu tick/chéo là CHỮ, không phải chỉ màu: khoảng 8% đàn ông Việt mù
        // màu đỏ-lục ở mức nào đó, và đây là danh sách quyết định có mở hệ
        // thống cho cả tòa hay không.
        aria-hidden
      >
        {m.xong ? '✓' : m.batBuoc ? '✕' : '!'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">
          {m.ten}{' '}
          {!m.xong && (
            <span className={cx('text-[0.75rem] font-semibold',
              m.batBuoc ? 'text-bad' : 'text-warn')}>
              — {m.batBuoc ? 'CHƯA XONG' : 'nên có'}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{m.chiTiet}</p>
      </div>
      {m.lam && !m.xong && (
        <LinkButton href={m.lam.href} co="sm" className="shrink-0">{m.lam.nhan}</LinkButton>
      )}
    </li>
  )
}

export default async function GoLive() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const { data: rows, error } = await db.rpc('bql_san_sang_go_live', {
    p_project: project.id,
  })
  if (error || !rows?.[0]) {
    return (
      <div className="space-y-5">
        <PageHead title="Sẵn sàng go-live" />
        <Hop tone="xau" title="Không đọc được tình trạng">
          {error?.message ?? 'Không có dữ liệu'}
        </Hop>
      </div>
    )
  }
  const d = rows[0]
  const bank = bankConfig()

  // Biến môi trường đọc ở SERVER. Không đưa giá trị nào ra màn hình — chỉ nói
  // "đã điền" hay "chưa": màn này BQL mở được, mà khóa thì không phải việc của họ.
  // Webhook ghi bằng client service_role, mà client đó tự ký JWT — nên thứ
  // phải có là khóa ký, không còn là một khóa xin từ nhà cung cấp.
  const coServiceKey = !!(process.env.AUTH_JWT_SECRET && process.env.POSTGREST_URL)
  const coThu = !!process.env.SMTP_URL
  const coCron = !!process.env.CRON_SECRET
  const coWebhook = !!(process.env.SEPAY_WEBHOOK_APIKEY || process.env.CASSO_WEBHOOK_TOKEN)

  const tyLe = d.so_can > 0 ? (d.so_can_co_chu / d.so_can) * 100 : 0

  const mucs: Muc[] = [
    { ten: 'Đã nhập tòa và căn hộ', xong: d.so_can > 0, batBuoc: true,
      chiTiet: d.so_can > 0
        ? `${d.so_toa} tòa · ${d.so_can} căn hộ.`
        : 'Chưa có căn nào. Cư dân không chọn được căn để xin gia nhập.',
      lam: { nhan: 'Nhập từ Excel', href: '/bql/import' } },

    { ten: 'Đã khai biểu phí', xong: d.so_bieu_phi > 0, batBuoc: true,
      chiTiet: d.so_bieu_phi > 0
        ? `${d.so_bieu_phi} loại phí.`
        : 'Chưa có biểu phí thì không sinh được hóa đơn nào.' },

    { ten: 'Đã khai SLA cho các danh mục yêu cầu', xong: d.so_sla > 0, batBuoc: false,
      chiTiet: d.so_sla > 0
        ? `${d.so_sla} chính sách. Danh mục chưa khai thì yêu cầu vẫn tạo được, chỉ là không có hạn để đo.`
        : 'Chưa khai. Mọi yêu cầu sẽ không có hạn xử lý, và dashboard hiện “vùng mù”.' },

    { ten: 'Có nhân sự BQL', xong: d.so_nhan_su > 0, batBuoc: true,
      chiTiet: `${d.so_nhan_su} người. Người đầu tiên phải tạo bằng bootstrap_bql.sql.` },

    { ten: 'Đã đăng nội quy / sổ tay', xong: d.so_noi_quy > 0, batBuoc: false,
      chiTiet: d.so_noi_quy > 0
        ? `${d.so_noi_quy} mục.`
        : 'Cư dân mở Sổ tay ra sẽ thấy trang trống ngay ngày đầu.',
      lam: { nhan: 'Soạn sổ tay', href: '/bql/so-tay' } },

    { ten: 'Đã cấu hình gửi thư đăng nhập', xong: coThu, batBuoc: true,
      chiTiet: coThu
        ? 'Cư dân nhận được mã đăng nhập qua email.'
        : 'Chưa điền SMTP_URL. Cư dân bấm "Gửi mã" sẽ báo lỗi, và lối vào duy nhất '
          + 'còn lại là mật khẩu do ban quản lý đặt tay cho từng người.' },

    { ten: 'Đã bật job nền', xong: coCron, batBuoc: true,
      chiTiet: coCron
        ? 'Khóa đã điền. Kiểm tiếp trên Railway: phải có đủ 5 Cron Service, danh sách '
          + 'và lịch ở đầu file cron.sql. Màn này chỉ thấy được khóa, không thấy được lịch.'
        : 'Chưa điền CRON_SECRET, nên chắc chắn chưa có job nền nào chạy: không nhắc nợ, '
          + 'không leo thang yêu cầu quá hạn, không thu quyền hợp đồng đã hết hạn. '
          + 'Không màn nào báo lỗi — chỉ là mọi thứ đứng yên.' },

    { ten: 'Đã cấu hình tài khoản nhận tiền', xong: !!bank, batBuoc: true,
      chiTiet: bank
        ? `BIN ${bank.bin} · số tài khoản kết thúc ${bank.accountNumber.slice(-4)}.`
        : 'Chưa điền VBUILDING_BANK_BIN / VBUILDING_BANK_ACCOUNT. Hóa đơn sẽ không có mã QR để quét.' },

    { ten: 'Đã cấu hình webhook đối soát', xong: coWebhook && coServiceKey, batBuoc: false,
      chiTiet: coWebhook && coServiceKey
        ? 'Tiền về sẽ tự gạch công nợ.'
        : !coServiceKey
          ? 'Thiếu AUTH_JWT_SECRET hoặc POSTGREST_URL — webhook không ghi được vào database.'
          : 'Chưa điền khóa của SePay hoặc Casso. Không có nó thì mọi khoản thu phải gạch tay.' },

    { ten: 'Đã phát hành hóa đơn kỳ này', xong: d.so_hoa_don_da_phat > 0, batBuoc: false,
      chiTiet: d.so_hoa_don_ky_nay === 0
        ? 'Chưa sinh hóa đơn nào cho kỳ này.'
        : `${d.so_hoa_don_da_phat}/${d.so_hoa_don_ky_nay} hóa đơn đã phát hành. Hóa đơn nháp thì cư dân chưa thấy.`,
      lam: { nhan: 'Sang màn hóa đơn', href: '/bql/billing' } },

    { ten: 'Không còn yêu cầu chủ hộ nào chờ duyệt', xong: d.so_cho_duyet === 0, batBuoc: false,
      chiTiet: d.so_cho_duyet === 0
        ? 'Hàng đợi trống.'
        : `${d.so_cho_duyet} người đã đăng ký và đang chờ. Họ chưa thấy được gì cho tới khi được duyệt.`,
      lam: { nhan: 'Duyệt ngay', href: '/bql/duyet-chu-ho' } },
  ]

  const conThieu = mucs.filter((m) => !m.xong && m.batBuoc)

  return (
    <div className="space-y-5">
      <PageHead
        title="Sẵn sàng go-live"
        sub={`${project.name} · kiểm trước khi dán poster và mở cho cư dân`}
        actions={
          conThieu.length === 0
            ? <Pill tone="tot">Đủ điều kiện mở</Pill>
            : <Pill tone="xau">Còn {conThieu.length} mục bắt buộc</Pill>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          nhan="Căn đã có chủ hộ"
          so={`${soVN(tyLe, 0)}%`}
          tone={tyLe >= 30 ? 'tot' : tyLe > 0 ? 'canh' : 'trung'}
          phu={`${d.so_can_co_chu}/${d.so_can} căn · mục tiêu Tuần 4 là 30%`}
        />
        <Stat
          nhan="Chờ BQL duyệt"
          so={d.so_cho_duyet}
          tone={d.so_cho_duyet > 0 ? 'canh' : 'trung'}
          href="/bql/duyet-chu-ho"
          phu={d.so_cho_duyet > 0 ? 'cư dân đang chờ, chưa dùng được app' : 'không tồn đọng'}
        />
        <Stat nhan="Tòa" so={d.so_toa} phu={`${d.so_can} căn hộ`} />
        <Stat
          nhan="Hóa đơn kỳ này"
          so={d.so_hoa_don_da_phat}
          phu={`đã phát hành trên ${d.so_hoa_don_ky_nay} sinh ra`}
        />
      </div>

      {conThieu.length > 0 && (
        <Hop tone="xau" title="Chưa nên dán poster">
          Còn {conThieu.length} mục bắt buộc: {conThieu.map((m) => m.ten.toLowerCase()).join('; ')}.
          Mở cho cư dân lúc này là họ đăng nhập vào một app chưa dùng được, và ấn tượng
          đầu tiên chỉ có một lần.
        </Hop>
      )}

      <Card>
        <CardHead title="Danh sách kiểm" sub="Bắt buộc thì phải xong; “nên có” thì thiếu vẫn chạy được" />
        <ul className="divide-y divide-line">
          {mucs.map((m) => <Hang key={m.ten} m={m} />)}
        </ul>
      </Card>

      <Card>
        <CardHead
          title="Việc còn lại nằm ngoài phần mềm"
          sub="Không màn hình nào kiểm hộ được, nhưng thiếu thì go-live vẫn hỏng"
        />
        <div className="space-y-3 p-4 text-[0.8125rem] leading-relaxed text-muted">
          <p>
            <strong className="text-ink">Volume cho ảnh.</strong> Ảnh kèm theo yêu cầu nằm
            trên đĩa của máy chủ này. Trên Railway phải gắn một Volume vào đúng đường dẫn{' '}
            <code className="rounded bg-sunken px-1">/data/ticket-photos</code>. Không gắn thì
            app vẫn chạy bình thường, nhận ảnh bình thường — rồi mất sạch ảnh ở lần deploy kế
            tiếp, và chỉ lộ ra lúc có người mở lại một yêu cầu cũ để đối chất.
          </p>
          <p>
            <strong className="text-ink">Sao lưu database.</strong> Bật snapshot cho service
            Postgres trên Railway. Toàn bộ công nợ, hóa đơn và sổ kiểm toán nằm trong đó; không
            có bản sao thì một lần lỡ tay là mất hết, không ai khôi phục hộ được.
          </p>
          <p>
            <strong className="text-ink">PostgREST không có tên miền công khai.</strong> Vào
            service PostgREST kiểm lại phần Networking: chỉ được có địa chỉ nội bộ. Có tên miền
            public nghĩa là tầng dữ liệu phơi thẳng ra internet, và chốt duy nhất còn lại là
            chữ ký JWT.
          </p>
          <p>
            <strong className="text-ink">Dán poster.</strong> In ở màn Poster QR, dán sảnh và
            trong thang máy — chỗ người ta đứng chờ và có thời gian rút điện thoại ra quét.
          </p>
          <p>
            <strong className="text-ink">Trực ngày đầu.</strong> Người đầu tiên của mỗi căn phải
            được BQL duyệt tay. Dán poster buổi sáng thì buổi chiều hàng đợi sẽ đầy — cần có
            người ngồi duyệt, không phải để tới hôm sau.
          </p>
        </div>
      </Card>
    </div>
  )
}
