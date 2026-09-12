import {
  Card, CardHead, Chip, Hop, NhanNhom, PageHead, Stat, ngayVN, soVN, vnd, vndGon,
} from '@/components/ui'
import { duMauDanhGia, quyChua, soatQuy, vungMuSla } from '@/lib/bqt'
import { DASHBOARD, DU_AN } from '@/lib/demo/data'
import { DONG, NGAN_HANG, NGAY_DC, SO_DU_NH, SO_TK } from '../quy-mock'

// Mốc cố định, giống màn quỹ của bản demo: câu "đối chiếu N ngày trước" mà đổi
// theo ngày người ta mở trang thì ảnh chụp màn hình trong tài liệu sai ngay hôm sau.
const HOM_NAY = '2026-05-06'

function docGio(h: number | null) {
  if (h === null) return '—'
  if (h < 1) return `${Math.round(h * 60)} phút`
  if (h < 48) return `${soVN(h)} giờ`
  return `${soVN(h / 24)} ngày`
}

export default function DemoGiamSat() {
  const t = DASHBOARD
  const ky = quyChua(HOM_NAY)
  const mu = vungMuSla(t)
  const sq = soatQuy(DONG, SO_DU_NH, NGAY_DC, HOM_NAY)
  const duMau = duMauDanhGia(t.so_luot_danh_gia)
  const tyLeThu = t.phai_thu_ky > 0 ? Math.round((t.da_thu_ky / t.phai_thu_ky) * 100) : null

  const cham: string[] = []
  if (sq.tinh === 'chua_doi_chieu') {
    cham.push('Quỹ bảo trì chưa từng được đối chiếu với sao kê ngân hàng.')
  } else if (sq.tinh === 'lech') {
    cham.push(`Sổ quỹ và sao kê lệch ${vnd(Math.abs(sq.lech!))} tại ngày đối chiếu ${ngayVN(NGAY_DC)}.`)
  } else if (sq.tinh === 'cu') {
    cham.push(`Quỹ bảo trì đối chiếu lần cuối cách đây ${sq.soNgayCach} ngày.`)
  }
  if (mu.dangNgai) {
    cham.push(`${Math.round(mu.tyLe * 100)}% yêu cầu trong kỳ nằm ngoài phép đo SLA `
      + `(${t.ticket_tu_choi} bị từ chối, ${t.ticket_khong_co_sla} thuộc danh mục chưa khai SLA).`)
  }
  if (t.cong_no_qua_han > 0) {
    cham.push(`${vnd(t.cong_no_qua_han)} công nợ đã quá hạn, ở ${t.so_can_no} căn.`)
  }

  return (
    <div className="space-y-5">
      <PageHead
        title="Giám sát vận hành"
        sub={`${DU_AN.ten} · ${ngayVN(ky.tu)} – ${ngayVN(ky.den)}`}
      />

      {/* Bản thật có thêm chip quý trước. Ở đây CỐ Ý chỉ một chip: bộ số demo
          chỉ có một quý, nên chip thứ hai sẽ là một link bấm vào không đổi gì —
          và một nút không làm gì trong bản demo là lời hứa sai về bản thật. */}
      <div className="flex flex-wrap gap-2">
        <Chip href="/demo/bqt" active>{ky.nhan}</Chip>
      </div>

      {cham.length > 0 ? (
        <Hop tone="xau" title={`${cham.length} việc nên đưa ra kỳ họp`}>
          <ul className="ml-4 list-disc space-y-1">
            {cham.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </Hop>
      ) : (
        <Hop tone="tot" title="Không có gì bất thường trong kỳ">
          Quỹ bảo trì khớp sao kê, không có công nợ quá hạn, và phần lớn yêu cầu
          đều nằm trong phép đo SLA.
        </Hop>
      )}

      <section className="space-y-2.5">
        <NhanNhom>Chất lượng dịch vụ của đơn vị quản lý</NhanNhom>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            nhan="Đúng hạn SLA"
            so={`${soVN(t.ty_le_dung_sla)}%`}
            tone={t.ty_le_dung_sla >= 90 ? 'tot' : t.ty_le_dung_sla >= 75 ? 'canh' : 'xau'}
            phu={`${t.ticket_dung_sla}/${t.ticket_co_ket_luan} yêu cầu đã ngã ngũ`}
          />
          <Stat
            nhan="Ngoài phép đo"
            so={`${Math.round(mu.tyLe * 100)}%`}
            tone={mu.dangNgai ? 'canh' : 'trung'}
            phu={`${mu.soNgoai}/${t.tong_ticket} yêu cầu · từ chối ${t.ticket_tu_choi}, `
              + `chưa khai SLA ${t.ticket_khong_co_sla}`}
          />
          <Stat
            nhan="Thời gian xử lý"
            so={docGio(t.gio_xu_ly_trung_vi)}
            phu={`trung vị · chậm nhất 10% mất ${docGio(t.gio_xu_ly_p90)}`}
          />
          <Stat
            nhan="Điểm hài lòng"
            so={soVN(t.diem_hai_long, 2)}
            tone={!duMau ? 'trung' : t.diem_hai_long >= 4 ? 'tot' : 'canh'}
            phu={duMau
              ? `${t.so_luot_danh_gia} lượt · ${soVN(t.ty_le_danh_gia)}% yêu cầu xong được chấm`
              : `mới ${t.so_luot_danh_gia} lượt — chưa đủ để kết luận`}
          />
        </div>
      </section>

      <section className="space-y-2.5">
        <NhanNhom>Tiền của cư dân</NhanNhom>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            nhan="Thu trong kỳ"
            so={tyLeThu === null ? '—' : `${tyLeThu}%`}
            tone={tyLeThu === null ? 'trung' : tyLeThu >= 90 ? 'tot' : tyLeThu >= 70 ? 'canh' : 'xau'}
            phu={`${vndGon(t.da_thu_ky)} / ${vndGon(t.phai_thu_ky)}`}
          />
          <Stat nhan="Tiền thực về" so={vndGon(t.tien_ve_ky)} phu="vào tài khoản trong kỳ, gồm cả trả nợ cũ" />
          <Stat nhan="Công nợ hiện tại" so={vndGon(t.cong_no)} phu={`${t.so_can_no} căn`} />
          <Stat
            nhan="Trong đó quá hạn"
            so={vndGon(t.cong_no_qua_han)}
            tone={t.cong_no_qua_han > 0 ? 'canh' : 'tot'}
            phu={t.cong_no_qua_han > 0 ? 'đã qua ngày đến hạn' : 'không có khoản nào quá hạn'}
          />
        </div>
      </section>

      <Card>
        <CardHead
          title="Quỹ bảo trì 2%"
          sub={`${NGAN_HANG} · tài khoản kết thúc ${SO_TK.slice(-4)}`}
        />
        <dl className="divide-y divide-line">
          <div className="flex items-baseline justify-between gap-3 px-4 py-3">
            <dt className="text-[0.8125rem] text-muted">Số dư sổ hôm nay</dt>
            <dd className="text-sm font-semibold text-ink">{vnd(sq.soDuSo)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-4 py-3">
            <dt className="text-[0.8125rem] text-muted">Số dư sổ tại {ngayVN(NGAY_DC)}</dt>
            <dd className="text-sm text-ink">{vnd(sq.soDuLucDoiChieu!)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-4 py-3">
            <dt className="text-[0.8125rem] text-muted">Sao kê ngân hàng cùng ngày</dt>
            <dd className="text-sm text-ink">{vnd(SO_DU_NH)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-4 py-3">
            <dt className="text-[0.8125rem] text-muted">Chênh lệch</dt>
            <dd className={sq.lech === 0
              ? 'text-sm font-semibold text-ok' : 'text-sm font-semibold text-bad'}>
              {sq.lech === 0 ? 'khớp' : vnd(sq.lech!)}
            </dd>
          </div>
          <div className="px-4 py-3 text-[0.8125rem] leading-relaxed text-muted">
            Đối chiếu {sq.soNgayCach} ngày trước. Mọi khoản thu chi sau ngày đó
            chưa có sao kê nào xác nhận.
          </div>
        </dl>
      </Card>

      <Card>
        <CardHead
          title="Việc của ban quản trị"
          sub="Những màn ban quản trị ký hoặc chốt, không phải màn vận hành hằng ngày"
        />
        <div className="flex flex-wrap gap-2 p-4">
          <Chip href="/demo/bql/quy-bao-tri">Sổ quỹ bảo trì</Chip>
          <Chip href="/demo/bql/bieu-quyet">Biểu quyết hội nghị</Chip>
          <Chip href="/demo/bql/bao-cao">Báo cáo quý</Chip>
          <Chip href="/demo/bql/ban-giao">Chốt sổ bàn giao</Chip>
        </div>
      </Card>
    </div>
  )
}
