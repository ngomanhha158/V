import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import {
  Card, CardHead, Hop, PageHead, Pill, Trong, cx, ngayGioVN,
} from '@/components/ui'
import {
  NHAN_CHO, NHAN_MUC_DO, NHAN_TRANG_THAI_YC, TONE_CHO, TONE_MUC_DO,
  loiDangTruc, loiGioCa, loiThoiGian, mucCho,
} from '@/lib/ca-truc'
import { FormBanGiao, FormKetCa, FormVaoCa, NutKyNhan } from './form'

/**
 * Ca trực và biên bản bàn giao ca.
 *
 * Màn này người trực mở hai lần mỗi ca — lúc vào và lúc ra — nên nó phải trả
 * lời ngay được hai câu: ai đang trực, và có biên bản nào chờ tôi ký không.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const [project, { data: me }] = await Promise.all([
    duAnBQL(),
    db.auth.getUser(),
  ])
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Ca trực" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }
  const uid = me.user?.id ?? null

  const homNay = new Date().toISOString().slice(0, 10)
  const truoc7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const [
    { data: ca, error: loiCa },
    { data: truc },
    { data: chuaKy },
    { data: so },
    { data: viecMo },
  ] = await Promise.all([
    db.from('ca_truc').select('*').eq('project_id', project.id).eq('dang_dung', true).order('bat_dau'),
    db.rpc('dang_truc', { p_project: project.id }),
    db.rpc('ban_giao_chua_ky', { p_project: project.id }),
    db.rpc('so_ban_giao_ca', { p_project: project.id, p_tu: truoc7, p_den: homNay }),
    db.from('tickets')
      .select('id, title, priority, units!inner(code)')
      .eq('project_id', project.id)
      .not('status', 'in', '("resolved","closed","rejected")')
      .order('priority', { ascending: false })
      .limit(40),
  ])

  const gioCa = new Map((ca ?? []).map((c) => [c.id, loiGioCa(c.bat_dau, c.ket_thuc)]))
  const dsTruc = truc ?? []
  const cuaToi = dsTruc.find((t) => t.la_toi) ?? null
  const nguoiKhac = dsTruc.filter((t) => !t.la_toi)
  // Biên bản chờ CHÍNH TÔI ký đứng riêng trên cùng: nó là việc phải làm ngay,
  // khác hẳn danh sách chờ ký của cả tòa vốn là thứ trưởng BQL nhìn.
  const cho = (chuaKy ?? []).filter((b) => b.nguoi_vao != null)
  const viec = (viecMo ?? []).map((t) => ({
    id: t.id, title: t.title, priority: String(t.priority),
    ma_can: (t as unknown as { units: { code: string } }).units?.code ?? '—',
  }))

  return (
    <div className="space-y-5">
      <PageHead
        title="Ca trực"
        sub="Biên bản bàn giao có hai người ký, và việc chuyển tiếp neo vào yêu cầu có thật"
      />

      {loiCa && (
        <Hop tone="xau" title="Không đọc được danh mục ca">
          {loiCa.code === '42883' || loiCa.code === '42P01'
            ? 'Phần ca trực chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : loiCa.message}
        </Hop>
      )}

      <Card>
        <CardHead
          title="Đang trực"
          sub={dsTruc.length === 0 ? 'Không có ai đang trực' : `${dsTruc.length} người`}
        />
        <div className="space-y-3 p-4">
          {dsTruc.length === 0 ? (
            <Hop tone="canh">
              Không có ai đang trực. Nếu đang có người ở quầy thì họ chưa bấm vào ca —
              mà chưa vào ca thì không bàn giao được, và ca sau sẽ không nhận được gì.
            </Hop>
          ) : (
            <div className="divide-y divide-line rounded-card border border-line">
              {dsTruc.map((t) => {
                const l = loiDangTruc(t.vao_luc)
                return (
                  <div key={t.phien_id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                    <span className="min-w-0 text-[0.8125rem]">
                      <span className="font-medium text-ink">{t.ho_ten ?? 'Chưa có tên'}</span>
                      <span className="text-muted"> · {t.ca}</span>
                      {gioCa.has(t.ca_id) && (
                        <span className="num text-faint"> ({gioCa.get(t.ca_id)})</span>
                      )}
                      {t.la_toi && <span className="text-brand"> · bạn</span>}
                      <span className={cx('block text-[0.75rem]', l.tone === 'xau' ? 'text-bad' : 'text-faint')}>
                        {l.loi} Vào lúc <span className="num">{ngayGioVN(t.vao_luc)}</span>.
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {!cuaToi && (ca ?? []).length > 0 && (
            <FormVaoCa
              ca={(ca ?? []).map((c) => ({ id: c.id, ten: c.ten, gio: loiGioCa(c.bat_dau, c.ket_thuc) }))}
            />
          )}
          {!cuaToi && (ca ?? []).length === 0 && !loiCa && (
            <Hop tone="canh" title="Chưa khai báo ca nào">
              Thêm ca ở{' '}
              <Link href="/bql/nguoi-dung" className="font-medium underline">Người dùng &amp; phân quyền</Link>
              {' '}— hoặc chạy thẳng vào bảng <span className="num">ca_truc</span>. Ví dụ: Ca ngày
              06:00–18:00, Ca đêm 18:00–06:00.
            </Hop>
          )}
        </div>
      </Card>

      {cho.length > 0 && (
        <Card>
          <CardHead
            title="Biên bản chờ ký nhận"
            sub="Chưa ai ký nghĩa là ca sau đang làm mà chưa đọc gì của ca trước"
          />
          <div className="divide-y divide-line">
            {cho.map((b) => {
              const m = mucCho(Number(b.gio_cho))
              const laCuaToi = b.cho_toi_ky
              return (
                <div key={b.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[0.8125rem] font-medium text-ink">
                        {b.nguoi_ra ?? '—'} → {b.nguoi_vao ?? '—'}
                      </div>
                      <div className="num text-[0.75rem] text-faint">
                        {b.ca_ra} → {b.ca_vao} · {ngayGioVN(b.luc)} · đã chờ{' '}
                        {loiThoiGian(Number(b.gio_cho))}
                        {b.so_viec > 0 && ` · ${b.so_viec} việc chuyển tiếp`}
                      </div>
                    </div>
                    <Pill tone={TONE_CHO[m]}>{NHAN_CHO[m]}</Pill>
                  </div>
                  <p className="rounded-ctl bg-sunken px-3 py-2 text-[0.8125rem] leading-relaxed whitespace-pre-line text-ink">
                    {b.tinh_hinh}
                  </p>
                  {laCuaToi && <NutKyNhan id={b.id} />}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardHead title="Bàn giao ca của bạn" sub="Ca ra viết, ca vào ký nhận" />
        <div className="p-4">
          <FormBanGiao
            phienCuaToi={cuaToi ? { phien_id: cuaToi.phien_id, ca: cuaToi.ca } : null}
            nguoiKhac={nguoiKhac.map((n) => ({ phien_id: n.phien_id, ca: n.ca, ho_ten: n.ho_ten }))}
            viecMo={viec}
          />
        </div>
      </Card>

      <Card>
        <CardHead title="Sổ bàn giao 7 ngày" sub={`${(so ?? []).length} biên bản`} />
        {(so ?? []).length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có biên bản nào trong 7 ngày">
              Mỗi lần đổi ca là một biên bản. Không có biên bản nào nghĩa là các ca
              đang bàn giao miệng — hoặc không bàn giao gì cả.
            </Trong>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {(so ?? []).map((b) => (
              <div key={b.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[0.8125rem] font-medium text-ink">
                      {b.nguoi_ra ?? '—'} → {b.nguoi_vao ?? '—'}
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
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed whitespace-pre-line text-muted">
                  {b.tinh_hinh}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {cuaToi && (
        <div className="flex justify-end">
          <FormKetCa phien={cuaToi.phien_id} />
        </div>
      )}

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
