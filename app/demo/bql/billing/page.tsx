import {
  Bang, Button, Card, CardHead, Hop, Input, PageHead, Pill, Stat, Td, Th, Tr,
  vnd,
} from '@/components/ui'
import { HOA_DON_KY_NAY, ky } from '@/lib/demo/data'
import { IcDongHo, IcHoaDon } from '@/components/icons'

export const dynamic = 'force-dynamic'

const TT = {
  draft: { nhan: 'Nháp', tone: 'trung' as const },
  issued: { nhan: 'Đã phát hành', tone: 'brand' as const },
  paid: { nhan: 'Đã thu', tone: 'tot' as const },
}

const CHI_SO = [
  { can: 'P1-10.01', dau: 1250, cuoi: 1400 },
  { can: 'P1-10.02', dau: 980, cuoi: 1086 },
  { can: 'P1-07.02', dau: 2040, cuoi: 2171 },
  { can: 'P2-03.01', dau: null, cuoi: null },
]

export default function DemoBilling() {
  const kyNay = ky(0)
  const tong = HOA_DON_KY_NAY.reduce((s, h) => s + h.tong, 0)
  const nhap = HOA_DON_KY_NAY.filter((h) => h.trang_thai === 'draft')
  const thieuChiSo = CHI_SO.filter((c) => c.cuoi === null)

  return (
    <div className="space-y-5">
      <PageHead
        title="Hóa đơn"
        sub={`Kỳ ${kyNay.slice(5, 7)}/${kyNay.slice(0, 4)}`}
        actions={
          <>
            <Input type="month" defaultValue={kyNay.slice(0, 7)} className="h-10 w-40" disabled />
            <Button dang="phu" disabled>Xem kỳ</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat nhan="Tổng hóa đơn" so={HOA_DON_KY_NAY.length} phu={vnd(tong)} />
        <Stat nhan="Còn nháp" so={nhap.length} phu="Chưa phát hành cho cư dân" tone={nhap.length ? 'canh' : 'tot'} />
        <Stat nhan="Đã thu" so={HOA_DON_KY_NAY.filter((h) => h.trang_thai === 'paid').length} tone="tot" />
        <Stat
          nhan="Thiếu chỉ số" so={thieuChiSo.length}
          phu={thieuChiSo.length ? 'Hóa đơn sẽ không có dòng điện' : 'Đã nhập đủ'}
          tone={thieuChiSo.length ? 'canh' : 'tot'}
        />
      </div>

      <Card>
        <CardHead
          title="Chỉ số công tơ"
          sub="Nhập đầu kỳ và cuối kỳ cho từng căn"
          right={<Button co="sm" disabled><IcDongHo width={14} height={14} /> Lưu chỉ số</Button>}
        />
        <Bang>
          <thead>
            <tr>
              <Th>Căn hộ</Th><Th phai>Chỉ số đầu</Th><Th phai>Chỉ số cuối</Th>
              <Th phai>Tiêu thụ</Th><Th>Trạng thái</Th>
            </tr>
          </thead>
          <tbody>
            {CHI_SO.map((c) => (
              <Tr key={c.can}>
                <Td className="font-medium text-ink">{c.can}</Td>
                <Td phai so className="text-muted">{c.dau ?? '—'}</Td>
                <Td phai so className="text-muted">{c.cuoi ?? '—'}</Td>
                <Td phai so className="font-medium text-ink">
                  {c.dau !== null && c.cuoi !== null ? `${c.cuoi - c.dau} kWh` : '—'}
                </Td>
                <Td>
                  {c.cuoi === null
                    ? <Pill tone="canh">Chưa nhập</Pill>
                    : <Pill tone="tot">Đã nhập</Pill>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Bang>
        <div className="border-t border-line px-4 py-3">
          <Hop tone="trung">
            Căn chưa có chỉ số thì hóa đơn <b>không sinh dòng điện 0đ</b> — đây là
            một trong các bất biến được bộ test khóa lại, không phải quy ước miệng.
          </Hop>
        </div>
      </Card>

      <Card>
        <CardHead
          title={`Hóa đơn kỳ ${kyNay.slice(5, 7)}/${kyNay.slice(0, 4)}`}
          right={
            <div className="flex gap-2">
              <Button co="sm" disabled><IcHoaDon width={14} height={14} /> Sinh hóa đơn</Button>
              <Button co="sm" dang="chinh" disabled>Phát hành {nhap.length} bản nháp</Button>
            </div>
          }
        />
        <Bang>
          <thead>
            <tr><Th>Căn hộ</Th><Th phai>Số tiền</Th><Th>Trạng thái</Th></tr>
          </thead>
          <tbody>
            {HOA_DON_KY_NAY.map((h) => (
              <Tr key={h.can}>
                <Td className="font-medium text-ink">{h.can}</Td>
                <Td phai so>{vnd(h.tong)}</Td>
                <Td><Pill tone={TT[h.trang_thai].tone}>{TT[h.trang_thai].nhan}</Pill></Td>
              </Tr>
            ))}
          </tbody>
        </Bang>
      </Card>
    </div>
  )
}
