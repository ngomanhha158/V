import { Card, CardHead, Field, Hop, PageHead, Pill, Select, Textarea, cx, ngayGioVN } from '@/components/ui'
import {
  NHAN_CHO, NHAN_MUC_DO, TONE_CHO, TONE_MUC_DO,
  loiDangTruc, loiGioCa, loiThoiGian, mucCho,
} from '@/lib/ca-truc'

// Dùng chung mucCho/loiThoiGian/loiDangTruc với màn thật: câu "đã chờ ký bao
// lâu" là con số đáng nói nhất ở đây, và demo nói khác bản thật thì nó dạy sai
// đúng chỗ người ta cần học.

const NEO = Date.parse('2026-09-05T06:12:00Z')

const TRUC = [
  { phien_id: 'p1', ca: 'Ca ngày', gio: loiGioCa('06:00:00', '18:00:00'),
    ho_ten: 'Đỗ Văn Thắng', vao_luc: '2026-09-05T06:05:00Z', la_toi: true },
  { phien_id: 'p2', ca: 'Ca đêm', gio: loiGioCa('18:00:00', '06:00:00'),
    // Vào ca 18h hôm trước, giờ đã 12 tiếng — sắp hết ca, chưa bàn giao.
    ho_ten: 'Nguyễn Văn Cường', vao_luc: '2026-09-04T18:02:00Z', la_toi: false },
]

const CHO_KY = [
  {
    id: 'b1', luc: '2026-09-05T06:08:00Z', ca_ra: 'Ca đêm', ca_vao: 'Ca ngày',
    nguoi_ra: 'Nguyễn Văn Cường', nguoi_vao: 'Đỗ Văn Thắng', so_viec: 3, gio_cho: 0.07,
    cho_toi_ky: true,
    tinh_hinh:
      'Bơm tầng hầm kêu bất thường từ 2h. Đã tắt luân phiên, chờ kỹ thuật sáng.\n'
      + 'Thang máy tháp A dừng tầng 9 lúc 23h40, khách tự mở cửa ra được, đã báo hãng.\n'
      + 'Cửa ra hầm B1 đóng không khít, tạm chèn, cần thợ.',
  },
  {
    id: 'b2', luc: '2026-09-04T06:04:00Z', ca_ra: 'Ca đêm', ca_vao: 'Ca ngày',
    nguoi_ra: 'Trần Quốc Hưng', nguoi_vao: 'Đỗ Văn Thắng', so_viec: 1, gio_cho: 24.1,
    cho_toi_ky: false,
    tinh_hinh: 'Đêm yên. Chỉ có xe 51K-123.45 đỗ chắn lối thoát hiểm, đã nhắc chủ xe.',
  },
]

const VIEC = [
  { id: 'y1', title: 'Bơm tầng hầm kêu bất thường', priority: 'urgent', ma_can: 'Khu kỹ thuật' },
  { id: 'y2', title: 'Thang máy tháp A dừng tầng 9', priority: 'high', ma_can: 'P1-09.00' },
  { id: 'y3', title: 'Cửa ra hầm B1 đóng không khít', priority: 'normal', ma_can: 'Hầm B1' },
  { id: 'y4', title: 'Rác tầng 12 chưa dọn', priority: 'normal', ma_can: 'P1-12.00' },
]

const SO = [
  { id: 's1', luc: '2026-09-05T06:08:00Z', ca_ra: 'Ca đêm', ca_vao: 'Ca ngày',
    nguoi_ra: 'Nguyễn Văn Cường', nguoi_vao: 'Đỗ Văn Thắng', so_viec: 3,
    ky_nhan_luc: null as string | null, tinh_hinh: 'Bơm tầng hầm kêu bất thường từ 2h…' },
  { id: 's2', luc: '2026-09-04T18:03:00Z', ca_ra: 'Ca ngày', ca_vao: 'Ca đêm',
    nguoi_ra: 'Đỗ Văn Thắng', nguoi_vao: 'Nguyễn Văn Cường', so_viec: 1,
    ky_nhan_luc: '2026-09-04T18:06:00Z', tinh_hinh: 'Đã bàn giao chìa khóa kho. Không có gì bất thường.' },
  { id: 's3', luc: '2026-09-04T06:04:00Z', ca_ra: 'Ca đêm', ca_vao: 'Ca ngày',
    nguoi_ra: 'Trần Quốc Hưng', nguoi_vao: 'Đỗ Văn Thắng', so_viec: 1,
    ky_nhan_luc: null, tinh_hinh: 'Đêm yên. Chỉ có xe 51K-123.45 đỗ chắn lối thoát hiểm.' },
]

