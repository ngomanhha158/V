import { Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, ngayVN, vnd } from '@/components/ui'
import { LichSuat, type ONgay } from '@/components/lich-suat'
import { nhanSuat, type OSuat } from '@/lib/tien-ich'

const SUAT = [
  { thu_tu: 1, bat_dau: '08:00:00', ket_thuc: '11:00:00' },
  { thu_tu: 2, bat_dau: '14:00:00', ket_thuc: '17:00:00' },
  { thu_tu: 3, bat_dau: '18:00:00', ket_thuc: '21:00:00' },
]
const KIN = new Set(['2026-09-05', '2026-09-06'])
const IT = new Set(['2026-09-02', '2026-09-10'])
const DONG = new Set(['2026-09-13'])

const NGAY_DS: ONgay[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10)
  return {
    ngay: d,
    o: SUAT.map((s, j) => ({
      suat_id: `${d}-${j}`, ...s,
      con_trong: DONG.has(d) ? false : KIN.has(d) ? false : IT.has(d) ? j === 2 : true,
      cua_toi: false,
      dong_cua: DONG.has(d),
      ly_do: DONG.has(d) ? 'Vệ sinh định kỳ' : null,
    })) as OSuat[],
  }
})

const DA_DAT = [
  { ngay: '2026-09-02', s: SUAT[0], can: 'P1-12.04', dong: false, ly_do: null },
  { ngay: '2026-09-02', s: SUAT[1], can: 'P2-03.07', dong: false, ly_do: null },
  { ngay: '2026-09-05', s: SUAT[0], can: 'P1-08.02', dong: false, ly_do: null },
  { ngay: '2026-09-05', s: SUAT[1], can: 'P1-15.11', dong: false, ly_do: null },
  { ngay: '2026-09-05', s: SUAT[2], can: 'P1-12.04', dong: false, ly_do: null },
  { ngay: '2026-09-13', s: SUAT[0], can: null, dong: true, ly_do: 'Vệ sinh định kỳ' },
]

export default function Page() {
  return (
    <div className="space-y-5">
      <PageHead
        title="Tiện ích"
        sub="Khai báo khung giờ, xem ai giữ chỗ, đóng suất khi bảo trì"
      />

      <div className="flex flex-wrap gap-2">
        <span className="rounded-lg border border-brand-line bg-brand-soft px-3 py-1.5 text-[0.8125rem] font-medium text-brand">
          Sảnh sinh hoạt
        </span>
        <span className="rounded-lg border border-line-firm px-3 py-1.5 text-[0.8125rem] font-medium text-muted">
          Phòng gym
        </span>
        <span className="rounded-lg border border-line-firm px-3 py-1.5 text-[0.8125rem] font-medium text-muted">
          Hồ bơi
        </span>
      </div>

      <Card>
        <CardHead title="Lịch 14 ngày · Sảnh sinh hoạt" />
        <div className="p-4">
          <LichSuat ngayDs={NGAY_DS} base="#" phi={200_000} />
        </div>
      </Card>

      <Card>
        <CardHead title="Khung giờ" sub="3 suất mỗi ngày" />
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {SUAT.map((s) => (
            <Pill key={s.thu_tu} tone="trung">
              {s.thu_tu}. {nhanSuat(s.bat_dau, s.ket_thuc)}
            </Pill>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="Ai đang giữ chỗ" sub={`${DA_DAT.length} suất trong 14 ngày tới`} />
        <div className="scroll-x overflow-x-auto">
          <Bang>
            <thead>
              <Tr><Th>Ngày</Th><Th>Khung giờ</Th><Th>Căn</Th></Tr>
            </thead>
            <tbody>
              {DA_DAT.map((r, i) => (
                <Tr key={i}>
                  <Td className="num whitespace-nowrap">{ngayVN(r.ngay)}</Td>
                  <Td className="num whitespace-nowrap">{nhanSuat(r.s.bat_dau, r.s.ket_thuc)}</Td>
                  <Td>
                    {r.dong
                      ? <span className="text-muted">Đóng — {r.ly_do}</span>
                      : <span className="num font-medium">{r.can}</span>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Bang>
        </div>
      </Card>

      <Hop tone="canh" title="Phí tiện ích chưa tự vào hóa đơn">
        Hệ thống ghi {vnd(200_000)} vào từng lượt đặt và giữ nguyên con số đó kể
        cả khi bảng giá đổi, nhưng <strong>chưa tự cộng vào hóa đơn tháng</strong>.
        Hiện phải tự thêm dòng khi phát hành.
      </Hop>
    </div>
  )
}
