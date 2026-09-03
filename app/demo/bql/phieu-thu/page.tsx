import Link from 'next/link'
import { Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, ngayGioVN, vnd } from '@/components/ui'
import { loiLienTuc } from '@/lib/phieu-thu'

// Dùng chung loiLienTuc với màn thật: câu trả lời cho câu hỏi của kiểm toán mà
// bản demo nói khác bản thật thì demo đang dạy sai đúng thứ quan trọng nhất.
//
// Bộ số cố ý bày cả ca xấu: một phiếu đã hủy (số của nó KHÔNG được cấp lại) và
// một phiếu trả thừa — hai thứ người trực gặp trong tháng đầu tiên.
const KY = '2026-09-01'
const DS = [
  { id: '1', so_phieu: 'PT-2609-0181', stt: 181, nhan_luc: '2026-09-02T02:12:00Z', ma_can: 'P1-08.02', nguoi_nop: 'Nguyễn Văn Hải',    tong_thu: 1_287_000, da_huy: false, ly_do_huy: null },
  { id: '2', so_phieu: 'PT-2609-0182', stt: 182, nhan_luc: '2026-09-02T03:40:00Z', ma_can: 'P1-15.11', nguoi_nop: 'Lê Thị Hồng Vân',   tong_thu: 2_000_000, da_huy: true,  ly_do_huy: 'Ghi nhầm căn, đã gạch lại cho P1-15.01' },
  { id: '3', so_phieu: 'PT-2609-0183', stt: 183, nhan_luc: '2026-09-02T07:05:00Z', ma_can: 'P2-03.07', nguoi_nop: 'Phạm Quốc Cường',   tong_thu: 946_000,   da_huy: false, ly_do_huy: null },
  { id: '4', so_phieu: 'PT-2609-0184', stt: 184, nhan_luc: '2026-09-03T02:12:00Z', ma_can: 'P1-12.04', nguoi_nop: 'Trần Thị Bích Ngọc', tong_thu: 1_406_000, da_huy: false, ly_do_huy: null },
]

export default function Page() {
  const thieu: number[] = []
  const kiem = loiLienTuc(KY, thieu, 184)
  const conHieuLuc = DS.filter((r) => !r.da_huy)
  const tongThu = conHieuLuc.reduce((t, r) => t + r.tong_thu, 0)

  return (
    <div className="space-y-5">
      <PageHead
        title="Phiếu thu"
        sub="Chứng từ cấp cho từng lần tiền về — dãy số phải liền mạch trong kỳ"
        actions={
          <div className="flex items-center gap-1.5">
            <span className="rounded-lg border border-line-firm px-2.5 py-1.5 text-[0.8125rem] text-faint">←</span>
            <span className="num px-1 text-sm font-semibold text-ink">09/2026</span>
            <span className="rounded-lg border border-line-firm px-2.5 py-1.5 text-[0.8125rem] text-faint">→</span>
          </div>
        }
      />

      <Hop tone="tot" title="Dãy số nguyên vẹn">{kiem.loi}</Hop>

      <Card>
        <CardHead
          title="4 phiếu gần nhất trong 184 phiếu của kỳ"
          sub="Màn thật liệt kê cả kỳ; ở đây rút gọn cho dễ nhìn"
        />
        <div className="scroll-x overflow-x-auto">
          <Bang>
            <thead>
              <Tr>
                <Th>Số chứng từ</Th>
                <Th>Ngày nhận tiền</Th>
                <Th>Căn</Th>
                <Th>Người nộp</Th>
                <Th className="text-right">Tổng thu</Th>
                <Th />
              </Tr>
            </thead>
            <tbody>
              {DS.map((r) => (
                <Tr key={r.id} className={r.da_huy ? 'opacity-60' : undefined}>
                  <Td>
                    <Link href="/demo/phieu-thu" className="num font-medium whitespace-nowrap text-brand hover:underline">
                      {r.so_phieu}
                    </Link>
                    {r.da_huy && <div className="mt-1 text-[0.75rem] text-bad">Đã hủy — {r.ly_do_huy}</div>}
                  </Td>
                  <Td className="num whitespace-nowrap text-muted">{ngayGioVN(r.nhan_luc)}</Td>
                  <Td className="num font-medium whitespace-nowrap">{r.ma_can}</Td>
                  <Td>{r.nguoi_nop}</Td>
                  <Td className="num text-right font-medium">{vnd(r.tong_thu)}</Td>
                  <Td className="text-right">
                    {r.da_huy ? (
                      <Pill tone="xau">Đã hủy</Pill>
                    ) : (
                      <span className="inline-flex h-8 items-center rounded-lg border border-line-firm bg-surface px-2.5 text-[0.8125rem] font-medium text-ink">
                        Hủy phiếu
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Bang>
        </div>
        <div className="border-t border-line bg-raised px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Tổng thu 4 phiếu gần nhất</span>
            <span className="num font-medium text-ink">{vnd(tongThu)}</span>
          </div>
        </div>
      </Card>

      <Hop tone="trung" title="Hủy phiếu không phải là hoàn tiền">
        Hủy chỉ bỏ tờ chứng từ — khoản tiền vẫn nằm nguyên trong hệ thống và hóa
        đơn vẫn được ghi là đã trả. Số đã hủy <strong>không</strong> được cấp lại
        cho phiếu khác: hai tờ giấy khác nhau mang cùng một số là thứ không giải
        trình được.
      </Hop>
    </div>
  )
}
