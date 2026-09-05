import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import {
  Card, CardHead, Chip, Hop, PageHead, Stat, Trong, cx, ngayVN, soVN, vnd, vndGon,
} from '@/components/ui'
import { BangThang, ChuThichThu, CotThu, DuongSLA, type ThangKPI } from '@/components/chart'
import { KY, khoangNgay, laKy, type KyKey } from '@/lib/ky'
import type { Database } from '@/lib/db/database.types'

export const dynamic = 'force-dynamic'

// Kiểu lấy thẳng từ database.types.ts thay vì khai lại: khai lại là mở đường
// cho bảng và màn hình lệch nhau âm thầm sau một lần đổi schema.
type Tong = Database['public']['Functions']['bql_dashboard']['Returns'][number]

/** Ngưỡng hiển thị, không phải cam kết hợp đồng. BQT chốt số thật với cư dân
 *  rồi sửa ở đây — đừng để màu sắc trên màn hình tự nó thành chuẩn SLA. */
function toneSLA(v: number | null) {
  if (v === null) return 'trung' as const
  return v >= 90 ? 'tot' : v >= 75 ? 'canh' : 'xau'
}

/** 0.4h đọc là "24 phút"; 51h đọc là "2,1 ngày". Không ai nhẩm giờ ra ngày
 *  giữa cuộc họp. */
function docGio(h: number | null) {
  if (h === null) return '—'
  if (h < 1) return `${Math.round(h * 60)} phút`
  if (h < 48) return `${soVN(h)} giờ`
  return `${soVN(h / 24)} ngày`
}

