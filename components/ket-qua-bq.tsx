import { Card, CardHead, Hop, Pill, cx, ngayGioVN } from '@/components/ui'
import {
  NHAN_DOAN, NHAN_TRANG_THAI, TONE_TRANG_THAI,
  doanThanh, giaiThichKetQua, m2, phanTram, trangThaiBQ, tyLe,
  type KetQua,
} from '@/lib/bieu-quyet'

export type CuocBQ = {
  id: string
  tieu_de: string
  noi_dung: string | null
  nguong_du_hop: number
  nguong_thong_qua: number
  tong_dien_tich: number
  so_can: number
  mo_luc: string
  dong_luc: string | null
  huy_luc: string | null
  ly_do_huy: string | null
  kq_dien_tich_bo_phieu: number | null
  kq_tan_thanh: number | null
  kq_khong_tan_thanh: number | null
  kq_trang: number | null
  kq_du_hop: boolean | null
  kq_thong_qua: boolean | null
}

const MAU_DOAN: Record<string, string> = {
  tan_thanh: 'bg-ok',
  khong_tan_thanh: 'bg-bad',
  trang: 'bg-faint',
  // KHÔNG dùng bg-sunken: nền của chính thanh cũng là bg-sunken, nên đoạn "chưa
  // bỏ phiếu" sẽ tàng hình — mà nó thường là đoạn dài nhất và là tin quan trọng
  // nhất trên thanh. Chấm chú giải cũng vì thế mà mất luôn.
  chua_bo: 'bg-line-firm',
}

/**
 * Kết quả một cuộc biểu quyết, dùng chung ở màn BQL và màn cư dân.
 *
 * Cùng một khối chữ cho cả hai bên là cố ý: cư dân đọc được ĐÚNG CÂU mà ban
 * quản trị đọc. Hai bản diễn giải khác nhau cho cùng một con số là thứ sinh ra
 * tranh cãi ở hội nghị, và ở đây thì không có chỗ cho nó tồn tại.
 */
