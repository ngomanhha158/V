import { Bang, Button, Card, CardHead, Hop, LinkButton, PageHead, Stat, Td, Th, Tr } from '@/components/ui'
import { IcNhap } from '@/components/icons'
import { DU_AN, TOA_NHA_DEMO } from '@/lib/demo/data'

export const dynamic = 'force-dynamic'

// Màn thật đọc file .xlsx người dùng chọn rồi hiện đúng ba ô thống kê và bảng
// dòng lỗi bên dưới. Bản demo không có file để đọc, nên bày sẵn kết quả kiểm
// tra của một file mẫu — nhưng bày ĐÚNG những khối màn thật bày, không thêm
// bảng nào màn thật không có.
const LOI = [
  { dong: 5, cot: 'tòa', chu: 'Tòa "P9" chưa có trong hệ thống. Tạo tòa trước khi import căn.' },
  { dong: 7, cot: 'căn hộ', chu: 'Mã căn "P1-08.01" đã có trong hệ thống.' },
  { dong: 9, cot: 'tầng', chu: 'Tầng phải là số nguyên, đang là "tầng mười".' },
  { dong: 12, cot: 'diện tích', chu: 'Diện tích không phải số: "78,5 m2 (đo lại)".' },
]
const SO_HOP_LE = 3
const SO_TRONG = 7

export default async function DemoImport() {
  return (
    <div className="space-y-5">
      <PageHead
        title="Import danh sách căn hộ"
        sub={`${DU_AN.ten} · đọc file Excel, kiểm tra trước khi ghi`}
      />

      <Card>
        <CardHead
          title="Chọn file Excel"
          sub="File được đọc và kiểm tra trước, không ghi gì cho tới khi bạn xác nhận"
        />
        <div className="space-y-3 p-4">
          <div className="rounded-ctl border border-dashed border-line-firm bg-raised p-3 text-[0.8125rem] text-muted">
            danh-sach-can-P1.xlsx · 14 dòng
            <span className="ml-2 text-faint">(bản demo không đọc file thật)</span>
          </div>
          <Button dang="chinh" disabled>
            <IcNhap width={15} height={15} />
            Kiểm tra file
          </Button>
          <div className="text-[0.8125rem] leading-relaxed text-muted">
            Cột bắt buộc: <b className="text-ink">Tòa</b>, <b className="text-ink">Mã căn</b>,{' '}
            <b className="text-ink">Tầng</b>. Không bắt buộc: Diện tích, Loại, Tình trạng.
            {' '}Tên cột đọc linh hoạt: &ldquo;dien tich&rdquo;, &ldquo;diện tích&rdquo;,
            {' '}&ldquo;dt&rdquo;, &ldquo;m2&rdquo; đều hiểu là một cột.
            {' '}Tòa đã có: <span className="text-ink">{TOA_NHA_DEMO.map((b) => b.code).join(', ')}</span>.
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Stat nhan="Dòng hợp lệ" so={SO_HOP_LE} tone="tot" />
        <Stat nhan="Dòng lỗi" so={LOI.length} tone="xau" />
        <Stat nhan="Dòng trống bỏ qua" so={SO_TRONG} />
      </div>

      <Card>
        <CardHead
          title="Các dòng có vấn đề"
          sub="danh-sach-can-P1.xlsx — sửa trong Excel rồi tải lên lại phần còn thiếu"
        />
        <Bang>
          <thead>
            <tr><Th>Dòng</Th><Th>Cột</Th><Th>Vấn đề</Th></tr>
          </thead>
          <tbody>
            {LOI.map((l) => (
              <Tr key={l.dong}>
                <Td so className="font-medium text-ink">{l.dong}</Td>
                <Td className="text-muted">{l.cot}</Td>
                <Td className="text-bad">{l.chu}</Td>
              </Tr>
            ))}
          </tbody>
        </Bang>
      </Card>

      <Card>
        <div className="space-y-3 p-4">
          <Hop tone="canh" title="Chỉ import phần hợp lệ">
            {SO_HOP_LE} dòng sẽ được ghi, {LOI.length} dòng lỗi bị bỏ qua. Sửa file rồi tải
            lên lại phần còn thiếu.
          </Hop>
          <Button dang="chinh" disabled className="w-full">Import {SO_HOP_LE} căn hộ</Button>
        </div>
      </Card>

      <Hop tone="trung" title="Ghi bằng một lệnh duy nhất">
        Hoặc vào hết, hoặc không dòng nào. Import nửa vời rồi bắt BQL tự dò xem tới dòng nào
        là cách nhanh nhất để mất niềm tin vào số liệu.
      </Hop>

      <Hop tone="canh" title="Import không sửa được căn đã có">
        Dòng 7 bị từ chối vì mã căn đã tồn tại — cố ý: import là để <strong>thêm</strong> căn,
        không phải để đè lên dữ liệu đang chạy. Sửa diện tích hay tình trạng của căn đã có thì
        làm ở màn Căn hộ.
        <div className="mt-3">
          <LinkButton href="/demo/bql/can-ho" co="sm" dang="chinh">Sang màn Căn hộ</LinkButton>
        </div>
      </Hop>
    </div>
  )
}
