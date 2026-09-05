import { Card, CardHead, Field, Hop, Input, PageHead, Pill, ngayGioVN, vnd } from '@/components/ui'
import {
  NHAN_LOAI, NHAN_TRANG_THAI, TONE_TRANG_THAI,
  changKyQuy, goiYKyQuy, loiKhoangNgay, loiKhungGio, soNgay,
} from '@/lib/thi-cong'

// Ba đăng ký cố ý ở ba chặng ký quỹ khác nhau — đó là thứ khó nhìn nhất của
// tính năng này, và một bản demo chỉ có một chặng thì không dạy được gì.
const HOM_NAY = [
  { id: 'h1', ma_can: 'P1-08.11', loai: 'thi_cong', hang_muc: 'Ốp lát, thạch cao trần',
    don_vi_thi_cong: 'Nội thất Nam Long', dien_thoai: '0912345678', so_nguoi: 4,
    gio_bat_dau: '08:00:00', gio_ket_thuc: '16:00:00', duoc: true, ly_do: 'Được thi công' },
  { id: 'h2', ma_can: 'P2-03.07', loai: 'thi_cong', hang_muc: 'Sơn lại toàn căn',
    don_vi_thi_cong: 'Tổ thợ tự do', dien_thoai: '0987654321', so_nguoi: 2,
    gio_bat_dau: '08:00:00', gio_ket_thuc: '17:00:00', duoc: false,
    ly_do: 'Chưa nộp đủ ký quỹ (4000000/10000000đ)' },
  { id: 'h3', ma_can: 'P1-15.02', loai: 'chuyen_vao', hang_muc: 'Chuyển đồ vào',
    don_vi_thi_cong: 'Chuyển nhà Kiến Vàng', dien_thoai: '0901112223', so_nguoi: 5,
    gio_bat_dau: '08:00:00', gio_ket_thuc: '11:00:00', duoc: false,
    ly_do: 'Ngoài giờ cho phép (08:00–11:00)' },
]

const CHUNG = {
  toa: 'Tháp A', lam_chu_nhat: false, ly_do_tu_choi: null as string | null,
  nguoi_dang_ky: 'Nguyễn Thị Lan', ghi_chu: null as string | null,
}

const CHO = [{
  ...CHUNG, id: 'c1', ma_can: 'P3-11.04', loai: 'thi_cong',
  hang_muc: 'Thay toàn bộ hệ thống điện âm tường',
  tu_ngay: '2026-09-14', den_ngay: '2026-10-10',
  gio_bat_dau: '08:00:00', gio_ket_thuc: '17:00:00',
  don_vi_thi_cong: 'Cơ điện Hà Thành', dien_thoai: '0933444555',
  ky_quy_phai_nop: 0, ky_quy_da_nop: 0, ky_quy_tru: 0, ky_quy_hoan: 0,
  ly_do_tru: null as string | null, trang_thai: 'cho_duyet',
  dang_ky_luc: '2026-09-04T09:12:00Z',
}]

const DANG_CHAY = [
  { ...CHUNG, id: 'd1', ma_can: 'P1-08.11', loai: 'thi_cong',
    hang_muc: 'Ốp lát, thạch cao trần',
    tu_ngay: '2026-09-08', den_ngay: '2026-09-22',
    gio_bat_dau: '08:00:00', gio_ket_thuc: '16:00:00',
    don_vi_thi_cong: 'Nội thất Nam Long', dien_thoai: '0912345678',
    ky_quy_phai_nop: 10_000_000, ky_quy_da_nop: 10_000_000, ky_quy_tru: 0, ky_quy_hoan: 0,
    ly_do_tru: null as string | null, trang_thai: 'da_duyet',
    dang_ky_luc: '2026-09-01T02:30:00Z' },
  { ...CHUNG, id: 'd2', ma_can: 'P2-03.07', loai: 'thi_cong', hang_muc: 'Sơn lại toàn căn',
    tu_ngay: '2026-09-05', den_ngay: '2026-09-12',
    gio_bat_dau: '08:00:00', gio_ket_thuc: '17:00:00',
    don_vi_thi_cong: 'Tổ thợ tự do', dien_thoai: '0987654321',
    ky_quy_phai_nop: 10_000_000, ky_quy_da_nop: 4_000_000, ky_quy_tru: 0, ky_quy_hoan: 0,
    ly_do_tru: null, trang_thai: 'da_duyet', dang_ky_luc: '2026-09-02T07:45:00Z' },
]

