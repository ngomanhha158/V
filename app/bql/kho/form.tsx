'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Select, Textarea, vnd } from '@/components/ui'
import { giaBinhQuan, soVN, soatPhieuXuat, tongPhieu, type Ton } from '@/lib/kho'
import { kiemKe, nhapKho, xuatKho, type KhoState } from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies KhoState

type Dong = { vt: string; sl: string; gia: string }
const dongTrong = (): Dong => ({ vt: '', sl: '', gia: '' })

function BangDong({
  dong, setDong, ton, coGia,
}: { dong: Dong[]; setDong: (d: Dong[]) => void; ton: Ton[]; coGia: boolean }) {
  const doi = (i: number, k: keyof Dong, v: string) => {
    const d = dong.slice()
    d[i] = { ...d[i], [k]: v }
    // Tự thêm dòng trống khi gõ vào dòng cuối: người nhập kho gõ 8 dòng một lúc
    // mà phải bấm "thêm dòng" 8 lần thì họ quay về cuốn sổ giấy.
    if (i === d.length - 1 && v) d.push(dongTrong())
    setDong(d)
  }
  return (
    <div className="space-y-2">
      {dong.map((d, i) => {
        const vt = ton.find((t) => t.id === d.vt)
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name={`dong_${i}_vt`} value={vt ? d.vt : ''} />
            <Select
              value={d.vt} onChange={(e) => doi(i, 'vt', e.target.value)}
              className="min-w-[13rem] flex-1"
            >
              <option value="">— chọn vật tư —</option>
              {ton.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ten} ({soVN(t.ton)} {t.don_vi})
                </option>
              ))}
            </Select>
            {/* Bọc trong một ô rộng cố định thay vì đặt w-24 lên chính Input:
                lớp nền của Input đã có `w-full`, nên hai lớp bề rộng cùng cấp
                đua nhau theo thứ tự trong stylesheet — thắng thua đổi theo build. */}
            <span className="w-24 shrink-0">
              <Input
                name={`dong_${i}_sl`} value={d.sl} onChange={(e) => doi(i, 'sl', e.target.value)}
                inputMode="decimal" placeholder="SL" className="num"
              />
            </span>
            {coGia ? (
              <span className="w-32 shrink-0">
                <Input
                  name={`dong_${i}_gia`} value={d.gia} onChange={(e) => doi(i, 'gia', e.target.value)}
                  inputMode="numeric" placeholder="Đơn giá" className="num"
                />
              </span>
            ) : (
              <span className="num w-32 text-right text-[0.8125rem] text-muted">
                {vt ? vnd(vt.don_gia) : '—'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Bảng `ton` khoá theo ID: form gửi uuid vì RPC nhận uuid. Gửi mã vật tư thì
 *  câu `(d ->> 'vat_tu')::uuid` bên SQL vỡ bằng một lỗi ép kiểu trần trụi. */
const theoId = (ton: Ton[]) => new Map(ton.map((t) => [t.id, t]))

export function FormXuat({
  project, ton, yeuCau,
}: {
  project: string; ton: Ton[]
  yeuCau: { id: string; title: string; ma_can: string }[]
}) {
  const [state, action, dangChay] = useActionState(xuatKho, dauTien)
  const [dong, setDong] = useState<Dong[]>([dongTrong()])
  const hop = dong
    .filter((d) => d.vt && Number(d.sl.replace(',', '.')) > 0)
    .map((d) => ({ vat_tu: d.vt, so_luong: Number(d.sl.replace(',', '.')) }))
  const bang = theoId(ton)
  const canh = soatPhieuXuat(hop, bang)
  const tong = tongPhieu(hop, bang)

  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project" value={project} />
      <Field
        label="Xuất cho yêu cầu"
        hint="Đây là chỗ trả lời câu 'đã dùng gì cho căn nào'. Không có yêu cầu thì phải ghi lý do bên dưới."
      >
        <Select name="ticket" defaultValue="">
          <option value="">— không gắn yêu cầu nào —</option>
          {yeuCau.map((y) => (
            <option key={y.id} value={y.id}>{y.ma_can} · {y.title}</option>
          ))}
        </Select>
      </Field>
      <Field label="Lý do" hint="Bắt buộc nếu không chọn yêu cầu">
        <Input name="ly_do" placeholder="Thay bóng hành lang tầng 5, bảo trì chung" />
      </Field>

      <Field label="Vật tư xuất" hint="Đơn giá lấy từ giá kho hiện tại, không gõ tay">
        <BangDong dong={dong} setDong={setDong} ton={ton} coGia={false} />
      </Field>

      {canh.length > 0 && (
        <Hop tone="xau" title="Không đủ tồn">
          {canh.map((c) => <span key={c} className="block">{c}</span>)}
        </Hop>
      )}
      {tong > 0 && canh.length === 0 && (
        <Hop tone="trung">Giá trị xuất: <b className="num">{vnd(tong)}</b></Hop>
      )}
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <Button type="submit" dang="chinh" disabled={dangChay || canh.length > 0}>
        {dangChay ? 'Đang xuất…' : 'Xác nhận xuất kho'}
      </Button>
    </form>
  )
}

export function FormNhap({ project, ton }: { project: string; ton: Ton[] }) {
  const [state, action, dangChay] = useActionState(nhapKho, dauTien)
  const [dong, setDong] = useState<Dong[]>([dongTrong()])
  const map = theoId(ton)

  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project" value={project} />
      <Field label="Lý do / số hóa đơn" hint="Không bắt buộc, nhưng nó là thứ đối chiếu được về sau">
        <Input name="ly_do" placeholder="Hóa đơn 0012345, nhà cung cấp Thiên Nam" />
      </Field>
      <Field label="Vật tư nhập" hint="Đơn giá là giá của LÔ NÀY, không phải giá kho">
        <BangDong dong={dong} setDong={setDong} ton={ton} coGia />
      </Field>

      {/* Giá kho SẼ thành bao nhiêu — hiện trước khi bấm. Một lô nhỏ mua đắt kéo
          giá cả kho lên là chuyện phải hỏi lại nhà cung cấp ngay, không phải
          phát hiện ba tháng sau lúc đối chiếu. */}
      {dong.some((d) => d.vt && d.sl && d.gia) && (
        <Hop tone="trung" title="Giá kho sau khi nhập">
          {dong.filter((d) => d.vt && d.sl && d.gia).map((d, i) => {
            const t = map.get(d.vt)
            if (!t) return null
            const sl = Number(d.sl.replace(',', '.'))
            const gia = Number(d.gia.replace(/[^\d]/g, ''))
            if (!(sl > 0) || !Number.isFinite(gia)) return null
            const moi = giaBinhQuan(t.ton, t.don_gia, sl, gia)
            return (
              <span key={i} className="block">
                {t.ten}: <span className="num">{vnd(t.don_gia)}</span> →{' '}
                <b className="num">{vnd(moi)}</b>
                {moi > t.don_gia * 1.2 && (
                  <span className="text-warn"> — tăng hơn 20%, kiểm lại giá lô này</span>
                )}
              </span>
            )
          })}
        </Hop>
      )}
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <Button type="submit" dang="chinh" disabled={dangChay}>
        {dangChay ? 'Đang nhập…' : 'Nhập kho'}
      </Button>
    </form>
  )
}

export function FormKiemKe({ project, ton }: { project: string; ton: Ton[] }) {
  const [state, action, dangChay] = useActionState(kiemKe, dauTien)
  const [mo, setMo] = useState(false)
  if (state.ok) return <Hop tone="tot">{state.ok}</Hop>
  if (!mo) {
    return (
      <div className="space-y-2">
        <Button type="button" onClick={() => setMo(true)}>Kiểm kê kho</Button>
        <p className="text-[0.75rem] leading-relaxed text-muted">
          Đếm thật rồi nhập vào. Chênh lệch được ghi thành dòng trong sổ kèm lý do —
          không có cách nào sửa tồn mà không để lại vết, và đó là cố ý.
        </p>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project" value={project} />
      <Field label="Lý do kiểm kê" hint="Bắt buộc — đây là bước sửa lại sổ sách">
        <Textarea name="ly_do" rows={2} autoFocus placeholder="Kiểm kê quý III/2026" />
      </Field>
      <div className="space-y-1.5">
        {ton.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-[12rem] flex-1 text-[0.8125rem] text-ink">
              {t.ten}
              <span className="num text-faint"> · sổ ghi {soVN(t.ton)} {t.don_vi}</span>
            </span>
            <span className="w-28 shrink-0">
              <Input name={`that_${t.id}`} inputMode="decimal" placeholder="đếm được" className="num" />
            </span>
          </div>
        ))}
      </div>
      <p className="text-[0.75rem] text-muted">
        Ô để trống nghĩa là chưa đếm vật tư đó — khác hẳn với đếm được 0.
      </p>
      {state.error && <Hop tone="xau">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" dang="chinh" disabled={dangChay}>
          {dangChay ? 'Đang ghi…' : 'Ghi kết quả kiểm kê'}
        </Button>
        <Button type="button" onClick={() => setMo(false)}>Thôi</Button>
      </div>
    </form>
  )
}
