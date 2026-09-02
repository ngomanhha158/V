import { Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr } from '@/components/ui'
import { conTrong, nhanLoai, vuotSucChua } from '@/lib/xe'

// Dùng chung nhanLoai / conTrong / vuotSucChua với màn thật — lệch cách đọc con
// số là bản demo dạy sai đúng thứ người ta sẽ nhìn hằng ngày.
// Bộ số cố ý bày đủ bốn tình huống: bình thường, hàng chờ dài, chưa đặt hạn
// mức, và nhận quá sức chứa.
const DS = [
  { toa: 'Park 1', loai: 'o_to',   co_han_muc: true,  tong_cho: 180, moi_can: 1, dang_dung: 180, hang_cho: 14, qua_han_muc: 6 },
  { toa: 'Park 1', loai: 'xe_may', co_han_muc: true,  tong_cho: 900, moi_can: 3, dang_dung: 612, hang_cho: 0,  qua_han_muc: 2 },
  { toa: 'Park 1', loai: 'xe_dap', co_han_muc: false, tong_cho: 0,   moi_can: 0, dang_dung: 37,  hang_cho: 0,  qua_han_muc: 0 },
  { toa: 'Park 2', loai: 'o_to',   co_han_muc: true,  tong_cho: 120, moi_can: 1, dang_dung: 126, hang_cho: 9,  qua_han_muc: 1 },
]

export default function Page() {
  const chuaDat = DS.filter((r) => !r.co_han_muc)
  const quaTai = DS.filter((r) => r.co_han_muc && vuotSucChua(r.tong_cho, r.dang_dung))

  return (
    <div className="space-y-5">
      <PageHead
        title="Chỗ đỗ xe"
        sub="Hạn mức mỗi căn giữ công bằng; số chỗ trong hầm là giới hạn vật lý"
      />

      <Hop tone="canh" title={`${chuaDat.length} chỗ chưa đặt hạn mức`}>
        Những loại xe dưới đây đang có người đăng ký nhưng chưa có hạn mức, nên hệ
        thống <strong>nhận không giới hạn</strong>:{' '}
        {chuaDat.map((r) => `${r.toa} · ${nhanLoai(r.loai)}`).join(', ')}. Đặt số chỗ
        ở bảng bên dưới.
      </Hop>

      <Hop tone="xau" title="Đang nhận quá sức chứa">
        {quaTai.map((r) => `${r.toa} · ${nhanLoai(r.loai)} (${r.dang_dung}/${r.tong_cho})`).join(', ')}.
        Xảy ra khi số chỗ bị siết xuống dưới số xe đang dùng. Hệ thống không tự đuổi
        ai — cần ban quản lý làm việc với các hộ liên quan.
      </Hop>

      <Card>
        <CardHead title="Từng tòa, từng loại xe" />
        <div className="overflow-x-auto">
          <Bang>
            <thead>
              <Tr>
                <Th>Tòa</Th><Th>Loại</Th><Th>Hầm</Th><Th>Mỗi căn</Th>
                <Th>Đang dùng</Th><Th>Còn trống</Th><Th>Hàng chờ</Th><Th>Vượt hạn mức</Th>
              </Tr>
            </thead>
            <tbody>
              {DS.map((r) => (
                <Tr key={`${r.toa}:${r.loai}`}>
                  <Td>{r.toa}</Td>
                  <Td>{nhanLoai(r.loai)}</Td>
                  <Td className="num">
                    {r.co_han_muc ? r.tong_cho : <Pill tone="canh" cham={false}>chưa đặt</Pill>}
                  </Td>
                  <Td className="num">{r.co_han_muc ? r.moi_can : '—'}</Td>
                  <Td className="num">{r.dang_dung}</Td>
                  <Td className="num">{r.co_han_muc ? conTrong(r.tong_cho, r.dang_dung) : '—'}</Td>
                  <Td className="num">
                    {r.hang_cho > 0
                      ? <Pill tone="canh" cham={false}>{r.hang_cho}</Pill>
                      : <span className="text-faint">0</span>}
                  </Td>
                  <Td className="num">
                    {r.qua_han_muc > 0
                      ? <span className="text-muted">{r.qua_han_muc}</span>
                      : <span className="text-faint">0</span>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Bang>
        </div>
      </Card>

      <Hop tone="trung" title="Hai con số, hai việc khác nhau">
        <strong className="text-ink">Số chỗ trong hầm</strong> là giới hạn vật lý —
        đếm được bằng cách xuống hầm. <strong className="text-ink">Mỗi căn tối
        đa</strong> là giới hạn công bằng, để một hộ không ôm hết phần của cả tòa.
        <br /><br />
        Xe vượt hạn mức căn <em>không</em> nằm chung hàng chờ với xe đợi hầm trống:
        đợi mãi cũng không tới lượt, nên chúng chờ ban quản lý nới hạn mức chứ
        không chờ ai rút xe. Nới hạn mức thì hệ thống tự đưa chúng vào hàng, giữ
        nguyên thứ tự đã xếp.
      </Hop>

      <Hop tone="canh" title="Khác bản thật một chỗ">
        Bản demo không có nút “Gọi người tiếp theo” và không đặt được hạn mức —
        chúng ghi vào database. Trên bản thật, gọi người tiếp theo luôn lấy người
        đầu hàng theo <strong>giờ đăng ký</strong>, ban quản lý không chọn được ai
        lên trước.
      </Hop>
    </div>
  )
}
