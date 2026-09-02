import { Hop, PageHead } from '@/components/ui'
import { DU_AN } from '@/lib/demo/data'
import { XuatDemo } from './xuat-demo'

export const dynamic = 'force-dynamic'

export default async function DemoXuat() {
  // Mốc chốt tính MỘT lần ở server rồi truyền xuống. Gọi new Date() trong
  // component client là server và trình duyệt ra hai giá trị khác nhau —
  // React báo lệch hydrat, và bản demo hiện hai mốc thời gian khác nhau.
  const chotLuc = new Date().toISOString()
  return (
    <div className="space-y-5">
      <PageHead
        title="Xuất Excel"
        sub={`${DU_AN.ten} · file .xlsx mở được bằng Excel, Google Sheets hay LibreOffice`}
      />

      <Hop tone="canh" title="Bản demo bày nội dung file, không tải file">
        Màn thật dựng file từ dữ liệu thật rồi trả về để trình duyệt lưu. Ở đây không có dữ
        liệu thật để dựng, nên thay vì một nút bấm vào không ra gì, bên dưới bày{' '}
        <strong>đúng những gì có trong file</strong>: sheet Tổng hợp, bộ cột, và vài dòng mẫu.
      </Hop>

      <Hop tone="trung" title="Số tiền trong file là SỐ, không phải chữ">
        Cột tiền ghi ở dạng số có định dạng phân nhóm nghìn, nên bôi đen cả cột là Excel cộng
        ra tổng ngay. Ghi thành chữ &ldquo;1.287.000đ&rdquo; thì nhìn đẹp hơn nhưng không cộng
        được — mà cộng được mới là lý do cần file Excel thay vì ảnh chụp màn hình.
        <br /><br />
        Sheet <strong>Tổng hợp</strong> đứng trước sheet chi tiết, ghi rõ kỳ, thời điểm chốt
        số và người xuất. Báo cáo công nợ hôm nay khác hôm qua và cả hai đều đúng — không ghi
        mốc vào file thì hai người cầm hai bản sẽ cãi nhau xem bản nào sai.
      </Hop>

      <XuatDemo chotLuc={chotLuc} />
    </div>
  )
}
