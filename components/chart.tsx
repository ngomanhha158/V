'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx, soVN, vnd, vndGon } from './ui'

/**
 * Biểu đồ tự vẽ bằng SVG, không kéo thư viện. Hai lý do, không phải vì thích:
 * Recharts/Chart.js nặng hơn toàn bộ phần còn lại của app cộng lại cho đúng
 * hai biểu đồ; và cả hai đều vẽ bằng màu cứng, trong khi bảng màu ở đây đảo
 * theo chế độ tối qua CSS token — nhúng thư viện vào là phải chống lại nó.
 *
 * Chỉ MỘT màu dữ liệu (màu thương hiệu) trong cả hai biểu đồ. Không có bảng
 * màu phân loại nào ở đây, nên cũng không có cặp màu nào để người mù màu
 * nhầm lẫn. Phần "còn thiếu" là nền xám trung tính, không phải một series.
 */

// ── Đo bề rộng thật rồi vẽ bằng px ───────────────────────────────────────
// Chỉ co viewBox thì chữ co theo: trên điện thoại nhãn trục còn 6px, không đọc
// được. Đo rồi vẽ bằng px thật thì chữ giữ nguyên cỡ ở mọi bề rộng.
//
// Nhưng KHÔNG chờ đo xong mới vẽ: lần render đầu chưa có số đo, chờ nó là thẻ
// biểu đồ rỗng cho tới khi JS chạy xong — và rỗng hẳn nếu JS không chạy. Nên
// vẽ ngay với bề rộng mặc định qua viewBox (lúc này chữ co, chấp nhận được
// trong một nhịp), rồi ResizeObserver trả về số thật thì viewBox khớp đúng
// bề rộng và hết co.
const RONG_MAC_DINH = 640

function useRong() {
  const ref = useRef<HTMLDivElement>(null)
  const [rong, setRong] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setRong(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, rong] as const
}

export type ThangKPI = {
  thang: string
  ticket_moi: number
  ticket_co_ket_luan: number
  ticket_dung_sla: number
  ty_le_dung_sla: number | null
  gio_xu_ly_trung_vi: number | null
  phai_thu: number
  da_thu: number
  tien_ve: number
}

/** '2026-03-01' -> 'T3'. Kèm năm ở cột đầu và mỗi lần sang năm mới. */
function nhanThang(iso: string, truoc?: string) {
  const [y, m] = iso.slice(0, 7).split('-')
  const sangNam = !truoc || truoc.slice(0, 4) !== y
  return sangNam ? `T${+m}/${y.slice(2)}` : `T${+m}`
}

/** Cột bo góc ĐẦU DỮ LIỆU, chân vuông: chân cột là đường cơ sở, bo nó vào là
 *  cột trông như đang lơ lửng. */
