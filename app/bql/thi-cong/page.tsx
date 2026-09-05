import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import { Card, CardHead, Hop, PageHead, Pill, Trong, cx, ngayGioVN, vnd } from '@/components/ui'
import {
  NHAN_LOAI, NHAN_TRANG_THAI, TONE_TRANG_THAI,
  changKyQuy, loiKhoangNgay, loiKhungGio,
} from '@/lib/thi-cong'
import { FormDuyet, FormKyQuy, FormTatToan, NutHuy } from './form'

/**
 * Đăng ký chuyển nhà và thi công nội thất.
 *
 * Hai màn trong một: khối trên cùng là màn của BẢO VỆ — hôm nay ai được lên,
 * ai không, và vì sao không. Phần còn lại là màn duyệt của ban quản lý.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const project = await duAnBQL()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Chuyển nhà & thi công" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const [{ data: ds, error }, { data: homNay }] = await Promise.all([
    db.rpc('thi_cong_ds', { p_project: project.id, p_trang_thai: null }),
    db.rpc('thi_cong_hom_nay', { p_project: project.id }),
  ])
  const rows = ds ?? []
  const cho = rows.filter((d) => d.trang_thai === 'cho_duyet')
  const dangChay = rows.filter((d) => d.trang_thai === 'da_duyet')
  const daKhep = rows.filter((d) => !['cho_duyet', 'da_duyet'].includes(d.trang_thai))

  return (
    <div className="space-y-5">
      <PageHead
        title="Chuyển nhà & thi công"
        sub="Giờ được phép là một luật, và ký quỹ là một vòng đời — không phải hai dòng ghi chú"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần đăng ký thi công chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      <Card>
        <CardHead
          title="Hôm nay ở sảnh"
          sub="Bảo vệ mở màn này khi có xe vật liệu tới"
        />
        {(homNay ?? []).length === 0 ? (
          <p className="p-4 text-[0.8125rem] text-muted">
            Hôm nay không có giấy phép nào còn hiệu lực. Có ai chở vật liệu lên thì
            hỏi đăng ký — chưa đăng ký là chưa được.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {(homNay ?? []).map((h) => (
              <div key={h.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[0.8125rem] font-medium text-ink">
                    <span className="num">{h.ma_can}</span> · {NHAN_LOAI[h.loai as keyof typeof NHAN_LOAI] ?? h.loai}
                  </div>
                  <div className="text-[0.8125rem] text-muted">{h.hang_muc}</div>
                  <div className="num mt-0.5 text-[0.75rem] text-faint">
                    {h.don_vi_thi_cong ?? 'Không ghi đơn vị'}
                    {h.dien_thoai && ` · ${h.dien_thoai}`}
                    {h.so_nguoi && ` · ${h.so_nguoi} người`}
                    {' · '}{h.gio_bat_dau.slice(0, 5)}–{h.gio_ket_thuc.slice(0, 5)}
                  </div>
                </div>
                {/* Lý do đứng cạnh chữ "Không": ba lý do khác nhau dẫn tới ba
                    việc khác nhau cho người đang đứng ở sảnh. */}
                <div className="shrink-0 text-right">
                  <Pill tone={h.duoc ? 'tot' : 'xau'}>{h.duoc ? 'Được lên' : 'Không được'}</Pill>
                  {!h.duoc && (
                    <div className="mt-1 max-w-[16rem] text-[0.75rem] text-bad">{h.ly_do}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {cho.length > 0 && (
        <Card>
          <CardHead title={`${cho.length} đơn chờ duyệt`} sub="Duyệt là ấn định mức ký quỹ và khung giờ" />
          <div className="divide-y divide-line">
            {cho.map((d) => (
              <div key={d.id} className="space-y-3 px-4 py-3">
                <Tom d={d} />
                <FormDuyet
                  id={d.id} loai={d.loai} tu={d.tu_ngay} den={d.den_ngay}
                  gioBd={d.gio_bat_dau} gioKt={d.gio_ket_thuc} lamCN={d.lam_chu_nhat}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHead title="Giấy phép đang hiệu lực" sub={`${dangChay.length} đăng ký`} />
        {dangChay.length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có giấy phép nào đang hiệu lực">
              Đăng ký được duyệt sẽ hiện ở đây cho tới khi tất toán ký quỹ.
            </Trong>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {dangChay.map((d) => {
              const kq = changKyQuy(d)
              return (
                <div key={d.id} className="space-y-3 px-4 py-3">
                  <Tom d={d} />
                  <Hop tone={kq.buoc === 'chua_nop' ? 'canh' : 'trung'}>{kq.loi}</Hop>
                  {kq.buoc === 'chua_nop' && <FormKyQuy id={d.id} conThieu={kq.con_thieu} />}
                  <div className="flex flex-wrap items-start gap-3">
                    <FormTatToan id={d.id} daNop={d.ky_quy_da_nop} />
                    {d.ky_quy_da_nop === 0 && <NutHuy id={d.id} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {daKhep.length > 0 && (
        <Card>
          <CardHead title="Đã khép" sub={`${daKhep.length} đăng ký`} />
          <div className="divide-y divide-line">
            {daKhep.map((d) => (
              <div key={d.id} className="space-y-2 px-4 py-3 opacity-80">
                <Tom d={d} />
                <p className="text-[0.8125rem] leading-relaxed text-muted">
                  {changKyQuy(d).loi}
                  {d.ly_do_tu_choi && <> Lý do từ chối: {d.ly_do_tu_choi}</>}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

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
    ma_can: string; toa: string; loai: string; hang_muc: string
    tu_ngay: string; den_ngay: string; gio_bat_dau: string; gio_ket_thuc: string
    lam_chu_nhat: boolean; don_vi_thi_cong: string | null; dien_thoai: string | null
    trang_thai: string; dang_ky_luc: string; nguoi_dang_ky: string | null
  }
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[0.8125rem] font-medium text-ink">
          <span className="num">{d.ma_can}</span> · {NHAN_LOAI[d.loai as keyof typeof NHAN_LOAI] ?? d.loai}
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
      <span className={cx('shrink-0')}>
        <Pill tone={TONE_TRANG_THAI[d.trang_thai as keyof typeof TONE_TRANG_THAI] ?? 'trung'}>
          {NHAN_TRANG_THAI[d.trang_thai as keyof typeof NHAN_TRANG_THAI] ?? d.trang_thai}
        </Pill>
      </span>
    </div>
  )
}