const DA_KHEP = [
  { ...CHUNG, id: 'k1', ma_can: 'P1-12.04', loai: 'thi_cong', hang_muc: 'Thay sàn gỗ phòng khách',
    tu_ngay: '2026-08-10', den_ngay: '2026-08-24',
    gio_bat_dau: '08:00:00', gio_ket_thuc: '17:00:00',
    don_vi_thi_cong: 'Sàn gỗ Việt', dien_thoai: '0977888999',
    ky_quy_phai_nop: 10_000_000, ky_quy_da_nop: 10_000_000,
    ky_quy_tru: 3_000_000, ky_quy_hoan: 7_000_000,
    ly_do_tru: 'Xước sàn thang máy tháp A, chi phí đánh bóng',
    trang_thai: 'hoan_thanh', dang_ky_luc: '2026-08-05T03:00:00Z' },
  { ...CHUNG, id: 'k2', ma_can: 'P3-09.09', loai: 'thi_cong', hang_muc: 'Đục tường ngăn phòng ngủ',
    tu_ngay: '2026-08-20', den_ngay: '2026-09-05',
    gio_bat_dau: '08:00:00', gio_ket_thuc: '17:00:00',
    don_vi_thi_cong: null, dien_thoai: null,
    ky_quy_phai_nop: 0, ky_quy_da_nop: 0, ky_quy_tru: 0, ky_quy_hoan: 0, ly_do_tru: null,
    trang_thai: 'tu_choi', ly_do_tu_choi: 'Tường ngăn này là tường chịu lực — phải có hồ sơ kết cấu do đơn vị có chứng chỉ lập',
    dang_ky_luc: '2026-08-18T06:20:00Z' },
]

