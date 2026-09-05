import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import {
  Bang, Card, CardHead, Chip, Hop, PageHead, Pill, Td, Th, Tr, Trong, ngayGioVN, vnd,
} from '@/components/ui'
import { HangDoi, type CanHo, type GiaoDich } from './hang-doi'

export const dynamic = 'force-dynamic'

const TAB = {
  chua_khop: 'Chờ đối soát',
  con_du:    'Còn dư',
  da_khop:   'Đã gạch',
  bo_qua:    'Đã bỏ qua',
  tat_ca:    'Tất cả',
} as const
type TabKey = keyof typeof TAB
const laTab = (v?: string): v is TabKey => !!v && v in TAB

export default async function DoiSoat({
  searchParams,
}: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams
  const tab: TabKey = laTab(sp.tab) ? sp.tab : 'chua_khop'

  const db = await createClient()
  const project = await duAnBQL()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const [{ data: rows, error }, { data: units }, { count: soChoXuLy }] = await Promise.all([
    db.rpc('bql_doi_soat', { p_project: project.id, p_trang_thai: tab }),
    db.from('units').select('id, code').order('code'),
    db.from('bank_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id).eq('trang_thai', 'chua_khop'),
  ])

  // Không nuốt lỗi: hàng đợi trống vì lỗi truy vấn trông y hệt hàng đợi trống
  // vì đã đối soát xong, mà hai chuyện đó ngược hẳn nhau.
  if (error) {
    return (
      <div className="space-y-5">
        <PageHead title="Đối soát tiền về" />
        <Hop tone="xau" title="Không tải được danh sách">{error.message}</Hop>
      </div>
    )
  }

  const ds = (rows ?? []) as GiaoDich[]
  const canHo = (units ?? []) as CanHo[]

  return (
    <div className="space-y-5">
      <PageHead
        title="Đối soát tiền về"
        sub={`${project.name} · tiền vào tài khoản mà máy chưa khớp được căn`}
        actions={
          soChoXuLy
            ? <Pill tone="canh">{soChoXuLy} giao dịch chờ</Pill>
            : <Pill tone="tot">Không còn tồn đọng</Pill>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TAB) as TabKey[]).map((k) => (
          <Chip key={k} href={`/bql/doi-soat?tab=${k}`} active={tab === k}>{TAB[k]}</Chip>
        ))}
      </div>

      {tab === 'chua_khop' && (
        <Hop tone="trung" title="Vì sao có màn này">
          Máy chỉ tự gạch khi nội dung chuyển khoản có đúng dạng{' '}
          <strong className="text-ink">VB &lt;mã căn&gt; &lt;YYYYMM&gt;</strong> — đúng chuỗi in
          trên mã QR của hóa đơn. Người gõ tay thì thiếu chữ, thiếu kỳ, hoặc ghi mỗi tên mình.
          Dò đoán mã căn trong những nội dung đó rồi tự gạch là sớm muộn tiền chạy sang nhà hàng
          xóm, nên phần còn lại để người thật quyết. Gợi ý bên dưới chỉ điền sẵn ô chọn, không tự
          bấm thay.
        </Hop>
      )}

      <Card>
        <CardHead
          title={TAB[tab]}
          right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>}
        />
        {ds.length === 0 ? (
          <div className="p-4">
            <Trong title={tab === 'chua_khop' ? 'Không còn gì để đối soát' : 'Chưa có giao dịch nào'}>
              {tab === 'chua_khop'
                ? 'Mọi khoản tiền về đều đã gạch được vào công nợ hoặc đã đánh dấu bỏ qua.'
                : 'Danh mục này đang trống.'}
            </Trong>
          </div>
        ) : tab === 'chua_khop' ? (
          <HangDoi ds={ds} canHo={canHo} />
        ) : (
          <Bang>
            <thead>
              <tr>
                <Th>Thời điểm</Th>
                <Th phai>Số tiền</Th>
                <Th>Nội dung</Th>
                <Th>Căn</Th>
                <Th phai>Còn dư</Th>
                <Th>Trạng thái</Th>
              </tr>
            </thead>
            <tbody>
              {ds.map((g) => (
                <Tr key={g.id}>
                  <Td className="text-[0.8125rem] whitespace-nowrap">{ngayGioVN(g.paid_at)}</Td>
                  <Td phai so className="font-semibold whitespace-nowrap">{vnd(g.amount)}</Td>
                  <Td className="max-w-md text-[0.8125rem] break-words text-muted">
                    {g.content || <span className="text-faint">(trống)</span>}
                    {g.ghi_chu && <div className="mt-0.5 text-faint">Lý do: {g.ghi_chu}</div>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {g.unit_code ?? <span className="text-faint">—</span>}
                  </Td>
                  <Td phai so className={g.con_du > 0 ? 'text-warn' : 'text-faint'}>
                    {g.con_du > 0 ? vnd(g.con_du) : '—'}
                  </Td>
                  <Td>
                    {g.trang_thai === 'bo_qua'
                      ? <Pill tone="trung">Bỏ qua</Pill>
                      : g.trang_thai === 'chua_khop'
                        ? <Pill tone="canh">Chờ đối soát</Pill>
                        : <Pill tone="tot">
                            {g.cach_khop === 'thu_cong' ? 'Gạch tay' : 'Tự động'}
                          </Pill>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Bang>
        )}
      </Card>

      {tab === 'con_du' && ds.length > 0 && (
        <Hop tone="canh" title="Tiền dư là gì">
          Cư dân trả nhiều hơn số đang nợ, hoặc trả vào lúc căn không còn hóa đơn nào chưa thanh
          toán. Hệ thống không tự quyết chỗ tiền đó về đâu — nó nằm lại đây cho tới khi có hóa đơn
          kỳ sau để gạch, hoặc BQL hoàn lại cho cư dân.
        </Hop>
      )}
    </div>
  )
}