export function KetQuaBQ({
  bq, k, dangTinh, hanhDong,
}: { bq: CuocBQ; k: KetQua | null; dangTinh?: boolean; hanhDong?: React.ReactNode }) {
  const t = trangThaiBQ(bq)
  if (!k) {
    return (
      <Card>
        <CardHead title={bq.tieu_de} />
        <div className="p-4">
          <Hop tone="xau">Không đọc được kết quả kiểm phiếu của cuộc này.</Hop>
        </div>
      </Card>
    )
  }
  const g = giaiThichKetQua(k, bq.nguong_du_hop, bq.nguong_thong_qua)
  const doan = doanThanh(k).filter((d) => d.m2 > 0)

  return (
    <Card>
      <CardHead
        xuongDong
        title={
          <span className="flex flex-wrap items-center gap-2">
            {/* break-words: tiêu đề nghị quyết là câu dài, không phải nhãn. */}
            <span className="min-w-0 break-words">{bq.tieu_de}</span>
            <Pill tone={TONE_TRANG_THAI[t]}>{NHAN_TRANG_THAI[t]}</Pill>
          </span>
        }
        sub={
          t === 'da_dong'
            ? `Kiểm phiếu ${ngayGioVN(bq.dong_luc!)} · ${bq.so_can} căn · ${m2(bq.tong_dien_tich)}`
            : `Mở ${ngayGioVN(bq.mo_luc)} · ${bq.so_can} căn · ${m2(bq.tong_dien_tich)}`
        }
      />

      <div className="space-y-4 p-4">
        {bq.noi_dung && (
          <p className="text-[0.8125rem] leading-relaxed whitespace-pre-line text-muted">
            {bq.noi_dung}
          </p>
        )}

        {t === 'da_huy' ? (
          <Hop tone="trung" title="Cuộc biểu quyết này đã hủy">
            Lý do: {bq.ly_do_huy?.trim() || 'không ghi'}. Số liệu bên dưới không có giá trị.
          </Hop>
        ) : (
          <Hop tone={g.ok ? 'tot' : t === 'da_dong' ? 'xau' : 'canh'} title={g.tieu}>
            {g.than}
          </Hop>
        )}

        {/* Thanh vẽ theo DIỆN TÍCH TOÀN KHU: phần xám "chưa bỏ phiếu" thường là
            phần lớn nhất, và giấu nó đi là giấu mất tình hình thật. */}
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-sunken">
            {doan.map((d) => (
              <span
                key={d.khoa}
                className={cx('h-full', MAU_DOAN[d.khoa])}
                style={{ width: `${d.pt}%` }}
                title={`${NHAN_DOAN[d.khoa]}: ${m2(d.m2)}`}
              />
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.75rem]">
            {doan.map((d) => (
              <span key={d.khoa} className="inline-flex items-center gap-1.5">
                <span className={cx('size-2 shrink-0 rounded-full', MAU_DOAN[d.khoa])} />
                <span className="text-muted">{NHAN_DOAN[d.khoa]}</span>
                <span className="num font-medium text-ink">{m2(d.m2)}</span>
                <span className="num text-faint">({phanTram(d.pt)})</span>
              </span>
            ))}
          </div>
        </div>

        {/* HAI DÒNG RIÊNG, mỗi dòng nói rõ mẫu số của nó. Gộp thành một con số
            là đúng lỗi mà cả tính năng này dựng lên để tránh. */}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-line bg-sunken px-3.5 py-3">
            <dt className="text-[0.75rem] font-medium text-muted">
              Tỷ lệ dự họp — trên diện tích TOÀN KHU
            </dt>
            <dd className="num mt-1 text-[1.375rem] leading-none font-semibold text-ink">
              {phanTram(k.ty_le_du_hop)}
            </dd>
            <dd className="num mt-1.5 text-[0.75rem] text-faint">
              {m2(k.dien_tich_bo_phieu)} / {m2(k.tong_dien_tich)} · cần{' '}
              {phanTram(bq.nguong_du_hop)} · {k.so_can_da_bo}/{bq.so_can} căn
            </dd>
          </div>
          <div className="rounded-card border border-line bg-sunken px-3.5 py-3">
            <dt className="text-[0.75rem] font-medium text-muted">
              Tỷ lệ tán thành — trên diện tích ĐÃ BỎ PHIẾU
            </dt>
            <dd className="num mt-1 text-[1.375rem] leading-none font-semibold text-ink">
              {phanTram(k.ty_le_tan_thanh)}
            </dd>
            <dd className="num mt-1.5 text-[0.75rem] text-faint">
              {m2(k.tan_thanh)} / {m2(k.dien_tich_bo_phieu)} · cần{' '}
              {phanTram(bq.nguong_thong_qua)}
            </dd>
          </div>
        </dl>

        {dangTinh && t === 'dang_mo' && (
          <p className="text-[0.75rem] leading-relaxed text-faint">
            Đây là số TẠM TÍNH, đổi theo từng lá phiếu vào. Con số chính thức là
            con số lúc ban quản trị bấm kiểm phiếu — từ lúc đó nó được chốt lại
            và không tính lại nữa.
          </p>
        )}

        {hanhDong}
      </div>
    </Card>
  )
}

/**
 * Kết quả ĐÃ CHỐT đọc từ chính bản ghi, KHÔNG kiểm lại.
 *
 * Gọi lại kiem_phieu_bieu_quyet() cho cuộc đã đóng thì hôm nay vẫn ra đúng con
 * số ấy — nhưng nó là một phép tính chạy lại, và cả điểm của việc chốt là câu
 * "con số này không tính lại nữa". Đọc từ cột đã lưu là cách duy nhất để câu đó
 * đúng cả vào ngày ai đó lỡ tay sửa một lá phiếu cũ.
 *
 * `soCanDaBo` truyền từ ngoài vào vì bản ghi cố ý không lưu số căn: cái đóng
 * băng là DIỆN TÍCH, còn số căn chỉ để đọc cho dễ hình dung.
 */
export function ketQuaDaChot(bq: CuocBQ, soCanDaBo = 0): KetQua | null {
  if (bq.kq_dien_tich_bo_phieu == null) return null
  const bo = bq.kq_dien_tich_bo_phieu
  const tt = bq.kq_tan_thanh ?? 0
  return {
    dien_tich_bo_phieu: bo,
    tan_thanh: tt,
    khong_tan_thanh: bq.kq_khong_tan_thanh ?? 0,
    trang: bq.kq_trang ?? 0,
    tong_dien_tich: bq.tong_dien_tich,
    so_can_da_bo: soCanDaBo,
    ty_le_du_hop: tyLe(bo, bq.tong_dien_tich),
    ty_le_tan_thanh: tyLe(tt, bo),
    du_hop: bq.kq_du_hop ?? false,
    thong_qua: bq.kq_thong_qua ?? false,
  }
}
