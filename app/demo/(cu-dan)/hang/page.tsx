import { Card, CardHead, Hop, PageHead, Pill, cx, ngayGioVN } from '@/components/ui'
import { NHAN_TRANG_THAI, TONE_TRANG_THAI, loiKienCuaToi, nhanLoaiHoa } from '@/lib/kien-hang'

// Bộ số bày đủ ba trạng thái, trong đó ca đáng nhìn nhất là kiện ĐÃ LẤY: nó
// nói rõ AI lấy — đó là cả lý do tính năng tồn tại, và cũng là chỗ cư dân phát
// hiện ra người nhà đã lấy hộ mà quên nói.
const DS = [
  { id: '1', can: 'P1-12.04', loai: 'kien_nho', nhan_luc: '2026-09-04T07:02:00Z',
    vi_tri: 'Quầy lễ tân', nha_van_chuyen: 'GHTK', tra_luc: null,
    ten_nguoi_lay: null, ly_do_huy: null, trang_thai: 'dang_giu' },
  { id: '2', can: 'P1-12.04', loai: 'thung_lon', nhan_luc: '2026-09-02T09:15:00Z',
    vi_tri: 'Góc trái sảnh', nha_van_chuyen: 'Shopee Express', tra_luc: '2026-09-02T11:40:00Z',
    ten_nguoi_lay: 'Nguyễn Thị Mai', ly_do_huy: null, trang_thai: 'da_lay' },
  { id: '3', can: 'P1-12.04', loai: 'phong_bi', nhan_luc: '2026-08-29T03:10:00Z',
    vi_tri: null, nha_van_chuyen: 'Viettel Post', tra_luc: null,
    ten_nguoi_lay: null, ly_do_huy: 'Bên vận chuyển lấy lại vì sai địa chỉ', trang_thai: 'da_huy' },
]

export default function Page() {
  const dangGiu = DS.filter((k) => k.trang_thai === 'dang_giu')

  return (
    <div className="space-y-5">
      <PageHead
        title="Hàng gửi ở quầy"
        sub="Lễ tân giữ hộ — tới lấy thì đưa thẻ cư dân cho bảo vệ quét"
      />

      <Hop tone="canh" title={`Quầy đang giữ ${dangGiu.length} kiện của bạn`}>
        Mang theo điện thoại — bảo vệ quét thẻ cư dân là trao ngay, không phải ký
        sổ. Người nhà trong căn cũng lấy hộ được, và tên người lấy sẽ hiện ở đây.
      </Hop>

      <Card>
        <CardHead title="Tất cả kiện" sub={`${DS.length} lượt gần đây`} />
        <div className="divide-y divide-line">
          {DS.map((k) => (
            <div key={k.id} className={cx('px-4 py-3', k.trang_thai !== 'dang_giu' && 'opacity-70')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">
                    {nhanLoaiHoa(k.loai)}
                    <span className="ml-1.5 text-[0.8125rem] font-normal text-muted">
                      · {k.nha_van_chuyen}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[0.8125rem] text-muted">{loiKienCuaToi(k)}</div>
                  <div className="num mt-0.5 text-[0.75rem] text-faint">
                    Nhận {ngayGioVN(k.nhan_luc)}
                    {k.tra_luc && ` · trao ${ngayGioVN(k.tra_luc)}`}
                  </div>
                </div>
                <span className="shrink-0">
                <Pill tone={TONE_TRANG_THAI[k.trang_thai] ?? 'trung'}>
                  {NHAN_TRANG_THAI[k.trang_thai] ?? k.trang_thai}
                </Pill>
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Hop tone="trung" title="Vì sao phải quét thẻ mới lấy được">
        Trước đây bảo vệ giữ hộ hàng chục kiện mỗi ngày mà không ai ký nhận — mất
        hàng là tranh cãi không có bằng chứng. Quét thẻ ghi lại đúng con người đã
        lấy, nên nếu có chuyện thì cả hai bên đều có chỗ để tra.
      </Hop>
    </div>
  )
}
