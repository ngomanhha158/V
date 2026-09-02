import QRCode from 'qrcode'
import { Card, CardHead, Hop, PageHead, Pill } from '@/components/ui'
import { CAN_CUA_TOI, TOI } from '@/lib/demo/data'

// Mã QR ở đây là THẬT — quét được, và dẫn sang màn bảo vệ của bản demo. Vẽ
// một ô vuông giả thì người xem không biết được nó có quét nổi trên máy họ
// không, mà đó lại là câu hỏi duy nhất đáng quan tâm ở tính năng này.
// Khác màn thật đúng một chỗ: mã không đổi, vì bản demo không có phiên đăng
// nhập nào để cấp mã mới. Hộp cuối trang nói rõ chỗ khác đó.
export default async function Page() {
  const qr = await Promise.all(CAN_CUA_TOI.map(async (c) => ({
    ...c,
    anh: await QRCode.toString(`https://vbuilding.example.vn/demo/quet`, {
      type: 'svg', margin: 0, errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }),
  })))

  return (
    <div className="space-y-5">
      <PageHead
        title="Thẻ cư dân"
        sub="Đưa mã cho bảo vệ quét khi ra vào — không cần mang thẻ nhựa"
      />

      {qr.map((c) => (
        <Card key={c.id}>
          <CardHead
            title={c.code}
            sub={c.toa}
            right={<Pill tone="tot">{c.vai_tro}</Pill>}
          />
          <div className="p-4">
            <div className="flex flex-col items-center gap-2">
              <div
                className="grid aspect-square w-full max-w-[17rem] place-items-center rounded-card border border-line bg-white p-3 [&>svg]:size-full"
                dangerouslySetInnerHTML={{ __html: c.anh }}
              />
              <p className="text-center text-[0.75rem] text-faint">
                Mã tự đổi. Đưa màn hình cho bảo vệ quét — vặn sáng màn hình lên
                nếu sảnh tối.
              </p>
            </div>
          </div>
        </Card>
      ))}

      <Hop tone="trung" title="Vì sao mã lại đổi liên tục">
        Mã chỉ sống một phút, nên ảnh chụp màn hình gửi cho người khác dùng không
        được. Và thẻ không nằm trong máy bạn: mỗi lần quét, hệ thống hỏi lại
        database xem hợp đồng còn hiệu lực không — nên trả nhà xong là thẻ ngừng
        ngay, không phải chờ ai thu hồi.
      </Hop>

      <Hop tone="canh" title="Khác bản thật một chỗ">
        Ở đây mã đứng yên vì bản demo không có phiên đăng nhập để cấp mã mới.
        Trên bản thật, {TOI.ho_ten} mở màn này là máy chủ ký một mã mới, và nó
        tự làm mới trước khi hết hạn.
      </Hop>
    </div>
  )
}