function cotBoDinh(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}a${rr},${rr} 0 0 1 ${rr},${-rr}h${w - 2 * rr}` +
         `a${rr},${rr} 0 0 1 ${rr},${rr}V${y + h}Z`
}

function Tip({ x, rong, children }: { x: number; rong: number; children: ReactNode }) {
  // Kẹp vào trong khung: gần mép phải thì tooltip lật sang trái thay vì tràn.
  const trai = Math.min(Math.max(x, 78), Math.max(rong - 78, 78))
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-ctl border border-line
                 bg-surface px-2.5 py-2 text-[0.75rem] leading-snug whitespace-nowrap shadow-pop"
      style={{ left: trai }}
    >
      {children}
    </div>
  )
}

// ══════════════════════════ Đường: tỷ lệ đúng hạn ═════════════════════════

export function DuongSLA({ data }: { data: ThangKPI[] }) {
  const [ref, rong] = useRong()
  const rongVe = rong || RONG_MAC_DINH
  const [tro, setTro] = useState<number | null>(null)
  const CAO = 184
  const L = 38, R = 12, T = 14, B = 26

  const co = data.map((d) => d.ty_le_dung_sla).filter((v): v is number => v !== null)
  const trong = co.length === 0
  // Trục 0–100 khi có tháng tệ, 50–100 khi mọi tháng đều trên 50. Tỷ lệ SLA
  // thực tế sống ở dải 75–95: ép nó vào khung 0–100 thì cú tụt 10 điểm — đúng
  // thứ BQT cần thấy — dẹp thành một đường thẳng dày 2px. Sàn LUÔN được ghi
  // nhãn trên trục, nên không ai bị lừa là đường chạm đáy nghĩa là 0%.
  const san = co.length && Math.min(...co) >= 50 ? 50 : 0
  const moc = [san, (san + 100) / 2, 100]
  const yCua = (v: number) => T + (1 - (v - san) / (100 - san)) * (CAO - T - B)

  return (
    <div ref={ref} className="relative">
      <svg
        viewBox={`0 0 ${rongVe} ${CAO}`} width="100%" height={CAO}
        preserveAspectRatio="xMidYMid meet"
        className="block touch-none select-none"
        role="img" aria-label="Tỷ lệ yêu cầu xử lý đúng hạn theo tháng"
        onPointerMove={(e) => {
          // Quy toạ độ chuột về hệ viewBox: trước khi đo xong hai hệ này
          // chưa trùng nhau, lấy thẳng clientX là trỏ lệch cột.
          const b = e.currentTarget.getBoundingClientRect()
          const vx = ((e.clientX - b.left) / b.width) * rongVe
          const i = Math.round(((vx - L) / (rongVe - L - R)) * (data.length - 1))
          setTro(Math.min(Math.max(i, 0), data.length - 1))
        }}
        onPointerLeave={() => setTro(null)}
      >
        {moc.map((v) => {
          const y = yCua(v)
          return (
            <g key={v}>
              <line
                x1={L} x2={rongVe - R} y1={y} y2={y}
                className="stroke-line" strokeWidth={1}
              />
              <text
                x={L - 8} y={y} textAnchor="end" dominantBaseline="middle"
                className="fill-faint text-[0.6875rem]"
              >
                {v}%
              </text>
            </g>
          )
        })}

        {data.map((d, i) => {
          const x = L + (data.length === 1 ? 0 : (i / (data.length - 1)) * (rongVe - L - R))
          return (
            <text
              key={d.thang} x={x} y={CAO - 8} textAnchor="middle"
              className={cx('text-[0.6875rem]', tro === i ? 'fill-ink' : 'fill-faint')}
            >
              {nhanThang(d.thang, data[i - 1]?.thang)}
            </text>
          )
        })}

        {/* Đường ĐỨT ở tháng không có ticket nào ngã ngũ. Nối thẳng qua chỗ
            trống là bịa ra một xu hướng chưa từng đo được. */}
        {(() => {
          const P = data.map((d, i) => ({
            i,
            x: L + (data.length === 1 ? 0 : (i / (data.length - 1)) * (rongVe - L - R)),
            y: d.ty_le_dung_sla === null ? null : yCua(d.ty_le_dung_sla),
          }))
          const doan: string[] = []
          let cur: string[] = []
          for (const p of P) {
            if (p.y === null) { if (cur.length > 1) doan.push(cur.join(' ')); cur = [] }
            else cur.push(`${cur.length ? 'L' : 'M'}${p.x},${p.y}`)
          }
          if (cur.length > 1) doan.push(cur.join(' '))
          return (
            <>
              {doan.map((d, k) => (
                <path key={k} d={d} fill="none" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round"
                  className="stroke-brand" />
              ))}
              {P.map((p) => p.y === null ? null : (
                <circle
                  key={p.i} cx={p.x} cy={p.y} r={tro === p.i ? 5 : 3.5}
                  className="fill-brand stroke-surface" strokeWidth={2}
                />
              ))}
            </>
          )
        })()}

        {tro !== null && (
          <line
            x1={L + (data.length === 1 ? 0 : (tro / (data.length - 1)) * (rongVe - L - R))}
            x2={L + (data.length === 1 ? 0 : (tro / (data.length - 1)) * (rongVe - L - R))}
            y1={T} y2={CAO - B}
            className="stroke-line-firm" strokeWidth={1}
          />
        )}
      </svg>

      {tro !== null && (
        <Tip
          x={L + (data.length === 1 ? 0 : (tro / (data.length - 1)) * (rongVe - L - R))}
          rong={rongVe}
        >
          <div className="font-semibold text-ink">{nhanThang(data[tro].thang, undefined)}</div>
          {data[tro].ty_le_dung_sla === null ? (
            <div className="mt-0.5 text-muted">Chưa yêu cầu nào ngã ngũ</div>
          ) : (
            <div className="mt-0.5 text-muted">
              <span className="num font-semibold text-ink">{soVN(data[tro].ty_le_dung_sla!)}%</span>
              {' '}đúng hạn
              <div className="num">
                {data[tro].ticket_dung_sla}/{data[tro].ticket_co_ket_luan} yêu cầu
              </div>
            </div>
          )}
        </Tip>
      )}
      {trong && (
        <p className="pt-2 text-[0.8125rem] text-faint">
          Chưa tháng nào có yêu cầu ngã ngũ để tính tỷ lệ.
        </p>
      )}
    </div>
  )
}

// ══════════════════════════ Cột chồng: thu theo tháng ═════════════════════

export function CotThu({ data }: { data: ThangKPI[] }) {
  const [ref, rong] = useRong()
  const rongVe = rong || RONG_MAC_DINH
  const [tro, setTro] = useState<number | null>(null)
  const CAO = 200
  const T = 18, B = 26

  const dinh = Math.max(...data.map((d) => d.phai_thu), 1)
  const n = data.length
  const khe = 10
  const wCot = n > 0 ? Math.max((rongVe - khe * (n - 1)) / n, 6) : 0

  return (
    <div ref={ref} className="relative">
      <svg
        viewBox={`0 0 ${rongVe} ${CAO}`} width="100%" height={CAO}
        preserveAspectRatio="xMidYMid meet"
        className="block touch-none select-none"
        role="img" aria-label="Tiền phải thu và đã thu theo tháng"
        onPointerLeave={() => setTro(null)}
      >
        <line
          x1={0} x2={rongVe} y1={CAO - B} y2={CAO - B}
          className="stroke-line" strokeWidth={1}
        />
        {data.map((d, i) => {
          const x = i * (wCot + khe)
          const hTong = (d.phai_thu / dinh) * (CAO - T - B)
          const yTong = CAO - B - hTong
          const tyLe = d.phai_thu > 0 ? Math.round((d.da_thu / d.phai_thu) * 100) : null
          // Khe 2px giữa hai đoạn: hai mảng màu chạm nhau thì mắt đọc thành
          // một khối, ranh giới "đã thu / còn thiếu" biến mất.
          const hThu = d.phai_thu > 0
            ? Math.max((d.da_thu / dinh) * (CAO - T - B) - (d.da_thu < d.phai_thu ? 2 : 0), 0)
            : 0
          return (
            <g
              key={d.thang}
              onPointerEnter={() => setTro(i)}
              className="cursor-default"
            >
              {/* Vùng bắt chuột phủ cả cột kể cả chỗ trống phía trên: bắt
                  đúng vào thanh mảnh của tháng thu được ít là bất khả thi. */}
              <rect x={x} y={0} width={wCot} height={CAO} fill="transparent" />
              {d.phai_thu > 0 ? (
                <>
                  <path
                    d={cotBoDinh(x, yTong, wCot, hTong)}
                    // fill-line chứ không phải fill-sunken: trong nền tối,
                    // sunken (#0e131e) gần trùng mặt thẻ (#121826) nên phần
                    // "còn thiếu" biến mất và cột đọc thành đã thu đủ 100%.
                    className={cx('fill-line', tro === i && 'fill-line-firm')}
                  />
                  <path
                    d={cotBoDinh(x, CAO - B - hThu, wCot, hThu)}
                    className="fill-brand"
                  />
                  {tyLe !== null && (
                    <text
                      x={x + wCot / 2} y={yTong - 6} textAnchor="middle"
                      className={cx('num text-[0.6875rem] font-semibold',
                        tro === i ? 'fill-ink' : 'fill-muted')}
                    >
                      {tyLe}%
                    </text>
                  )}
                </>
              ) : (
                <text
                  x={x + wCot / 2} y={CAO - B - 6} textAnchor="middle"
                  className="fill-faint text-[0.6875rem]"
                >
                  –
                </text>
              )}
              <text
                x={x + wCot / 2} y={CAO - 8} textAnchor="middle"
                className={cx('text-[0.6875rem]', tro === i ? 'fill-ink' : 'fill-faint')}
              >
                {nhanThang(d.thang, data[i - 1]?.thang)}
              </text>
            </g>
          )
        })}
      </svg>

      {tro !== null && (
        <Tip x={tro * (wCot + khe) + wCot / 2} rong={rongVe}>
          <div className="font-semibold text-ink">
            {nhanThang(data[tro].thang, undefined)}
          </div>
          <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-muted">
            <dt>Phải thu</dt>
            <dd className="num text-right text-ink">{vnd(data[tro].phai_thu)}</dd>
            <dt>Đã thu</dt>
            <dd className="num text-right text-ink">{vnd(data[tro].da_thu)}</dd>
            <dt>Còn thiếu</dt>
            <dd className="num text-right text-ink">
              {vnd(data[tro].phai_thu - data[tro].da_thu)}
            </dd>
            <dt className="pt-1 text-faint">Tiền thực về</dt>
            <dd className="num pt-1 text-right text-faint">{vnd(data[tro].tien_ve)}</dd>
          </dl>
        </Tip>
      )}
    </div>
  )
}

/** Chú giải cho biểu đồ cột. Hai mảng màu cần gọi tên — người không phân biệt
 *  được sắc độ vẫn phải biết mảng nào là gì. */
export function ChuThichThu() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-brand" />Đã thu
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-line" />Còn thiếu
      </span>
    </div>
  )
}

/** Bảng số cho cùng bộ dữ liệu. Không phải phương án dự phòng cho JS hỏng —
 *  là đường đọc chính cho người dùng trình đọc màn hình, và là chỗ copy số
 *  ra khi BQT cần dán vào biên bản họp. */
export function BangThang({ data }: { data: ThangKPI[] }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-[0.8125rem] font-medium text-muted hover:text-ink">
        <span className="group-open:hidden">Xem dạng bảng số</span>
        <span className="hidden group-open:inline">Ẩn bảng số</span>
      </summary>
      <div className="scroll-x overflow-x-auto border-t border-line">
        <table className="w-full border-collapse text-[0.8125rem]">
          <thead>
            <tr>
              {['Tháng', 'Yêu cầu', 'Đúng hạn', 'Trung vị xử lý', 'Phải thu', 'Đã thu', 'Tiền về']
                .map((h, i) => (
                  <th key={h} className={cx(
                    'border-b border-line bg-raised px-3 py-2 text-[0.6875rem] font-semibold',
                    'tracking-wide text-muted uppercase whitespace-nowrap',
                    i === 0 ? 'text-left' : 'text-right',
                  )}>{h}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.thang}>
                <td className="border-b border-line px-3 py-2 whitespace-nowrap">
                  {nhanThang(d.thang, undefined)}
                </td>
                <td className="num border-b border-line px-3 py-2 text-right">{d.ticket_moi}</td>
                <td className="num border-b border-line px-3 py-2 text-right">
                  {d.ty_le_dung_sla === null
                    ? <span className="text-faint">—</span>
                    : `${soVN(d.ty_le_dung_sla)}% (${d.ticket_dung_sla}/${d.ticket_co_ket_luan})`}
                </td>
                <td className="num border-b border-line px-3 py-2 text-right">
                  {d.gio_xu_ly_trung_vi === null
                    ? <span className="text-faint">—</span> : `${soVN(d.gio_xu_ly_trung_vi)} giờ`}
                </td>
                <td className="num border-b border-line px-3 py-2 text-right">{vndGon(d.phai_thu)}</td>
                <td className="num border-b border-line px-3 py-2 text-right">{vndGon(d.da_thu)}</td>
                <td className="num border-b border-line px-3 py-2 text-right text-muted">
                  {vndGon(d.tien_ve)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