export default function Page() {
  return (
    <div className="space-y-5">
      <PageHead
        title="Ca trực"
        sub="Biên bản bàn giao có hai người ký, và việc chuyển tiếp neo vào yêu cầu có thật"
      />

      <Card>
        <CardHead title="Đang trực" sub={`${TRUC.length} người`} />
        <div className="space-y-3 p-4">
          <div className="divide-y divide-line rounded-card border border-line">
            {TRUC.map((t) => {
              const l = loiDangTruc(t.vao_luc, NEO)
              return (
                <div key={t.phien_id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                  <span className="min-w-0 text-[0.8125rem]">
                    <span className="font-medium text-ink">{t.ho_ten}</span>
                    <span className="text-muted"> · {t.ca}</span>
                    <span className="num text-faint"> ({t.gio})</span>
                    {t.la_toi && <span className="text-brand"> · bạn</span>}
                    <span className={cx('block text-[0.75rem]', l.tone === 'xau' ? 'text-bad' : 'text-faint')}>
                      {l.loi} Vào lúc <span className="num">{ngayGioVN(t.vao_luc)}</span>.
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Biên bản chờ ký nhận"
          sub="Chưa ai ký nghĩa là ca sau đang làm mà chưa đọc gì của ca trước"
        />
        <div className="divide-y divide-line">
          {CHO_KY.map((b) => {
            const m = mucCho(b.gio_cho)
            return (
              <div key={b.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[0.8125rem] font-medium text-ink">
                      {b.nguoi_ra} → {b.nguoi_vao}
                    </div>
                    <div className="num text-[0.75rem] text-faint">
                      {b.ca_ra} → {b.ca_vao} · {ngayGioVN(b.luc)} · đã chờ {loiThoiGian(b.gio_cho)}
                      {b.so_viec > 0 && ` · ${b.so_viec} việc chuyển tiếp`}
                    </div>
                  </div>
                  <Pill tone={TONE_CHO[m]}>{NHAN_CHO[m]}</Pill>
                </div>
                <p className="rounded-ctl bg-sunken px-3 py-2 text-[0.8125rem] leading-relaxed whitespace-pre-line text-ink">
                  {b.tinh_hinh}
                </p>
                {b.cho_toi_ky && (
                  <span className="inline-flex h-8 items-center rounded-ctl border border-transparent bg-brand px-2.5 text-[0.8125rem] font-medium text-on-brand">
                    Ký nhận ca
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHead title="Bàn giao ca của bạn" sub="Ca ra viết, ca vào ký nhận" />
        <div className="space-y-3 p-4">
          <Field label="Bàn giao cho" hint="Chỉ hiện những người đã vào ca">
            <Select defaultValue="p2">
              <option value="p2">Nguyễn Văn Cường · Ca đêm</option>
            </Select>
          </Field>
          <Field
            label="Tình hình ca"
            hint='Bắt buộc. "Không có gì bất thường" cũng là một câu phải viết ra — im lặng và bình yên trông giống hệt nhau trong sổ.'
          >
            <Textarea rows={3} readOnly defaultValue="" placeholder="Bơm tầng hầm kêu bất thường từ 2h. Đã tắt luân phiên, chờ kỹ thuật sáng." />
          </Field>
          <Field
            label="Việc chuyển tiếp"
            hint="Tích những việc ca sau phải theo. Ca sau bấm mở được từng việc — nên đây là danh sách để làm, không phải một dòng ghi chú."
          >
            <div className="space-y-1.5 rounded-ctl border border-line p-2">
              {VIEC.map((v, i) => (
                <span key={v.id} className="flex items-start gap-2 rounded-ctl px-2 py-1.5">
                  <input type="checkbox" defaultChecked={i < 3} readOnly className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1 text-[0.8125rem]">
                    <span className="font-medium text-ink">{v.title}</span>
                    <span className="num text-faint"> · {v.ma_can}</span>
                  </span>
                  <Pill tone={TONE_MUC_DO[v.priority]}>{NHAN_MUC_DO[v.priority]}</Pill>
                </span>
              ))}
            </div>
          </Field>
          <span className="inline-flex h-10 items-center rounded-ctl border border-transparent bg-brand px-3.5 text-sm font-medium text-on-brand">
            Bàn giao và kết ca
          </span>
          <p className="text-[0.75rem] leading-relaxed text-muted">
            Bấm nút này là kết luôn ca của bạn. Hai việc đó cố ý đi liền nhau: tách ra
            thì lại có người về mà chưa bàn giao.
          </p>
        </div>
      </Card>

      <Card>
        <CardHead title="Sổ bàn giao 7 ngày" sub={`${SO.length} biên bản`} />
        <div className="divide-y divide-line">
          {SO.map((b) => (
            <div key={b.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[0.8125rem] font-medium text-ink">
                    {b.nguoi_ra} → {b.nguoi_vao}
                  </div>
                  <div className="num text-[0.75rem] text-faint">
                    {b.ca_ra} → {b.ca_vao} · {ngayGioVN(b.luc)}
                    {b.so_viec > 0 && ` · ${b.so_viec} việc chuyển tiếp`}
                  </div>
                </div>
                <Pill tone={b.ky_nhan_luc ? 'tot' : 'canh'}>
                  {b.ky_nhan_luc ? `Đã ký ${ngayGioVN(b.ky_nhan_luc)}` : 'Chưa ký nhận'}
                </Pill>
              </div>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{b.tinh_hinh}</p>
            </div>
          ))}
        </div>
      </Card>

      <Hop tone="trung" title="Vì sao người NHẬN ca ký, không phải người giao">
        Ca ra viết biên bản, ca vào ký xác nhận đã đọc. Nếu ca ra tự ký thì
        &ldquo;tôi đã báo rồi&rdquo; và &ldquo;tôi chưa nghe ai nói gì&rdquo; vẫn là hai
        lời khai không có gì phân xử — mà đó chính là cuộc cãi nhau tính năng này
        sinh ra để chấm dứt. Việc chuyển tiếp cũng vì thế mà neo vào yêu cầu có thật:
        ca sau bấm mở được từng việc, thay vì đọc một dòng ghi chú rồi tự đoán.
      </Hop>
    </div>
  )
}