export default async function Dashboard({
  searchParams,
}: { searchParams: Promise<{ ky?: string }> }) {
  const sp = await searchParams
  const ky: KyKey = laKy(sp.ky) ? sp.ky : 'thang-nay'
  const { tu, den } = khoangNgay(ky)

  const db = await createClient()
  const project = await duAnBQL()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const [{ data: tongRows, error: loiTong }, { data: thangRows, error: loiThang }] =
    await Promise.all([
      db.rpc('bql_dashboard', { p_project: project.id, p_tu: tu, p_den: den }),
      db.rpc('bql_dashboard_thang', { p_project: project.id, p_so_thang: 6 }),
    ])

  // Không nuốt lỗi: dashboard toàn số 0 vì query hỏng trông y hệt một khu vận
  // hành sạch sẽ, mà hai chuyện đó ngược hẳn nhau.
  if (loiTong || loiThang) {
    return (
      <div className="space-y-5">
        <PageHead title="Sức khỏe vận hành" sub={project.name} />
        <Hop tone="xau" title="Không tải được số liệu">
          {(loiTong ?? loiThang)?.message}
        </Hop>
      </div>
    )
  }

  const t: Tong | undefined = tongRows?.[0]
  const thang: ThangKPI[] = thangRows ?? []
  if (!t) return <Trong title="Chưa có số liệu" />

  const tyLeThu = t.phai_thu_ky > 0 ? Math.round((t.da_thu_ky / t.phai_thu_ky) * 100) : null
  const conThieu = t.phai_thu_ky - t.da_thu_ky

  return (
    <div className="space-y-5">
      <PageHead
        title="Sức khỏe vận hành"
        sub={`${project.name} · ${ngayVN(t.tu_ngay)} – ${ngayVN(t.den_ngay)}`}
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(KY) as KyKey[]).map((k) => (
          <Chip key={k} href={`/bql/dashboard?ky=${k}`} active={ky === k}>{KY[k]}</Chip>
        ))}
      </div>

      {/* ── Bốn số BQT mang đi họp ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          nhan="Đúng hạn SLA"
          so={t.ty_le_dung_sla === null ? '—' : `${soVN(t.ty_le_dung_sla)}%`}
          tone={toneSLA(t.ty_le_dung_sla)}
          phu={
            t.ticket_co_ket_luan === 0
              ? 'chưa yêu cầu nào ngã ngũ'
              : `${t.ticket_dung_sla}/${t.ticket_co_ket_luan} yêu cầu đã ngã ngũ`
          }
        />
        <Stat
          nhan="Thời gian xử lý"
          so={docGio(t.gio_xu_ly_trung_vi)}
          phu={
            t.gio_xu_ly_trung_vi === null ? 'chưa có yêu cầu nào xong'
              : `trung vị · chậm nhất 10% mất ${docGio(t.gio_xu_ly_p90)}`
          }
        />
        <Stat
          nhan="Điểm hài lòng"
          so={t.diem_hai_long === null ? '—' : soVN(t.diem_hai_long, 2)}
          phu={
            t.so_luot_danh_gia === 0
              ? 'chưa ai chấm điểm'
              : `${t.so_luot_danh_gia} lượt · ${soVN(t.ty_le_danh_gia ?? 0)}% yêu cầu xong được chấm`
          }
        />
        <Stat
          nhan="Công nợ hiện tại"
          so={vndGon(t.cong_no)}
          tone={t.cong_no_qua_han > 0 ? 'canh' : 'trung'}
          href="/bql/cong-no"
          phu={
            t.cong_no === 0 ? 'không căn nào còn nợ'
              : `${t.so_can_no} căn · quá hạn ${vndGon(t.cong_no_qua_han)}`
          }
        />
      </div>

      {/* ── Đang mở ngay lúc này ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          nhan="Yêu cầu đang mở"
          so={t.dang_mo_hien_tai}
          href="/bql/tickets"
          phu="tính cả yêu cầu mở từ kỳ trước"
        />
        <Stat
          nhan="Đang mở & quá hạn"
          so={t.qua_han_hien_tai}
          tone={t.qua_han_hien_tai > 0 ? 'xau' : 'tot'}
          href="/bql/tickets"
          phu={t.qua_han_hien_tai > 0 ? 'cần xử lý ngay' : 'không tồn đọng'}
        />
        <Stat
          nhan="Thu trong kỳ"
          so={tyLeThu === null ? '—' : `${tyLeThu}%`}
          tone={tyLeThu === null ? 'trung' : tyLeThu >= 90 ? 'tot' : tyLeThu >= 70 ? 'canh' : 'xau'}
          phu={
            t.phai_thu_ky === 0 ? 'chưa phát hành hóa đơn kỳ này'
              : `${vndGon(t.da_thu_ky)} / ${vndGon(t.phai_thu_ky)}`
          }
        />
        <Stat
          nhan="Tiền thực về"
          so={vndGon(t.tien_ve_ky)}
          phu="tiền vào tài khoản trong kỳ, gồm cả trả nợ cũ"
        />
      </div>

      {/* ── Xu hướng ──────────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHead
            title="Tỷ lệ đúng hạn theo tháng"
            sub="6 tháng gần nhất · tháng chưa có yêu cầu nào ngã ngũ để trống"
          />
          <div className="px-4 pt-4 pb-2">
            <DuongSLA data={thang} />
          </div>
        </Card>

        <Card>
          <CardHead
            title="Thu theo kỳ hóa đơn"
            sub="Cột là tiền phải thu của tháng đó, phần đậm là đã thu"
            right={<ChuThichThu />}
          />
          <div className="px-4 pt-4 pb-2">
            <CotThu data={thang} />
          </div>
        </Card>
      </div>

      {/* Bảng số của CẢ HAI biểu đồ trên. Để nó nấp trong thẻ bên phải thì
          trông như chỉ giải thích cho biểu đồ tiền. */}
      <Card>
        <BangThang data={thang} />
      </Card>

      {/* ── Cách đọc con số ───────────────────────────────────────────── */}
      <Card>
        <CardHead
          title="Cách các con số được tính"
          sub="Đọc một lần rồi thôi — nhưng đừng mang số đi họp khi chưa đọc"
        />
        <div className="grid gap-4 p-4 text-[0.8125rem] leading-relaxed text-muted sm:grid-cols-2">
          <div>
            <p className="font-semibold text-ink">Đúng hạn SLA</p>
            <p className="mt-1">
              Yêu cầu <strong className="text-ink">đang mở mà đã quá hạn tính là trễ ngay</strong>,
              không đợi đóng. Nếu chỉ đếm yêu cầu đã đóng thì cái để treo mãi không bao giờ
              thành lỗi, và tỷ lệ đẹp dần lên đúng lúc dịch vụ tệ đi. Yêu cầu còn trong hạn
              chưa ngã ngũ nên đứng ngoài cả tử lẫn mẫu — kỳ này có{' '}
              <span className="num text-ink">{t.ticket_chua_ket_luan}</span> cái như vậy.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Hai chỗ số có thể bị bóp</p>
            <p className="mt-1">
              <span className="num text-ink">{t.ticket_tu_choi}</span> yêu cầu bị từ chối không
              tính SLA — từ chối là lối thoát hợp lệ, nhưng từ chối hết thì SLA thành 100%, nên
              nó được đếm ra đây.{' '}
              <span className="num text-ink">{t.ticket_khong_co_sla}</span> yêu cầu thuộc danh mục
              chưa khai trong bảng SLA nên không có hạn nào để so — đó là vùng mù, không phải
              điểm tuyệt đối.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Thời gian xử lý</p>
            <p className="mt-1">
              Số chính là <strong className="text-ink">trung vị</strong>: một yêu cầu bị bỏ quên
              qua Tết kéo trung bình đi đâu không biết, còn trung vị vẫn tả đúng cái đa số cư dân
              gặp. Trung bình kỳ này là{' '}
              <span className="num text-ink">{docGio(t.gio_xu_ly_trung_binh)}</span> — lệch nhiều
              so với trung vị là dấu hiệu có yêu cầu đang bị treo. Tiếp nhận: trung vị{' '}
              <span className="num text-ink">{docGio(t.gio_phan_hoi_trung_vi)}</span>.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Tiền</p>
            <p className="mt-1">
              <strong className="text-ink">Thu trong kỳ</strong> bám theo kỳ hóa đơn: tháng 8 thu
              được bao nhiêu phần của tháng 8 ({vnd(t.da_thu_ky)} trên {vnd(t.phai_thu_ky)}, còn
              thiếu {vnd(conThieu)}). <strong className="text-ink">Tiền thực về</strong> bám theo
              ngày tiền vào tài khoản, nên gồm cả tiền trả nợ các tháng cũ — hai số này cố tình
              khác nhau. <strong className="text-ink">Công nợ</strong> là ảnh chụp hôm nay, không
              bị khoảng ngày cắt: nợ từ năm ngoái vẫn là nợ.
            </p>
          </div>
        </div>
        <div className="border-t border-line p-4">
          <Hop tone="trung" title="Chưa có phần chi">
            Hệ thống mới ghi nhận dòng tiền vào (hóa đơn và thanh toán của cư dân). Muốn có
            thu/chi đối xứng thì cần thêm sổ chi phí vận hành — điện nước khu chung, bảo vệ, vệ
            sinh, sửa chữa — với người nhập và chứng từ đi kèm. Đó là một tính năng riêng, không
            phải một cột thêm vào báo cáo này.
          </Hop>
        </div>
      </Card>
    </div>
  )
}