export default function Page() {
  const d = CHO[0]
  return (
    <div className="space-y-5">
      <PageHead
        title="Chuyển nhà & thi công"
        sub="Giờ được phép là một luật, và ký quỹ là một vòng đời — không phải hai dòng ghi chú"
      />

      <Card>
        <CardHead title="Hôm nay ở sảnh" sub="Bảo vệ mở màn này khi có xe vật liệu tới" />
        <div className="divide-y divide-line">
          {HOM_NAY.map((h) => (
            <div key={h.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[0.8125rem] font-medium text-ink">
                  <span className="num">{h.ma_can}</span> · {NHAN_LOAI[h.loai as keyof typeof NHAN_LOAI]}
                </div>
                <div className="text-[0.8125rem] text-muted">{h.hang_muc}</div>
                <div className="num mt-0.5 text-[0.75rem] text-faint">
                  {h.don_vi_thi_cong} · {h.dien_thoai} · {h.so_nguoi} người ·{' '}
                  {h.gio_bat_dau.slice(0, 5)}–{h.gio_ket_thuc.slice(0, 5)}
                </div>
              </div>
              {/* Ba lý do khác nhau dẫn tới ba việc khác nhau cho người đang
                  đứng ở sảnh — nên lý do đứng ngay cạnh chữ "Không được". */}
              <div className="shrink-0 text-right">
                <Pill tone={h.duoc ? 'tot' : 'xau'}>{h.duoc ? 'Được lên' : 'Không được'}</Pill>
                {!h.duoc && <div className="mt-1 max-w-[16rem] text-[0.75rem] text-bad">{h.ly_do}</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="1 đơn chờ duyệt" sub="Duyệt là ấn định mức ký quỹ và khung giờ" />
        <div className="space-y-3 px-4 py-3">
          <Tom d={d} />
          <div className="space-y-3">
            <Field
              label="Mức ký quỹ (đ)"
              hint={`Gợi ý ${vnd(goiYKyQuy(d.loai, soNgay(d.tu_ngay, d.den_ngay)))} cho ${soNgay(d.tu_ngay, d.den_ngay)} ngày. Đây CHỈ là gợi ý — bạn gõ đè được, và con số cuối cùng là con số bạn ký tên.`}
            >
              <Input readOnly className="num" defaultValue={goiYKyQuy(d.loai, soNgay(d.tu_ngay, d.den_ngay))} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Giờ được phép từ" hint="Siết lại được so với đơn xin">
                <Input readOnly className="num" defaultValue="08:00" />
              </Field>
              <Field label="Đến" hint="Ghi thẳng vào giấy phép, không nhắn riêng">
                <Input readOnly className="num" defaultValue="16:00" />
              </Field>
            </div>
            <span className="inline-flex h-8 items-center rounded-ctl border border-transparent bg-brand px-2.5 text-[0.8125rem] font-medium text-on-brand">
              Xác nhận duyệt
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Giấy phép đang hiệu lực" sub={`${DANG_CHAY.length} đăng ký`} />
        <div className="divide-y divide-line">
          {DANG_CHAY.map((x) => {
            const kq = changKyQuy(x)
            return (
              <div key={x.id} className="space-y-3 px-4 py-3">
                <Tom d={x} />
                <Hop tone={kq.buoc === 'chua_nop' ? 'canh' : 'trung'}>{kq.loi}</Hop>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex h-8 items-center rounded-ctl border border-transparent bg-brand px-2.5 text-[0.8125rem] font-medium text-on-brand">
                    Tất toán ký quỹ
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHead title="Đã khép" sub={`${DA_KHEP.length} đăng ký`} />
        <div className="divide-y divide-line">
          {DA_KHEP.map((x) => (
            <div key={x.id} className="space-y-2 px-4 py-3 opacity-80">
              <Tom d={x} />
              <p className="text-[0.8125rem] leading-relaxed text-muted">
                {changKyQuy(x).loi}
                {x.ly_do_tu_choi && <> Lý do từ chối: {x.ly_do_tu_choi}</>}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Hop tone="trung" title="Vì sao ký quỹ phải là một vòng đời">
        Ghi &ldquo;ký quỹ 10.000.000đ&rdquo; rồi thôi thì đến lúc trả lại không ai
        biết đã nhận bao nhiêu, trừ bao nhiêu, còn phải hoàn bao nhiêu — và người
        thiệt luôn là cư dân, vì họ không giữ sổ. Ở đây bốn con số đó nằm cạnh
        nhau, trừ tiền thì bắt buộc ghi lý do, và database chặn nếu trừ cộng hoàn
        không bằng đúng số đã nhận.
      </Hop>
    </div>
  )
}

function Tom({ d }: {
  d: {
    ma_can: string; loai: string; hang_muc: string; tu_ngay: string; den_ngay: string
    gio_bat_dau: string; gio_ket_thuc: string; lam_chu_nhat: boolean
    don_vi_thi_cong: string | null; dien_thoai: string | null
    trang_thai: string; dang_ky_luc: string; nguoi_dang_ky: string | null
  }
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[0.8125rem] font-medium text-ink">
          <span className="num">{d.ma_can}</span> · {NHAN_LOAI[d.loai as keyof typeof NHAN_LOAI]}
        </div>
        <div className="text-[0.8125rem] text-muted">{d.hang_muc}</div>
        <div className="num mt-0.5 text-[0.75rem] text-faint">
          {loiKhoangNgay(d.tu_ngay, d.den_ngay)} ·{' '}
          {loiKhungGio(d.gio_bat_dau, d.gio_ket_thuc, d.lam_chu_nhat)}
        </div>
        <div className="mt-0.5 text-[0.75rem] text-faint">
          {d.don_vi_thi_cong ?? 'Không ghi đơn vị thi công'}
          {d.dien_thoai && <span className="num"> · {d.dien_thoai}</span>}
          {' · đăng ký '}<span className="num">{ngayGioVN(d.dang_ky_luc)}</span>
          {d.nguoi_dang_ky && ` bởi ${d.nguoi_dang_ky}`}
        </div>
      </div>
      <span className="shrink-0">
        <Pill tone={TONE_TRANG_THAI[d.trang_thai as keyof typeof TONE_TRANG_THAI] ?? 'trung'}>
          {NHAN_TRANG_THAI[d.trang_thai as keyof typeof NHAN_TRANG_THAI] ?? d.trang_thai}
        </Pill>
      </span>
    </div>
  )
}
