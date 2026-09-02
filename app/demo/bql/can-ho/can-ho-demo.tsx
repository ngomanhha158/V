'use client'

import { useMemo, useState } from 'react'
import {
  Bang, Button, Card, CardHead, Hop, Input, Pill, Stat, Td, Th, Tr, Trong,
} from '@/components/ui'
import { docDienTich, soM2, TEN_TINH_TRANG, tenLoai, thoatMaCan } from '@/lib/can-ho'
import { CAN_HO, TOA_NHA_DEMO, type CanHoDemo } from '@/lib/demo/data'

// Không import actions.ts — bản demo không được ghi vào units thật. Nhưng nhãn
// loại/tình trạng, cách đọc số m² và cách lọc ký tự đại diện thì dùng chung với
// màn thật: lệch nhau ở đây là bản demo dạy sai người dùng.

const O =
  'h-10 w-full rounded-ctl border border-line-firm bg-surface px-3 text-sm text-ink '
  + 'placeholder:text-faint focus:border-brand'

export function CanHoDemoManHinh() {
  const [ds, setDs] = useState<CanHoDemo[]>(CAN_HO)
  const [toa, setToa] = useState('')
  const [tang, setTang] = useState('')
  const [ma, setMa] = useState('')
  const [chuaCo, setChuaCo] = useState(false)
  const [hangLoat, setHangLoat] = useState('')
  const [ghiDe, setGhiDe] = useState(false)
  const [bao, setBao] = useState<{ tone: 'tot' | 'xau'; chu: string } | null>(null)

  const maSach = thoatMaCan(ma)
  const tangSo = /^\d{1,3}$/.test(tang.trim()) ? Number(tang.trim()) : null

  const khop = useMemo(() => ds.filter((u) =>
    (!toa || u.toa === toa)
    && (tangSo === null || u.floor_no === tangSo)
    && (!maSach || u.code.toLowerCase().includes(maSach.toLowerCase()))
    && (!chuaCo || u.area_m2 === null),
  ), [ds, toa, tangSo, maSach, chuaCo])

  const soThieu = ds.filter((u) => u.area_m2 === null).length
  const soDaCo = khop.filter((u) => u.area_m2 !== null).length
  const soSeSua = ghiDe ? khop.length : khop.length - soDaCo
  const coLoc = Boolean(toa) || tangSo !== null || Boolean(maSach) || chuaCo

  const pham = [
    toa && `tòa ${toa}`,
    tangSo !== null && `tầng ${tangSo}`,
    maSach && `mã chứa "${maSach}"`,
    chuaCo && 'chưa có diện tích',
  ].filter(Boolean).join(', ') || 'toàn bộ căn trong khu'

  function ap() {
    const dt = docDienTich(hangLoat)
    if (dt === null) {
      return setBao({ tone: 'xau', chu: 'Diện tích phải là số dương, tối đa hai chữ số thập phân. Ví dụ: 78,5' })
    }
    const nhan = new Set(khop.filter((u) => ghiDe || u.area_m2 === null).map((u) => u.id))
    if (nhan.size === 0) {
      return setBao({ tone: 'xau', chu: `Không căn nào trong tập (${pham}) cần sửa. Muốn đè lên căn đã có thì tick ô ghi đè.` })
    }
    setDs((cu) => cu.map((u) => (nhan.has(u.id) ? { ...u, area_m2: dt } : u)))
    setBao({
      tone: 'tot',
      chu: `Đã đặt ${soM2(dt)} m² cho ${nhan.size} căn (${pham})`
        + (ghiDe ? ', ghi đè cả căn đã có diện tích.' : ', bỏ qua căn đã có diện tích.'),
    })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat nhan="Tổng căn" so={ds.length} />
        <Stat nhan="Đã có diện tích" so={ds.length - soThieu} tone={soThieu ? 'trung' : 'tot'} />
        <Stat nhan="Chưa có diện tích" so={soThieu} tone={soThieu ? 'canh' : 'trung'} />
        <Stat nhan="Đang lọc" so={khop.length} phu={coLoc ? pham : 'không lọc gì'} />
      </div>

      <Card>
        <CardHead title="Lọc" sub="Bộ lọc này quyết định luôn tập bị sửa khi áp hàng loạt" />
        <div className="flex flex-wrap items-end gap-3 p-4">
          <label className="block w-40">
            <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Tòa</span>
            <select className={O} value={toa} onChange={(e) => setToa(e.target.value)}>
              <option value="">Mọi tòa</option>
              {TOA_NHA_DEMO.map((b) => (
                <option key={b.code} value={b.code}>{b.code} · {b.name}</option>
              ))}
            </select>
          </label>
          <label className="block w-24">
            <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Tầng</span>
            <input
              className={`num ${O}`} inputMode="numeric" placeholder="mọi tầng"
              value={tang} onChange={(e) => setTang(e.target.value)}
            />
          </label>
          <label className="block w-48">
            <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Mã căn chứa</span>
            <input
              className={O} placeholder=".01" value={ma} onChange={(e) => setMa(e.target.value)}
            />
          </label>
          <label className="flex h-10 items-center gap-2 text-[0.8125rem] text-muted">
            <input
              type="checkbox" className="size-4 accent-brand"
              checked={chuaCo} onChange={(e) => setChuaCo(e.target.checked)}
            />
            Chỉ căn chưa có diện tích
          </label>
          {coLoc && (
            <Button
              co="sm" dang="nhat"
              onClick={() => { setToa(''); setTang(''); setMa(''); setChuaCo(false) }}
            >
              Bỏ lọc
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHead
          title="Đặt diện tích hàng loạt"
          sub="Cách duy nhất khả thi cho vài trăm căn — nhưng cũng là cách nhanh nhất để hỏng hàng loạt, nên đọc kỹ dòng phạm vi"
        />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32 shrink-0">
              <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Diện tích</span>
              <Input
                inputMode="decimal" placeholder="78,5" className="num text-right"
                aria-label="Diện tích áp hàng loạt"
                value={hangLoat} onChange={(e) => setHangLoat(e.target.value)}
              />
            </div>
            <Button dang="chinh" onClick={ap} disabled={soSeSua <= 0}>
              Áp cho {soSeSua} căn
            </Button>
          </div>

          <label className="flex items-start gap-2 text-[0.8125rem] text-muted">
            <input
              type="checkbox" className="mt-0.5 size-4 shrink-0 accent-brand"
              checked={ghiDe} onChange={(e) => setGhiDe(e.target.checked)}
            />
            <span>
              Ghi đè cả căn đã có diện tích.
              {soDaCo > 0 && (
                <> Trong tập đang lọc có <strong className="text-ink">{soDaCo} căn</strong> đã
                  có diện tích; không tick thì chúng giữ nguyên.</>
              )}
            </span>
          </label>

          <p className="text-[0.75rem] text-faint">
            Áp cho: <strong className="text-muted">{pham}</strong>. Đổi bộ lọc bên trên là
            đổi luôn tập này.
          </p>

          {bao && (
            <Hop tone={bao.tone} title={bao.tone === 'tot' ? 'Xong' : 'Chưa áp được'}>
              {bao.chu}
            </Hop>
          )}
        </div>
      </Card>

      <Card>
        <CardHead
          title="Danh sách căn"
          right={<span className="text-[0.8125rem] text-faint">{khop.length}</span>}
        />
        {khop.length === 0 ? (
          <div className="p-4">
            <Trong title="Không có căn nào khớp">Đổi hoặc bỏ bộ lọc để thấy các căn khác.</Trong>
          </div>
        ) : (
          <Bang>
            <thead>
              <tr>
                <Th>Mã căn</Th><Th>Tòa</Th><Th phai>Tầng</Th>
                <Th>Loại</Th><Th>Tình trạng</Th><Th>Diện tích (m²)</Th>
              </tr>
            </thead>
            <tbody>
              {khop.map((u) => {
                const tt = TEN_TINH_TRANG[u.state]
                return (
                  <Tr key={u.id}>
                    <Td className="font-medium text-ink whitespace-nowrap">{u.code}</Td>
                    <Td className="text-muted">{u.toa}</Td>
                    <Td phai so>{u.floor_no}</Td>
                    <Td className="text-muted">{tenLoai(u.kind)}</Td>
                    <Td>{tt ? <Pill tone={tt.tone}>{tt.nhan}</Pill> : u.state}</Td>
                    <Td>
                      {/* key gắn cả diện tích: ô nhập giữ state riêng, không đổi
                          key thì sau khi áp hàng loạt cột này vẫn hiện số cũ. */}
                      <ODienTichDemo
                        key={`${u.id}:${u.area_m2 ?? ''}`}
                        can={u}
                        luu={(dt) => setDs((cu) => cu.map((x) => (x.id === u.id ? { ...x, area_m2: dt } : x)))}
                      />
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Bang>
        )}
      </Card>
    </>
  )
}

function ODienTichDemo({
  can, luu,
}: { can: CanHoDemo; luu: (dt: number | null) => void }) {
  const goc = can.area_m2 === null ? '' : soM2(can.area_m2)
  const [v, setV] = useState(goc)
  const [loi, setLoi] = useState<string | null>(null)
  const doi = v.trim() !== goc

  return (
    <div className="flex items-start gap-1.5">
      <div className="w-24 shrink-0">
        <Input
          inputMode="decimal" placeholder="—" className="num h-9 text-right"
          aria-label={`Diện tích căn ${can.code}`}
          value={v} onChange={(e) => { setV(e.target.value); setLoi(null) }}
        />
        {loi && <span className="mt-1 block text-[0.75rem] leading-snug text-bad">{loi}</span>}
      </div>
      <Button
        co="sm" dang={doi ? 'chinh' : 'nhat'} disabled={!doi}
        onClick={() => {
          const raw = v.trim()
          if (!raw) { luu(null); return setLoi(null) }
          const dt = docDienTich(raw)
          if (dt === null) return setLoi('Số không đọc được. Ví dụ: 78,5')
          luu(dt)
          setLoi(null)
        }}
      >
        Lưu
      </Button>
    </div>
  )
}
