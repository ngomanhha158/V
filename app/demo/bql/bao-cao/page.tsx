import { Card, CardHead, Field, Hop, PageHead, Select } from '@/components/ui'
import { BaoCaoQuy, timQuyTruoc, type BanBaoCao } from '@/components/bao-cao-quy'
import { LA_MA } from '@/lib/bao-cao'

// Hai quý liên tiếp, cố ý: một con số không có xu hướng thì khó hành động, và
// khối "so với quý trước" chỉ hiện ra khi có bản của quý liền kề.
const CHUNG = {
  so_can: 468, quy_bao_tri_dau: 2_100_000_000,
  nguoi_lap: 'Trần Minh Đức (BQT)', audit_den: 52_004,
  huy_luc: null as string | null, ly_do_huy: null as string | null,
}

const DS: BanBaoCao[] = [
  {
    ...CHUNG, id: 'q3', nam: 2026, quy: 3, tu_ngay: '2026-07-01', den_ngay: '2026-09-30',
    hoa_don_phai_thu: 1_000_000_000, hoa_don_da_thu: 864_000_000,
    cong_no_cuoi_quy: 136_000_000, so_can_no: 37,
    quy_bao_tri_cuoi: 2_004_000_000, quy_chi_trong_quy: 96_000_000, chi_vat_tu: 12_400_000,
    so_yeu_cau: 240, so_yeu_cau_xong: 228, so_yeu_cau_dung_han: 208,
    so_danh_gia: 96, tong_diem: 413, so_thi_cong: 7,
    so_ban_giao_ca: 182, so_ban_giao_chua_ky: 4,
    lap_luc: '2026-10-05T02:00:00Z',
  },
  {
    ...CHUNG, id: 'q2', nam: 2026, quy: 2, tu_ngay: '2026-04-01', den_ngay: '2026-06-30',
    hoa_don_phai_thu: 980_000_000, hoa_don_da_thu: 803_600_000,
    cong_no_cuoi_quy: 176_400_000, so_can_no: 52,
    quy_bao_tri_dau: 2_182_000_000, quy_bao_tri_cuoi: 2_100_000_000,
    quy_chi_trong_quy: 82_000_000, chi_vat_tu: 9_800_000,
    so_yeu_cau: 214, so_yeu_cau_xong: 205, so_yeu_cau_dung_han: 171,
    so_danh_gia: 8, tong_diem: 34, so_thi_cong: 5,
    so_ban_giao_ca: 178, so_ban_giao_chua_ky: 0,
    lap_luc: '2026-07-05T02:00:00Z', audit_den: 41_882,
  },
]

export default function Page() {
  return (
    <div className="space-y-5">
      <PageHead
        title="Báo cáo quý"
        sub="Bản chụp đóng băng để biên bản họp và báo cáo nói cùng một con số mãi mãi"
      />

      <Card>
        <CardHead
          title="Lập báo cáo"
          sub="Job nền tự sinh vào 02:00 ngày 5 tháng đầu mỗi quý — nút này để lập sớm hoặc lập lại"
        />
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Field
            label="Quý"
            hint="Chỉ liệt kê quý ĐÃ KẾT THÚC — nửa quý đặt cạnh một quý đủ là phép so sánh sai mà nhìn rất hợp lý."
            className="min-w-[12rem]"
          >
            <Select defaultValue="2026-3">
              {[3, 2, 1].map((q) => (
                <option key={q} value={`2026-${q}`}>Quý {LA_MA[q]}/2026</option>
              ))}
            </Select>
          </Field>
          <span className="inline-flex h-10 items-center rounded-ctl border border-transparent bg-brand px-3.5 text-sm font-medium text-on-brand">
            Lập báo cáo
          </span>
        </div>
      </Card>

      {DS.map((b) => (
        <BaoCaoQuy
          key={b.id}
          b={b}
          truoc={timQuyTruoc(b, DS)}
          hanhDong={
            <div className="border-t border-line pt-4">
              <span className="inline-flex h-8 items-center rounded-ctl border border-line-firm bg-surface px-2.5 text-[0.8125rem] font-medium text-ink">
                Hủy bản này
              </span>
            </div>
          }
        />
      ))}

      <Hop tone="trung" title="Vì sao báo cáo phải đóng băng">
        BQT họp quý, bàn dựa trên số liệu, rồi biên bản ghi lại con số đó. Nếu mở
        lại báo cáo sau ba tháng mà thấy số khác — vì tiền về muộn, vì có yêu cầu
        đóng thêm — thì biên bản đã ký thành sai, và không ai sửa được. Nên ở đây
        mỗi quý có đúng một bản còn hiệu lực, số chốt lúc lập, và muốn số mới thì
        phải hủy bản cũ kèm lý do.
      </Hop>
    </div>
  )
}
