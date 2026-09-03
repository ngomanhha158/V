import { Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, ngayGioVN } from '@/components/ui'
import { TONE_TRANG_THAI, khoangGio, loiSoGiay, nhanTrangThai } from '@/lib/khach'

// Dùng chung loiSoGiay / khoangGio với màn thật: câu quyết định "đã bỏ được sổ
// giấy chưa" mà bản demo nói khác bản thật thì demo đang dạy sai đúng thứ quan
// trọng nhất trên trang này.
//
// Bộ số cố ý ở DƯỚI ngưỡng 50% — đó là trạng thái của một tòa vừa triển khai,
// và là trạng thái người trực ban sẽ thấy trong vài tháng đầu.
const DS = [
  { id: '1', ho_ten: 'Nguyễn Thị Lan', dien_thoai: '0912 004 455', can: 'P1-12.04', toa: 'Park 1',
    nguoi_moi: 'Trần Thị Bích Ngọc', hieu_luc_tu: '2026-09-03T07:00:00Z', hieu_luc_den: '2026-09-03T11:00:00Z',
    vao_luc: '2026-09-03T07:12:00Z', ra_luc: null, trang_thai: 'trong_toa' },
  { id: '2', ho_ten: 'Đội lắp điều hòa Sài Gòn', dien_thoai: '0903 118 220', can: 'P1-08.02', toa: 'Park 1',
    nguoi_moi: 'Nguyễn Văn Hải', hieu_luc_tu: '2026-09-03T01:00:00Z', hieu_luc_den: '2026-09-03T10:00:00Z',
    vao_luc: '2026-09-03T01:40:00Z', ra_luc: '2026-09-03T06:05:00Z', trang_thai: 'da_ra' },
  { id: '3', ho_ten: 'Phạm Minh Tuấn', dien_thoai: null, can: 'P2-03.07', toa: 'Park 2',
    nguoi_moi: 'Phạm Quốc Cường', hieu_luc_tu: '2026-09-02T09:00:00Z', hieu_luc_den: '2026-09-02T13:00:00Z',
    vao_luc: '2026-09-02T09:22:00Z', ra_luc: null, trang_thai: 'quen_quet_ra' },
  { id: '4', ho_ten: 'Khách giao hàng Tiki', dien_thoai: null, can: 'P1-15.11', toa: 'Park 1',
    nguoi_moi: 'Lê Thị Hồng Vân', hieu_luc_tu: '2026-09-04T02:00:00Z', hieu_luc_den: '2026-09-04T05:00:00Z',
    vao_luc: null, ra_luc: null, trang_thai: 'chua_toi_gio' },
]

export default function Page() {
  const nguong = loiSoGiay(38.5, 468, 180)
  const dangTrong = DS.filter((r) => r.trang_thai === 'trong_toa')
  const quenQuet = DS.filter((r) => r.trang_thai === 'quen_quet_ra')

  return (
    <div className="space-y-5">
      <PageHead
        title="Sổ ra vào"
        sub="Khách thăm — thay cuốn sổ giấy ở chốt. Sổ này không ghi lượt ra vào của cư dân."
      />

      <Hop tone={nguong.ok ? 'tot' : 'canh'} title={nguong.tieu}>{nguong.than}</Hop>

      <Hop tone="trung" title={`${dangTrong.length} khách đang trong tòa`}>
        {dangTrong.map((r) => `${r.ho_ten} (${r.can})`).join(', ')}.
      </Hop>

      <Hop tone="canh" title={`${quenQuet.length} lượt quá giờ mà chưa quét ra`}>
        {quenQuet.map((r) => `${r.ho_ten} (${r.can})`).join(', ')}. Gần như chắc
        chắn là khách về rồi mà quên quét — hệ thống để trống giờ ra chứ không
        đoán. Chúng KHÔNG được tính vào số &ldquo;đang trong tòa&rdquo; ở trên.
      </Hop>

      <Card>
        <CardHead title={`${DS.length} lượt khách`} sub="28/08/2026 → 03/09/2026" />
        <div className="scroll-x overflow-x-auto">
          <Bang>
            <thead>
              <Tr>
                {/* Trên điện thoại chỉ còn HAI cột: khách (kèm căn, người mời
                    và trạng thái) và giờ vào–ra. */}
                <Th>Khách</Th>
                <Th className="hidden sm:table-cell">Căn</Th>
                <Th className="hidden sm:table-cell">Người mời</Th>
                <Th>Vào — ra</Th>
                <Th className="hidden text-right sm:table-cell">Trạng thái</Th>
              </Tr>
            </thead>
            <tbody>
              {DS.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <div className="font-medium text-ink">{r.ho_ten}</div>
                    {r.dien_thoai && <span className="num text-[0.75rem] whitespace-nowrap text-brand">{r.dien_thoai}</span>}
                    <div className="num mt-0.5 text-[0.75rem] whitespace-nowrap text-faint sm:hidden">
                      {r.can} · {r.nguoi_moi}
                    </div>
                    <div className="mt-1 sm:hidden">
                      <Pill tone={TONE_TRANG_THAI[r.trang_thai] ?? 'trung'}>
                        {nhanTrangThai(r.trang_thai)}
                      </Pill>
                    </div>
                  </Td>
                  <Td className="num hidden whitespace-nowrap sm:table-cell">{r.can}</Td>
                  <Td className="hidden sm:table-cell">{r.nguoi_moi}</Td>
                  <Td className="num whitespace-nowrap text-muted">
                    {r.vao_luc ? ngayGioVN(r.vao_luc) : '—'}
                    <div className="text-[0.75rem] text-faint">
                      {r.ra_luc
                        ? ngayGioVN(r.ra_luc)
                        : r.vao_luc
                          ? 'chưa quét ra'
                          : `hẹn ${khoangGio(r.hieu_luc_tu, r.hieu_luc_den, new Date('2026-09-03T09:00:00Z'))}`}
                    </div>
                  </Td>
                  <Td className="hidden text-right sm:table-cell">
                    <Pill tone={TONE_TRANG_THAI[r.trang_thai] ?? 'trung'}>
                      {nhanTrangThai(r.trang_thai)}
                    </Pill>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Bang>
        </div>
      </Card>

      <Hop tone="trung" title="Sổ này giữ 90 ngày rồi xóa">
        Sổ ra vào là dữ liệu về người ngoài tới thăm ai, lúc nào. Giữ mãi thì nó
        thành một kho hồ sơ quan hệ của cư dân mà không ai xin phép để lập.
      </Hop>
    </div>
  )
}
