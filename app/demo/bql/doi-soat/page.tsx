import {
  Bang, Card, CardHead, Chip, Hop, PageHead, Pill, Td, Th, Tr, Trong, ngayGioVN, vnd,
} from '@/components/ui'
import { DOI_SOAT, DU_AN, type GiaoDichDemo } from '@/lib/demo/data'
import { HangDoiDemo } from './hang-doi-demo'

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

const loc = (tab: TabKey): GiaoDichDemo[] =>
  tab === 'tat_ca' ? DOI_SOAT
  : tab === 'con_du' ? DOI_SOAT.filter((g) => g.trang_thai === 'da_khop' && g.con_du > 0)
  : DOI_SOAT.filter((g) => g.trang_thai === tab)

export default async function DemoDoiSoat({
  searchParams,
}: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams
  const tab: TabKey = laTab(sp.tab) ? sp.tab : 'chua_khop'
  const ds = loc(tab)
  const soChoXuLy = DOI_SOAT.filter((g) => g.trang_thai === 'chua_khop').length

  return (
    <div className="space-y-5">
      <PageHead
        title="Đối soát tiền về"
        sub={`${DU_AN.ten} · tiền vào tài khoản mà máy chưa khớp được căn`}
        actions={
          soChoXuLy
            ? <Pill tone="canh">{soChoXuLy} giao dịch chờ</Pill>
            : <Pill tone="tot">Không còn tồn đọng</Pill>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TAB) as TabKey[]).map((k) => (
          <Chip key={k} href={`/demo/bql/doi-soat?tab=${k}`} active={tab === k}>{TAB[k]}</Chip>
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
          <div className="p-4"><Trong title="Danh mục này đang trống" /></div>
        ) : tab === 'chua_khop' ? (
          <HangDoiDemo ds={ds} />
        ) : (
          <Bang>
            <thead>
              <tr>
                <Th>Thời điểm</Th><Th phai>Số tiền</Th><Th>Nội dung</Th>
                <Th>Căn</Th><Th phai>Còn dư</Th><Th>Trạng thái</Th>
              </tr>
            </thead>
            <tbody>
              {ds.map((g) => (
                <Tr key={g.id}>
                  <Td className="text-[0.8125rem] whitespace-nowrap">{ngayGioVN(g.paid_at)}</Td>
                  <Td phai so className="font-semibold whitespace-nowrap">{vnd(g.amount)}</Td>
                  <Td className="max-w-md text-[0.8125rem] break-words text-muted">
                    {g.content}
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
