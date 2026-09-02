import Link from 'next/link'
import {
  docNguoi, docThayDoi, TEN_BANG, TEN_THAO_TAC, tenBang,
} from '@/lib/nhat-ky'
import {
  Bang, Card, CardHead, Hop, ngayGioVN, PageHead, Pill, Stat, Td, Th, Tr, Trong,
} from '@/components/ui'
import { DU_AN, NHAT_KY, TEN_NGUOI_GHI_SO } from '@/lib/demo/data'

export const dynamic = 'force-dynamic'

// Dùng chung TEN_BANG, TEN_THAO_TAC, docThayDoi, docNguoi với màn thật — cách
// đọc một dòng sổ mà lệch nhau giữa hai màn là bản demo dạy sai người dùng.
// Lọc bằng URL y như màn thật, chỉ khác nguồn dữ liệu là mảng trong bộ nhớ.

const THAO_TAC = ['INSERT', 'UPDATE', 'DELETE'] as const
const NGAY = [7, 30, 90, 365]

type ThamSo = { bang?: string; tt?: string; ngay?: string }

function query(sp: ThamSo, them: Record<string, string> = {}): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...sp, ...them })) if (v) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export default async function DemoNhatKy({
  searchParams,
}: { searchParams: Promise<ThamSo> }) {
  const sp = await searchParams
  const soNgay = NGAY.includes(Number(sp.ngay)) ? Number(sp.ngay) : 30
  const bang = sp.bang && sp.bang in TEN_BANG ? sp.bang : ''
  const tt = (THAO_TAC as readonly string[]).includes(sp.tt ?? '') ? sp.tt! : ''
  const tu = Date.now() - soNgay * 86400_000

  const ds = NHAT_KY.filter((r) =>
    new Date(r.at).getTime() >= tu
    && (!bang || r.bang === bang)
    && (!tt || r.thao_tac === tt))

  const soTuDong = ds.filter((r) => !r.actor_id).length

  return (
    <div className="space-y-5">
      <PageHead
        title="Nhật ký kiểm toán"
        sub={`${DU_AN.ten} · ${soNgay} ngày gần nhất`}
        actions={<Pill tone="trung" cham={false}>{ds.length} dòng</Pill>}
      />

      <Hop tone="trung" title="Sổ này không sửa được, kể cả bởi ban quản lý">
        Ghi bằng trigger ở tầng database nên mọi đường ghi đều đi qua nó — màn BQL, webhook
        ngân hàng, cron, hay gõ tay trong SQL editor. Không role nào được cấp quyền sửa hay
        xóa dòng sổ: sổ mà người bị ghi sổ sửa được thì vô nghĩa.
        <br /><br />
        Chỉ ghi <strong>những cột thật sự đổi</strong>, không chụp cả dòng. Giá trị của mấy
        cột nhạy cảm (gói tin ngân hàng, số CCCD) ghi là <em>(đã ẩn)</em> — xem dòng
        &ldquo;Sổ tiền về&rdquo; bên dưới.
      </Hop>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat nhan="Dòng trong khoảng" so={ds.length} />
        <Stat nhan="Bảng được ghi sổ" so={Object.keys(TEN_BANG).length} phu="tiền, quyền, và số đẻ ra tiền" />
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
              <Loc key={n} href={`/demo/bql/nhat-ky${query(sp, { ngay: String(n) })}`} chon={n === soNgay}>
                {n === 365 ? '1 năm' : `${n} ngày`}
              </Loc>
            ))}
          </Nhom>
          <Nhom nhan="Thao tác">
            <Loc href={`/demo/bql/nhat-ky${query(sp, { tt: '' })}`} chon={!tt}>Tất cả</Loc>
            {THAO_TAC.map((t) => (
              <Loc key={t} href={`/demo/bql/nhat-ky${query(sp, { tt: t })}`} chon={t === tt}>
                {TEN_THAO_TAC[t].nhan}
              </Loc>
            ))}
          </Nhom>
          <Nhom nhan="Bảng">
            <Loc href={`/demo/bql/nhat-ky${query(sp, { bang: '' })}`} chon={!bang}>Tất cả</Loc>
            {Object.entries(TEN_BANG).map(([k, v]) => (
              <Loc key={k} href={`/demo/bql/nhat-ky${query(sp, { bang: k })}`} chon={k === bang}>
                {v}
              </Loc>
            ))}
          </Nhom>
        </div>
      </Card>

      <Card>
        <CardHead title="Dòng sổ" right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>} />
        {ds.length === 0 ? (
          <div className="p-4">
            <Trong title="Không có dòng nào khớp">Nới bộ lọc hoặc kéo dài khoảng thời gian.</Trong>
          </div>
        ) : (
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
                      {docNguoi(r.actor_id, r.actor_role, TEN_NGUOI_GHI_SO[r.actor_id ?? ''])}
                    </Td>
                    <Td>
                      <div className="font-medium text-ink">{tenBang(r.bang)}</div>
                      <div className="font-mono text-[0.75rem] text-faint">{r.ban_ghi}</div>
                    </Td>
                    <Td>{tac ? <Pill tone={tac.tone}>{tac.nhan}</Pill> : r.thao_tac}</Td>
                    <Td>
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
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Bang>
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
