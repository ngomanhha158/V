import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import { bankConfigKhu } from '@/lib/bank'
import {
  Card, CardHead, Hop, LinkButton, PageHead, Pill, Stat, Trong, cx, soVN,
} from '@/components/ui'
import { TEN_JOB, XAU, soatJobNen, type DongJobChay } from '@/lib/job-nen'
import { laNoiBo } from '@/lib/kho-anh'
import { docKhoAnh } from '@/lib/kho-anh-server'
import { BangJobNen } from '@/components/job-nen'
import { quyen } from '@/lib/chot-quyen'

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
  const project = await duAnBQL()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const kqStaff = await db.rpc('is_staff', { p_project: project.id })
  if (!quyen(kqStaff, 'is_staff')) redirect('/')

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
  const bank = await bankConfigKhu(project.id)

  // Job nền. Đọc cả bảng — nhiều nhất là một dòng cho mỗi job trong danh mục.
  //
  // Lỗi ở đây KHÔNG làm sập cả màn (phần còn lại của danh sách kiểm vẫn đúng),
  // nhưng cũng KHÔNG được coi là bảng rỗng: một database chưa áp schema mới sẽ
  // trả lỗi, mà "rỗng" lại có nghĩa là chưa job nào từng chạy. Nhập hai thứ đó
  // làm một là màn hình báo cả chín job hỏng trong khi chúng đang chạy đều.
  const { data: dongJob, error: loiJob } = await db.from('job_chay')
    .select('viec, ok_luc, ok_so, ok_ms, loi_luc, loi')
  const job = soatJobNen((dongJob ?? []) as DongJobChay[])
  const jobXau = loiJob ? [] : job.filter((j) => XAU(j.trangThai))

  // Biến môi trường đọc ở SERVER. Không đưa giá trị nào ra màn hình — chỉ nói
  // "đã điền" hay "chưa": màn này BQL mở được, mà khóa thì không phải việc của họ.
  // Webhook ghi bằng client service_role, mà client đó tự ký JWT — nên thứ
  // phải có là khóa ký, không còn là một khóa xin từ nhà cung cấp.
  const coServiceKey = !!(process.env.AUTH_JWT_SECRET && process.env.POSTGREST_URL)
  const coThu = !!process.env.SMTP_URL
  const coCron = !!process.env.CRON_SECRET
  const coWebhook = !!(process.env.SEPAY_WEBHOOK_APIKEY || process.env.CASSO_WEBHOOK_TOKEN)

  // Hai mục dưới đây trước nằm ở thẻ "Việc còn lại nằm ngoài phần mềm" — tức
  // màn hình tự nhận là không kiểm được rồi bảo người dựng sang Railway mà
  // nhìn. Kiểm được cả hai, nên chúng chuyển lên danh sách kiểm.
  const kho = docKhoAnh()
  const noiBo = laNoiBo(process.env.POSTGREST_URL)

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

    // Trước đây mục này chỉ kiểm được BIẾN MÔI TRƯỜNG rồi bảo người đọc tự
    // sang Railway đếm cho đủ — kèm một con số viết cứng từ thời hệ thống còn
    // ít job hơn bây giờ. Số job tăng, dòng chữ đứng yên, nên nhìn vào là
    // tưởng dư lịch trong khi đang thiếu; đó đúng là chuyện đã xảy ra. Giờ nó
    // đọc bảng job_chay: không đoán theo cấu hình nữa mà nói theo việc job có
    // thật sự chạy hay không, và mọi con số đều suy ra từ danh mục.
    { ten: 'Job nền đang chạy', xong: coCron && !loiJob && jobXau.length === 0, batBuoc: true,
      chiTiet: loiJob
        ? `Chưa đọc được bảng job_chay (${loiJob.message}) nên màn này chưa kết luận `
          + 'được gì về job nền — xem ô ngay dưới.'
        : !coCron
        ? 'Chưa điền CRON_SECRET, nên chắc chắn chưa có job nền nào chạy: không nhắc nợ, '
          + 'không leo thang yêu cầu quá hạn, không thu quyền hợp đồng đã hết hạn. '
          + 'Không màn nào báo lỗi — chỉ là mọi thứ đứng yên.'
        : jobXau.length === 0
          ? `Đủ ${TEN_JOB.length} job, job nào cũng vừa chạy trong hạn của nó.`
          : `${jobXau.length}/${TEN_JOB.length} job không chạy: `
            + `${jobXau.map((j) => j.ten).join(', ')}. Bảng ngay dưới nói rõ từng cái.` },

    // Ảnh hỏng hóc là bằng chứng trong tranh chấp giữa cư dân và ban quản lý.
    // Không có Volume thì app vẫn nhận ảnh bình thường rồi mất sạch ở lần
    // deploy kế tiếp — lặng lẽ, và chỉ lộ ra lúc có người mở lại một yêu cầu
    // cũ để đối chất.
    { ten: 'Ảnh nằm trên Volume, không phải đĩa tạm',
      xong: kho.tinh === 'co_volume', batBuoc: kho.chan,
      chiTiet: kho.cau },

    // KHÔNG trả lời được câu "PostgREST có tên miền công khai không" — muốn
    // biết phải hỏi Railway. Chỉ trả lời câu hẹp hơn: app này đang đi đường
    // nào. Nói đúng phạm vi, vì một mục xanh hứa nhiều hơn cái nó kiểm được là
    // thứ tệ nhất trên một danh sách trước khi mở cửa cho cả tòa.
    { ten: 'App gọi PostgREST qua địa chỉ nội bộ',
      xong: noiBo === true, batBuoc: noiBo === false,
      chiTiet: noiBo === true
        ? 'POSTGREST_URL trỏ vào mạng nội bộ. Vẫn phải tự kiểm phần Networking của '
          + 'service PostgREST: mục này không thấy được nó có tên miền công khai hay không.'
        : noiBo === false
          ? 'POSTGREST_URL đang trỏ ra một địa chỉ công khai. Tầng dữ liệu đi qua '
            + 'internet, và chốt duy nhất còn lại là chữ ký JWT.'
          : 'Chưa đọc được POSTGREST_URL (thiếu, hoặc thiếu http:// ở đầu) nên chưa '
            + 'kết luận được gì về đường đi.' },

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

      <BangJobNen job={job} loi={loiJob?.message ?? null} />

      <Card>
        <CardHead
          title="Việc còn lại nằm ngoài phần mềm"
          sub="Không màn hình nào kiểm hộ được, nhưng thiếu thì go-live vẫn hỏng"
        />
        <div className="space-y-3 p-4 text-[0.8125rem] leading-relaxed text-muted">
          <p>
            <strong className="text-ink">Sao lưu database.</strong> Bật snapshot cho service
            Postgres trên Railway. Toàn bộ công nợ, hóa đơn và sổ kiểm toán nằm trong đó; không
            có bản sao thì một lần lỡ tay là mất hết, không ai khôi phục hộ được.
          </p>
          <p>
            <strong className="text-ink">Networking của PostgREST.</strong> Danh sách kiểm ở
            trên chỉ thấy được app đang gọi PostgREST qua đường nào, không thấy được service
            đó có tên miền công khai hay không. Vào phần Networking của nó kiểm bằng mắt: chỉ
            được có địa chỉ nội bộ.
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
