import { Bang, Card, CardHead, Hop, Pill, Td, Th, Tr, Trong, cx, ngayVN, vnd } from '@/components/ui'
import { loiDoiChieu, nhanLoai, tienCoDau } from '@/lib/quy'

export type DongQuy = {
  id: string
  loai: string
  ngay: string
  dien_giai: string
  so_tien: number
  nghi_quyet: string | null
  ngay_nq: string | null
  ghi_chu: string | null
  da_dao: boolean
  la_dong_dao: boolean
  luy_ke: number
}

/**
 * Sổ quỹ bảo trì — MỘT thành phần, dùng cho cả màn cư dân lẫn màn BQL.
 *
 * Không phải để đỡ gõ. Cả tính năng này dựng lên để cư dân nhìn thấy tiền của
 * mình; hai bản cài đặt là hai bản sẽ lệch, và lúc lệch thì cuộc họp nhà chung
 * cư bắt đầu bằng việc cãi xem màn nào đúng thay vì bàn xem tiền đi đâu.
 */
export function QuySo({
  dong, nganHang, soTaiKhoan, soDuNganHang, doiChieuNgay, homNay, hanhDong,
}: {
  dong: DongQuy[]
  nganHang?: string
  soTaiKhoan?: string
  soDuNganHang?: number | null
  doiChieuNgay?: string | null
  homNay?: Date
  /** Nút của màn BQL. Màn cư dân không truyền gì — sổ chỉ để đọc. */
  hanhDong?: (d: DongQuy) => React.ReactNode
}) {
  const soDu = dong.at(-1)?.luy_ke ?? 0
  const dc = loiDoiChieu({
    soSach: soDu,
    soNganHang: soDuNganHang ?? null,
    ngay: doiChieuNgay ?? null,
    homNay,
  })

  return (
    <div className="space-y-4">
      {/* Số dư to, và ngay dưới nó là câu nói con số đó đã được ngân hàng xác
          nhận chưa. Để riêng hai thứ ra là mời người đọc tin con số mà bỏ qua
          điều kiện của nó. */}
      <Card>
        <div className="px-4 py-4">
          <p className="text-[0.8125rem] text-muted">Số dư quỹ bảo trì</p>
          <p className="num mt-1 text-[1.75rem] leading-none font-bold text-ink">{vnd(soDu)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Pill tone="brand">Tách khỏi phí quản lý</Pill>
            {nganHang && soTaiKhoan && (
              <span className="num text-[0.75rem] text-faint">
                {nganHang} · {soTaiKhoan}
              </span>
            )}
          </div>
        </div>
        <div className="border-t border-line px-4 py-3">
          <Hop tone={dc.muc === 'tot' ? 'tot' : dc.muc === 'canh' ? 'canh' : 'xau'} title={dc.tieu}>
            {dc.than}
          </Hop>
        </div>
      </Card>

      <Card>
        <CardHead title="Sổ quỹ" sub={`${dong.length} bút toán`} />
        {dong.length === 0 ? (
          <div className="p-4">
            <Trong title="Sổ quỹ chưa có bút toán nào">
              Bắt đầu bằng số dư đầu kỳ — số tiền chủ đầu tư bàn giao. Chưa có dòng
              đó thì mọi con số sau này đều treo lơ lửng.
            </Trong>
          </div>
        ) : (
          <div className="scroll-x overflow-x-auto">
            <Bang>
              <thead>
                <Tr>
                  {/* Trên điện thoại chỉ còn HAI cột: nội dung và số tiền.
                      Ngày chui vào khối nội dung, lũy kế chui xuống dưới số
                      tiền. Giữ đủ bốn cột thì bảng rộng hơn màn hình và thứ bị
                      đẩy ra ngoài mép lại chính là SỐ TIỀN — cột duy nhất không
                      được phép mất. */}
                  <Th className="hidden sm:table-cell">Ngày</Th>
                  <Th>Nội dung</Th>
                  <Th className="text-right">Số tiền</Th>
                  {/* Lũy kế bỏ hẳn cột trên điện thoại và chui xuống dưới ô số
                      tiền. Để nguyên bốn cột thì nó nằm ngoài mép màn hình và
                      không ai biết là có — mà "sau bút toán này quỹ còn bao
                      nhiêu" đúng là câu cư dân mở sổ ra để hỏi. */}
                  <Th className="hidden text-right sm:table-cell">Lũy kế</Th>
                  {hanhDong && <Th />}
                </Tr>
              </thead>
              <tbody>
                {dong.map((d) => (
                  <Tr key={d.id} className={d.da_dao ? 'opacity-55' : undefined}>
                    <Td className="num hidden whitespace-nowrap text-muted sm:table-cell">
                      {ngayVN(d.ngay)}
                    </Td>
                    <Td>
                      <div className="num mb-0.5 text-[0.75rem] text-faint sm:hidden">
                        {ngayVN(d.ngay)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-ink">{d.dien_giai}</span>
                        <Pill tone={d.loai === 'chi' ? 'canh' : d.loai === 'dieu_chinh' ? 'trung' : 'tot'}>
                          {nhanLoai(d.loai)}
                        </Pill>
                        {d.da_dao && <Pill tone="xau">Đã đảo</Pill>}
                      </div>
                      {/* Số nghị quyết là thứ duy nhất biến một khoản chi thành
                          một khoản chi HỢP LỆ, nên nó nằm cạnh khoản chi chứ
                          không giấu sau một nút "xem chi tiết". */}
                      {d.nghi_quyet && (
                        <div className="num mt-0.5 text-[0.75rem] text-muted">
                          {/* Số nghị quyết không được xuống dòng: "NQ-" một
                              dòng và "03/2026" dòng dưới là con số phải tra
                              lại biên bản bị bẻ làm đôi. */}
                          Nghị quyết <span className="whitespace-nowrap">{d.nghi_quyet}</span>
                          {d.ngay_nq && <span className="whitespace-nowrap"> · {ngayVN(d.ngay_nq)}</span>}
                        </div>
                      )}
                      {d.ghi_chu && (
                        <div className="mt-0.5 text-[0.75rem] text-faint">{d.ghi_chu}</div>
                      )}
                    </Td>
                    <Td
                      className={cx(
                        'num text-right font-medium whitespace-nowrap',
                        d.so_tien < 0 ? 'text-bad' : 'text-ok',
                      )}
                    >
                      {tienCoDau(d.so_tien)}
                      <div className="mt-0.5 text-[0.75rem] font-normal text-faint sm:hidden">
                        còn {vnd(d.luy_ke)}
                      </div>
                    </Td>
                    <Td className="num hidden text-right whitespace-nowrap text-muted sm:table-cell">
                      {vnd(d.luy_ke)}
                    </Td>
                    {hanhDong && <Td className="text-right">{hanhDong(d)}</Td>}
                  </Tr>
                ))}
              </tbody>
            </Bang>
          </div>
        )}
      </Card>
    </div>
  )
}
