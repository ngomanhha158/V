import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import {
  docNguoi, docThayDoi, TEN_BANG, TEN_THAO_TAC, tenBang,
} from '@/lib/nhat-ky'
import {
  Bang, Card, CardHead, Hop, ngayGioVN, PageHead, Pill, Stat, Td, Th, Tr, Trong,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

const MOI_TRANG = 50
const THAO_TAC = ['INSERT', 'UPDATE', 'DELETE'] as const

type ThamSo = { bang?: string; tt?: string; ngay?: string; trang?: string }

/** Số ngày nhìn lại. Mặc định 30: đủ cho câu hỏi thường gặp, mà không kéo cả năm. */
const NGAY = [7, 30, 90, 365]

function query(sp: ThamSo, them: Record<string, string> = {}): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...sp, ...them })) if (v) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export default async function NhatKy({
  searchParams,
}: { searchParams: Promise<ThamSo> }) {
  const sp = await searchParams
  const db = await createClient()

  const project = await duAnBQL()
  if (!project) return <Trong title="Chưa có dự án nào trong hệ thống" />
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const soNgay = NGAY.includes(Number(sp.ngay)) ? Number(sp.ngay) : 30
  const bang = sp.bang && sp.bang in TEN_BANG ? sp.bang : ''
  const tt = (THAO_TAC as readonly string[]).includes(sp.tt ?? '') ? sp.tt! : ''
  const trang = Math.max(1, Number(sp.trang) || 1)
  const tu = new Date(Date.now() - soNgay * 86400_000).toISOString()

  let q = db
    .from('audit_log')
    .select('id, at, actor_id, actor_role, bang, ban_ghi, thao_tac, truoc, sau', { count: 'exact' })
    .eq('project_id', project.id)
    .gte('at', tu)
  if (bang) q = q.eq('bang', bang)
  if (tt) q = q.eq('thao_tac', tt)

  const { data, count, error } = await q
    .order('at', { ascending: false }).order('id', { ascending: false })
    .range((trang - 1) * MOI_TRANG, trang * MOI_TRANG - 1)

  if (error) {
    return (
      <div className="space-y-5">
        <PageHead title="Nhật ký kiểm toán" />
        <Hop tone="xau" title="Không đọc được nhật ký">
          {error.code === '42P01'
            ? 'Bảng audit_log chưa có trên database. Chạy lại schema.sql rồi mở lại trang này.'
            : error.code === '42501'
              ? 'Chưa mở quyền đọc audit_log. Chạy lại auth_hooks.sql (phần grant select).'
              : error.message}
        </Hop>
      </div>
    )
  }

  const ds = data ?? []
  const tong = count ?? 0
  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG))

  // Tên người tra riêng: audit_log cố ý KHÔNG có khóa ngoại sang profiles —
  // xóa một hồ sơ không được phép kéo theo việc xóa dấu vết người đó đã làm gì.
  const ids = [...new Set(ds.map((r) => r.actor_id).filter((v): v is string => !!v))]
  const { data: hoSo } = ids.length
    ? await db.from('profiles').select('id, full_name').in('id', ids)
    : { data: [] }
  const ten = new Map((hoSo ?? []).map((p) => [p.id, p.full_name]))

  const soTuDong = ds.filter((r) => !r.actor_id).length

  return (
    <div className="space-y-5">
      <PageHead
        title="Nhật ký kiểm toán"
        sub={`${project.name} · ${soNgay} ngày gần nhất`}
        actions={<Pill tone="trung" cham={false}>{tong} dòng</Pill>}
      />

      <Hop tone="trung" title="Sổ này không sửa được, kể cả bởi ban quản lý">
        Ghi bằng trigger ở tầng database nên mọi đường ghi đều đi qua nó — màn BQL, webhook
        ngân hàng, cron, hay gõ tay trong SQL editor. Không role nào được cấp quyền sửa hay
        xóa dòng sổ: sổ mà người bị ghi sổ sửa được thì vô nghĩa.
        <br /><br />
        Chỉ ghi <strong>những cột thật sự đổi</strong>, không chụp cả dòng. Giá trị của mấy
        cột nhạy cảm (gói tin ngân hàng, số CCCD) ghi là <em>(đã ẩn)</em> — sổ vẫn nói là
        chúng có đổi, chỉ không nhân bản nội dung sang thêm một bảng nữa.
      </Hop>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat nhan="Dòng trong khoảng" so={tong} />
        <Stat nhan="Đang xem" so={ds.length} phu={`trang ${trang}/${soTrang}`} />
        <Stat
          nhan="Không có người" so={soTuDong}
          phu="cron, webhook hoặc gõ thẳng database"
          tone={soTuDong ? 'canh' : 'trung'}
        />
      </div>

      <Card>
        <CardHead title="Lọc" />
        <div className="flex flex-wrap gap-4 p-4">
          <Nhom nhan="Khoảng thời gian">
            {NGAY.map((n) => (
              <Loc key={n} href={`/bql/nhat-ky${query(sp, { ngay: String(n), trang: '' })}`} chon={n === soNgay}>
                {n === 365 ? '1 năm' : `${n} ngày`}
              </Loc>
            ))}
          </Nhom>
          <Nhom nhan="Thao tác">
            <Loc href={`/bql/nhat-ky${query(sp, { tt: '', trang: '' })}`} chon={!tt}>Tất cả</Loc>
            {THAO_TAC.map((t) => (
              <Loc key={t} href={`/bql/nhat-ky${query(sp, { tt: t, trang: '' })}`} chon={t === tt}>
                {TEN_THAO_TAC[t].nhan}
              </Loc>
            ))}
          </Nhom>
          <Nhom nhan="Bảng">
            <Loc href={`/bql/nhat-ky${query(sp, { bang: '', trang: '' })}`} chon={!bang}>Tất cả</Loc>
            {Object.entries(TEN_BANG).map(([k, v]) => (
              <Loc key={k} href={`/bql/nhat-ky${query(sp, { bang: k, trang: '' })}`} chon={k === bang}>
                {v}
              </Loc>
            ))}
          </Nhom>
        </div>
      </Card>

      <Card>
        <CardHead title="Dòng sổ" right={<span className="text-[0.8125rem] text-faint">{tong}</span>} />
        {ds.length === 0 ? (
          <div className="p-4">
            <Trong title="Không có dòng nào khớp">
              {tong === 0 && !bang && !tt
                ? 'Chưa có thay đổi nào trong khoảng này — hoặc sổ mới bắt đầu ghi từ lần cập nhật gần nhất.'
                : 'Nới bộ lọc hoặc kéo dài khoảng thời gian.'}
            </Trong>
          </div>
        ) : (
          <>
            <Bang>
              <thead>
                <tr>
                  <Th>Thời điểm</Th><Th>Người</Th><Th>Bảng</Th>
                  <Th>Thao tác</Th><Th>Thay đổi</Th>
                </tr>
              </thead>
              <tbody>
                {ds.map((r) => {
                  const tac = TEN_THAO_TAC[r.thao_tac]
                  const doi = docThayDoi(r.truoc, r.sau)
                  return (
                    <Tr key={r.id}>
                      <Td className="whitespace-nowrap text-muted">{ngayGioVN(r.at)}</Td>
                      <Td className="text-ink">
                        {docNguoi(r.actor_id, r.actor_role, ten.get(r.actor_id ?? ''))}
                      </Td>
                      <Td>
                        <div className="font-medium text-ink">{tenBang(r.bang)}</div>
                        <div className="font-mono text-[0.75rem] text-faint">
                          {r.ban_ghi.slice(0, 8)}
                        </div>
                      </Td>
                      <Td>
                        {tac ? <Pill tone={tac.tone}>{tac.nhan}</Pill> : r.thao_tac}
                      </Td>
                      <Td>
                        {doi.length === 0
                          ? <span className="text-faint">—</span>
                          : (
                            <ul className="space-y-0.5">
                              {doi.map((d) => (
                                <li key={d.cot} className="text-[0.8125rem] leading-snug">
                                  <span className="text-muted">{d.nhan}: </span>
                                  <span className="text-faint line-through">{d.truoc}</span>
                                  <span className="text-faint"> → </span>
                                  <span className="font-medium text-ink">{d.sau}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Bang>

            {soTrang > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                <span className="text-[0.8125rem] text-faint">Trang {trang}/{soTrang}</span>
                <div className="flex gap-2">
                  <TrangLink href={`/bql/nhat-ky${query(sp, { trang: String(trang - 1) })}`} tat={trang <= 1}>
                    Trước
                  </TrangLink>
                  <TrangLink href={`/bql/nhat-ky${query(sp, { trang: String(trang + 1) })}`} tat={trang >= soTrang}>
                    Sau
                  </TrangLink>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

function Nhom({ nhan, children }: { nhan: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[0.75rem] font-semibold tracking-wide text-faint uppercase">
        {nhan}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Loc({ href, chon, children }: { href: string; chon: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
        chon
          ? 'border-transparent bg-ink text-canvas'
          : 'border-line bg-surface text-muted hover:border-line-firm hover:text-ink'
      }`}
    >
      {children}
    </Link>
  )
}

function TrangLink({ href, tat, children }: { href: string; tat: boolean; children: string }) {
  const lop = 'inline-flex h-8 items-center rounded-ctl border px-2.5 text-[0.8125rem] font-medium'
  return tat
    ? <span className={`${lop} border-line text-faint`}>{children}</span>
    : <Link href={href} className={`${lop} border-line-firm text-ink hover:bg-sunken`}>{children}</Link>
}
