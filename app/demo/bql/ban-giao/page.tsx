import { Bang, Card, CardHead, Hop, PageHead, Td, Th, Tr, ngayVN, vnd } from '@/components/ui'
import { ChotSo, type BanChot } from '@/components/chot-so'

// Dùng chung ChotSo và loiHieuLuc/loiTyLeNo/loiLechQuy với màn thật: câu "bản
// chốt đã có hiệu lực chưa" mà demo nói khác bản thật thì demo dạy sai đúng thứ
// quyết định — một bản nháp và một thỏa thuận đã ký trông giống hệt nhau nếu
// chỉ nhìn số.
//
// Hai bản cố ý ở hai trạng thái khác nhau, và bản chờ ký có SỔ LỆCH NGÂN HÀNG —
// đúng thứ phải tìm ra trước khi ký.
const DS: BanChot[] = [
  {
    id: '1', ngay_chot: '2026-09-30', so_can: 468, so_can_no: 37,
    tong_phai_thu: 184_320_000, qua_han_90: 21_500_000,
    quy_bao_tri: 2_106_920_000, quy_doi_chieu: 2_106_920_000, audit_den: 41_882,
    lap_luc: '2026-10-02T02:10:00Z',
    ky_bql_luc: '2026-10-02T03:00:00Z', ky_bqt_luc: '2026-10-03T08:20:00Z',
    huy_luc: null, ly_do_huy: null, ghi_chu: 'Bàn giao cho đơn vị quản lý mới',
  },
  {
    id: '2', ngay_chot: '2026-12-31', so_can: 468, so_can_no: 122,
    tong_phai_thu: 402_150_000, qua_han_90: 96_400_000,
    quy_bao_tri: 2_151_920_000, quy_doi_chieu: 2_145_000_000, audit_den: 52_004,
    lap_luc: '2027-01-03T01:30:00Z',
    ky_bql_luc: '2027-01-03T02:00:00Z', ky_bqt_luc: null,
    huy_luc: null, ly_do_huy: null, ghi_chu: 'Chốt cuối năm',
  },
]

const TRUOC = [
  { unit_id: 'a', ma_can: 'P1-15.11', phai_thu: 12_800_000, qua_han_90: 9_600_000, hoa_don_cu_nhat: '2026-04-15' },
  { unit_id: 'b', ma_can: 'P2-08.03', phai_thu: 8_450_000, qua_han_90: 0, hoa_don_cu_nhat: '2026-11-15' },
  { unit_id: 'c', ma_can: 'P1-03.02', phai_thu: 5_120_000, qua_han_90: 5_120_000, hoa_don_cu_nhat: '2026-05-15' },
]

export default function Page() {
  const tong = TRUOC.reduce((t, r) => t + r.phai_thu, 0)

  return (
    <div className="space-y-5">
      <PageHead
        title="Chốt sổ bàn giao"
        sub="Đổi đơn vị quản lý là lúc dễ mất tiền nhất — bản chốt là tờ giấy ở giữa hai bên"
      />

      {DS.map((c) => (
        <ChotSo
          key={c.id}
          c={c}
          hanhDong={
            c.ky_bqt_luc ? (
              <p className="text-[0.8125rem] leading-relaxed text-muted">
                Đã đủ hai chữ ký nên không sửa và không hủy được nữa. Cần đổi thì
                lập bản chốt mới cho một mốc khác — bản này ở lại làm bằng chứng
                của thời điểm đó.
              </p>
            ) : (
              <div className="flex flex-wrap items-start gap-3">
                <span className="inline-flex h-8 items-center rounded-lg border border-transparent bg-brand px-2.5 text-[0.8125rem] font-medium text-on-brand">
                  Ký bản chốt này
                </span>
                <span className="inline-flex h-8 items-center rounded-lg border border-line-firm bg-surface px-2.5 text-[0.8125rem] font-medium text-ink">
                  Hủy bản chốt
                </span>
              </div>
            )
          }
        />
      ))}

      <Card>
        <CardHead title="Xem trước: công nợ tính tới hôm qua" sub={`${TRUOC.length} căn · ${vnd(tong)}`} />
        <div className="scroll-x overflow-auto">
          <Bang>
            <thead>
              <Tr>
                <Th>Căn</Th>
                <Th className="text-right">Phải thu</Th>
                <Th className="hidden text-right sm:table-cell">Quá 90 ngày</Th>
                <Th className="hidden sm:table-cell">Hóa đơn cũ nhất</Th>
              </Tr>
            </thead>
            <tbody>
              {TRUOC.map((r) => (
                <Tr key={r.unit_id}>
                  <Td className="num font-medium whitespace-nowrap">{r.ma_can}</Td>
                  <Td className="num text-right whitespace-nowrap">{vnd(r.phai_thu)}</Td>
                  <Td className="num hidden text-right whitespace-nowrap text-bad sm:table-cell">
                    {r.qua_han_90 > 0 ? vnd(r.qua_han_90) : '—'}
                  </Td>
                  <Td className="num hidden whitespace-nowrap text-muted sm:table-cell">
                    {ngayVN(r.hoa_don_cu_nhat)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Bang>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-[0.75rem] leading-relaxed text-faint">
          Đây là truy vấn SỐNG, đổi theo từng khoản tiền về. Bấm chốt thì con số
          được đóng băng và không đổi nữa — đó là cả điểm khác nhau giữa hai khối
          trên màn này.
        </p>
      </Card>

      <Hop tone="trung" title="Vì sao phải hai bên ký">
        Một người ký cả hai ô thì &ldquo;hai bên ký&rdquo; chỉ còn là một người
        tự xác nhận với chính mình — hệ thống chặn ngay ở tầng database. Bên nào
        ký cũng không tự chọn được: suy ra từ vai trò của tài khoản đang đăng nhập.
      </Hop>
    </div>
  )
}
