import { createClient } from '@/lib/db/server'
import { khuBQT } from '@/lib/du-an'
import {
  Card, CardHead, Chip, Hop, NhanNhom, PageHead, Stat, Trong, ngayVN, soVN, vnd, vndGon,
} from '@/components/ui'
import {
  duMauDanhGia, quyChua, quyHomNay, quyTruoc, soatQuy, vungMuSla, type Ky,
} from '@/lib/bqt'
import type { Database } from '@/lib/db/database.types'

export const dynamic = 'force-dynamic'

type Tong = Database['public']['Functions']['bql_dashboard']['Returns'][number]

/** 0,4h đọc là "24 phút"; 51h đọc là "2,1 ngày". Không ai nhẩm giờ ra ngày
 *  giữa cuộc họp. Giống màn vận hành, cố ý — hai bên nói về cùng một con số
 *  thì phải đọc ra cùng một câu. */
function docGio(h: number | null) {
  if (h === null) return '—'
  if (h < 1) return `${Math.round(h * 60)} phút`
  if (h < 48) return `${soVN(h)} giờ`
  return `${soVN(h / 24)} ngày`
}

export default async function GiamSat({
  searchParams,
}: { searchParams: Promise<{ quy?: string }> }) {
  const sp = await searchParams
  const nay = quyHomNay()
  const truoc = quyTruoc(nay)
  // Chỉ nhận đúng hai mốc mình tự sinh ra. Nhận ngày tự do từ URL là mở một ô
  // nhập ngày không có màn hình, và mọi ô nhập không có màn hình đều là chỗ
  // sinh ra báo cáo mà không ai giải thích được con số.
  const ky: Ky = sp.quy === truoc.tu ? truoc : nay

  const db = await createClient()
  const khu = await khuBQT()
  if (!khu) return <Trong title="Chưa có khu nào" />

  const [{ data: tongRows, error: loiTong }, { data: soRows, error: loiSo }, { data: quy }] =
    await Promise.all([
      db.rpc('bql_dashboard', { p_project: khu.id, p_tu: ky.tu, p_den: ky.den }),
      db.rpc('quy_so_ke_toan', { p_project: khu.id }),
      db.from('quy_bao_tri')
        .select('ngan_hang, so_tai_khoan, so_du_ngan_hang, doi_chieu_ngay')
        .eq('project_id', khu.id).maybeSingle(),
    ])

  // Không nuốt lỗi: một bảng giám sát toàn số 0 vì truy vấn hỏng trông y hệt
  // một khu vận hành sạch sẽ, mà hai chuyện đó ngược hẳn nhau.
  if (loiTong) {
    return (
      <div className="space-y-5">
        <PageHead title="Giám sát vận hành" sub={khu.name} />
        <Hop tone="xau" title="Không tải được số liệu">{loiTong.message}</Hop>
      </div>
    )
  }
  const t: Tong | undefined = tongRows?.[0]
  if (!t) return <Trong title="Chưa có số liệu" />

  const mu = vungMuSla(t)
  const sq = soatQuy(soRows ?? [], quy?.so_du_ngan_hang ?? null, quy?.doi_chieu_ngay ?? null)
  const duMau = duMauDanhGia(t.so_luot_danh_gia)
  const tyLeThu = t.phai_thu_ky > 0 ? Math.round((t.da_thu_ky / t.phai_thu_ky) * 100) : null

  // Việc phải đưa ra kỳ họp. Gom lên đầu chứ không để người đọc tự nhặt từ
  // mười hai ô số: ban quản trị họp mỗi quý một lần, và thứ họ cần biết trước
  // tiên là "kỳ này có gì phải chất vấn", không phải "kỳ này số bao nhiêu".
  const cham: string[] = []
  if (sq.tinh === 'chua_doi_chieu') {
    cham.push('Quỹ bảo trì chưa từng được đối chiếu với sao kê ngân hàng.')
  } else if (sq.tinh === 'lech') {
    cham.push(`Sổ quỹ và sao kê lệch ${vnd(Math.abs(sq.lech!))} tại ngày đối chiếu `
      + `${ngayVN(quy!.doi_chieu_ngay!)}.`)
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
        sub={`${khu.name} · ${ngayVN(t.tu_ngay)} – ${ngayVN(t.den_ngay)}`}
      />

      <div className="flex flex-wrap gap-2">
        <Chip href="/bqt" active={ky.tu === nay.tu}>{nay.nhan}</Chip>
        <Chip href={`/bqt?quy=${truoc.tu}`} active={ky.tu === truoc.tu}>{truoc.nhan}</Chip>
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
            so={t.ty_le_dung_sla === null ? '—' : `${soVN(t.ty_le_dung_sla)}%`}
            tone={t.ty_le_dung_sla === null ? 'trung'
              : t.ty_le_dung_sla >= 90 ? 'tot' : t.ty_le_dung_sla >= 75 ? 'canh' : 'xau'}
            phu={t.ticket_co_ket_luan === 0 ? 'chưa yêu cầu nào ngã ngũ'
              : `${t.ticket_dung_sla}/${t.ticket_co_ket_luan} yêu cầu đã ngã ngũ`}
          />
          {/* Ô này là lý do màn giám sát tồn tại. Tỷ lệ đúng hạn đẹp lên được
              bằng hai cách không cần chạy nhanh hơn: từ chối bớt yêu cầu, và
              để danh mục không khai SLA. Đặt hai cách đó NGAY CẠNH con số mà
              chúng làm đẹp, chứ không giấu trong một trang phụ. */}
          <Stat
            nhan="Ngoài phép đo"
            so={t.tong_ticket === 0 ? '—' : `${Math.round(mu.tyLe * 100)}%`}
            tone={mu.dangNgai ? 'canh' : 'trung'}
            phu={t.tong_ticket === 0 ? 'chưa có yêu cầu nào trong kỳ'
              : `${mu.soNgoai}/${t.tong_ticket} yêu cầu · từ chối ${t.ticket_tu_choi}, `
                + `chưa khai SLA ${t.ticket_khong_co_sla}`}
          />
          <Stat
            nhan="Thời gian xử lý"
            so={docGio(t.gio_xu_ly_trung_vi)}
            phu={t.gio_xu_ly_trung_vi === null ? 'chưa có yêu cầu nào xong'
              : `trung vị · chậm nhất 10% mất ${docGio(t.gio_xu_ly_p90)}`}
          />
          {/* Điểm hài lòng KHÔNG tô xanh khi cỡ mẫu quá nhỏ: 5,0 sao từ hai
              lượt trên hai trăm yêu cầu không phải là điểm 5,0, và một ô xanh
              ở đây là lời khen mà không ai đứng ra bảo lãnh. */}
          <Stat
            nhan="Điểm hài lòng"
            so={t.diem_hai_long === null ? '—' : soVN(t.diem_hai_long, 2)}
            tone={!duMau ? 'trung' : t.diem_hai_long! >= 4 ? 'tot' : 'canh'}
            phu={t.so_luot_danh_gia === 0 ? 'chưa ai chấm điểm'
              : duMau
                ? `${t.so_luot_danh_gia} lượt · ${soVN(t.ty_le_danh_gia ?? 0)}% yêu cầu xong được chấm`
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
            phu={t.phai_thu_ky === 0 ? 'chưa phát hành hóa đơn kỳ này'
              : `${vndGon(t.da_thu_ky)} / ${vndGon(t.phai_thu_ky)}`}
          />
          <Stat
            nhan="Tiền thực về"
            so={vndGon(t.tien_ve_ky)}
            phu="vào tài khoản trong kỳ, gồm cả trả nợ cũ"
          />
          <Stat
            nhan="Công nợ hiện tại"
            so={vndGon(t.cong_no)}
            phu={t.cong_no === 0 ? 'không căn nào còn nợ' : `${t.so_can_no} căn`}
          />
          <Stat
            nhan="Trong đó quá hạn"
            so={vndGon(t.cong_no_qua_han)}
            tone={t.cong_no_qua_han > 0 ? 'canh' : 'tot'}
            phu={t.cong_no_qua_han > 0 ? 'đã qua ngày đến hạn' : 'không có khoản nào quá hạn'}
          />
        </div>
      </section>

      {/* ── Quỹ bảo trì 2% ──────────────────────────────────────────────
          Khoản tiền lớn nhất ban quản trị chịu trách nhiệm, và là thứ duy nhất
          trên màn này mà họ đồng ký chứ không chỉ đọc. */}
      <Card>
        <CardHead
          title="Quỹ bảo trì 2%"
          sub={quy?.ngan_hang
            ? `${quy.ngan_hang} · tài khoản kết thúc ${String(quy.so_tai_khoan ?? '').slice(-4)}`
            : 'chưa khai tài khoản ngân hàng của quỹ'}
        />
        {loiSo ? (
          <div className="px-4 py-3 text-[0.8125rem] text-bad">
            Không đọc được sổ quỹ: {loiSo.message}
          </div>
        ) : (
          <dl className="divide-y divide-line">
            <div className="flex items-baseline justify-between gap-3 px-4 py-3">
              <dt className="text-[0.8125rem] text-muted">Số dư sổ hôm nay</dt>
              <dd className="text-sm font-semibold text-ink">{vnd(sq.soDuSo)}</dd>
            </div>
            {sq.tinh === 'chua_doi_chieu' ? (
              <div className="px-4 py-3 text-[0.8125rem] leading-relaxed text-bad">
                Chưa từng đối chiếu với sao kê. Số dư sổ ở trên là do người ghi
                sổ nhập vào — chưa có gì bên ngoài xác nhận nó đúng.
              </div>
            ) : (
              <>
                {/* Hiện CẢ HAI con số và cả ngày, vì phép so đúng là so tại
                    ngày đối chiếu. Chỉ hiện số dư hôm nay cạnh sao kê cũ là mời
                    người đọc trừ nhẩm hai mốc thời gian khác nhau rồi hoảng. */}
                <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <dt className="text-[0.8125rem] text-muted">
                    Số dư sổ tại {ngayVN(quy!.doi_chieu_ngay!)}
                  </dt>
                  <dd className="text-sm text-ink">{vnd(sq.soDuLucDoiChieu!)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <dt className="text-[0.8125rem] text-muted">
                    Sao kê ngân hàng cùng ngày
                  </dt>
                  <dd className="text-sm text-ink">{vnd(quy!.so_du_ngan_hang!)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <dt className="text-[0.8125rem] text-muted">Chênh lệch</dt>
                  <dd className={sq.lech === 0
                    ? 'text-sm font-semibold text-ok' : 'text-sm font-semibold text-bad'}>
                    {sq.lech === 0 ? 'khớp' : vnd(sq.lech!)}
                  </dd>
                </div>
                <div className="px-4 py-3 text-[0.8125rem] leading-relaxed text-muted">
                  {sq.tinh === 'cu'
                    ? `Đối chiếu lần cuối cách đây ${sq.soNgayCach} ngày. Sao kê về hằng
                       tháng, nên mốc này đã trượt ít nhất một kỳ — "đã đối chiếu" chỉ
                       nói lên điều gì khi nó còn mới.`
                    : `Đối chiếu ${sq.soNgayCach} ngày trước. Mọi khoản thu chi sau ngày
                       đó chưa có sao kê nào xác nhận.`}
                </div>
              </>
            )}
          </dl>
        )}
      </Card>

      <Card>
        <CardHead
          title="Việc của ban quản trị"
          sub="Những màn ban quản trị ký hoặc chốt, không phải màn vận hành hằng ngày"
        />
        <div className="flex flex-wrap gap-2 p-4">
          <Chip href="/bql/quy-bao-tri">Sổ quỹ bảo trì</Chip>
          <Chip href="/bql/bieu-quyet">Biểu quyết hội nghị</Chip>
          <Chip href="/bql/bao-cao">Báo cáo quý</Chip>
          <Chip href="/bql/ban-giao">Chốt sổ bàn giao</Chip>
        </div>
      </Card>
    </div>
  )
}
