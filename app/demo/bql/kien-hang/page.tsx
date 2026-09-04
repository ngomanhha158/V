import { Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, ngayGioVN } from '@/components/ui'
import { loiTuoiKien, nhanLoaiHoa } from '@/lib/kien-hang'

// Dùng chung loiTuoiKien với màn thật: câu "quá mấy ngày, có gấp không" mà bản
// demo nói khác bản thật thì demo dạy sai đúng thứ người trực nhìn để quyết định.
//
// Bộ số cố ý bày cả ca gấp: một thùng để 5 ngày, và một kiện HÀNG LẠNH mới một
// ngày nhưng đã gấp — quầy không có tủ mát.
const DS = [
  { id: '1', can: 'P1-12.04', loai: 'kien_nho', nhan_luc: '2026-09-04T07:02:00Z', so_ngay: 0,
    nha_van_chuyen: 'GHTK', ma_van_don: 'GH8842011', vi_tri: 'Quầy lễ tân' },
  { id: '2', can: 'P1-07.09', loai: 'thung_lon', nhan_luc: '2026-08-30T04:20:00Z', so_ngay: 5,
    nha_van_chuyen: 'Shopee Express', ma_van_don: null, vi_tri: 'Góc trái sảnh' },
  { id: '3', can: 'P2-03.07', loai: 'hang_lanh', nhan_luc: '2026-09-03T02:45:00Z', so_ngay: 1,
    nha_van_chuyen: 'Bách Hóa Xanh', ma_van_don: null, vi_tri: 'Quầy lễ tân' },
  { id: '4', can: 'P1-22.01', loai: 'phong_bi', nhan_luc: '2026-09-04T02:45:00Z', so_ngay: 0,
    nha_van_chuyen: 'Viettel Post', ma_van_don: 'VT77120', vi_tri: 'Tủ A3' },
]

export default function Page() {
  const gap = DS.filter((r) => loiTuoiKien(r.so_ngay, r.loai).gap)

  return (
    <div className="space-y-5">
      <PageHead
        title="Nhận hàng hộ"
        sub="Quầy giữ hộ thì phải ghi được đã trao cho ai — trao bằng cách quét thẻ cư dân"
      />

      <Hop tone="xau" title={`${gap.length} kiện cần xử lý gấp`}>
        {gap.map((r) => `${r.can} (${nhanLoaiHoa(r.loai).toLowerCase()}, ${r.so_ngay} ngày)`).join(', ')}.
        Hệ thống đã nhắc cư dân mỗi ngày; quá lâu thì gọi điện, vì quầy không phải kho.
      </Hop>

      <Card>
        <CardHead
          title={`Đang giữ ${DS.length} kiện`}
          sub="Trao hàng: bấm Trao rồi quét thẻ cư dân bằng app camera"
        />
        <div className="scroll-x overflow-x-auto">
          <Bang>
            <thead>
              <Tr>
                <Th className="hidden sm:table-cell">Căn</Th>
                <Th>Kiện</Th>
                <Th className="hidden sm:table-cell">Nhận lúc</Th>
                <Th />
              </Tr>
            </thead>
            <tbody>
              {DS.map((r) => {
                const t = loiTuoiKien(r.so_ngay, r.loai)
                return (
                  <Tr key={r.id}>
                    <Td className="num hidden font-medium whitespace-nowrap sm:table-cell">{r.can}</Td>
                    <Td>
                      <div className="num text-[0.75rem] text-faint sm:hidden">{r.can}</div>
                      <div className="font-medium text-ink">{nhanLoaiHoa(r.loai)}</div>
                      <div className="text-[0.75rem] text-faint">
                        {[r.nha_van_chuyen, r.ma_van_don, r.vi_tri].filter(Boolean).join(' · ')}
                      </div>
                      <div className={t.gap ? 'mt-0.5 text-[0.75rem] text-bad sm:hidden' : 'mt-0.5 text-[0.75rem] text-faint sm:hidden'}>
                        {ngayGioVN(r.nhan_luc)} · {t.loi}
                      </div>
                    </Td>
                    <Td className="num hidden whitespace-nowrap text-muted sm:table-cell">
                      {ngayGioVN(r.nhan_luc)}
                      <div className={t.gap ? 'text-[0.75rem] text-bad' : 'text-[0.75rem] text-faint'}>
                        {t.loi}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="inline-flex h-8 items-center rounded-lg border border-line-firm bg-surface px-2.5 text-[0.8125rem] font-medium whitespace-nowrap text-ink">
                          Quét thẻ để trao
                        </span>
                        <span className="inline-flex h-8 items-center rounded-lg border border-line-firm bg-surface px-2.5 text-[0.8125rem] font-medium text-ink">
                          Hủy
                        </span>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Bang>
        </div>
      </Card>

      <Hop tone="trung" title="Trao hàng bằng cách quét thẻ, không ký sổ">
        Màn quét thẻ hiện luôn những kiện đang giữ cho căn đó và cho bấm trao —
        hệ thống ghi lại đúng con người đó, không phải một chữ ký nguệch ngoạc.
        Thẻ của căn khác không lấy được hàng căn này.
      </Hop>

      <Hop tone="canh" title="Chưa làm: ảnh kiện hàng">
        Đường tải ảnh hiện có phân quyền theo &ldquo;căn này có phải của bạn
        không&rdquo; — câu hỏi sai cho một bảo vệ đang chụp kiện hàng của người
        khác. Tổng quát hóa nó là một việc riêng.
      </Hop>
    </div>
  )
}
