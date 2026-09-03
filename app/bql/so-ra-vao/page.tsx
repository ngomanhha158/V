import { createClient } from '@/lib/db/server'
import { Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, Trong, ngayGioVN } from '@/components/ui'
import { TONE_TRANG_THAI, khoangGio, loiSoGiay, nhanTrangThai } from '@/lib/khach'

/**
 * Sổ ra vào của khách. Đây là thứ thay cuốn sổ giấy ở chốt bảo vệ — nên câu đầu
 * tiên trên trang không phải danh sách, mà là câu trả lời cho "đã bỏ được sổ
 * giấy chưa". Người trực ban là người quyết định điều đó, và họ cần con số.
 */
export const dynamic = 'force-dynamic'

const NGAY = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
const hopLe = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tu?: string; den?: string }>
}) {
  const sp = await searchParams
  const den = hopLe(sp.den) ?? iso(new Date())
  const tu = hopLe(sp.tu) ?? iso(new Date(Date.now() - 6 * NGAY))

  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Sổ ra vào" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const [{ data: ds, error }, { data: tl }] = await Promise.all([
    db.rpc('so_ra_vao', { p_project: project.id, p_tu: tu, p_den: den }),
    db.rpc('ty_le_ho_dung_app', { p_project: project.id }),
  ])

  const rows = ds ?? []
  const t = tl?.[0]
  const nguong = loiSoGiay(Number(t?.ty_le ?? 0), t?.tong_can ?? 0, t?.can_co_nguoi ?? 0)
  // Chỉ đếm lượt CÒN TRONG GIỜ HẸN. Cộng cả lượt quên quét ra thì con số này
  // phình lên mãi và người trực ban thôi không nhìn nó nữa.
  const dangTrong = rows.filter((r) => r.trang_thai === 'trong_toa')
  const quenQuet = rows.filter((r) => r.trang_thai === 'quen_quet_ra')

  return (
    <div className="space-y-5">
      <PageHead
        title="Sổ ra vào"
        sub="Khách thăm — thay cuốn sổ giấy ở chốt. Sổ này không ghi lượt ra vào của cư dân."
      />

      {error && (
        <Hop tone="xau" title="Không đọc được sổ ra vào">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần khách thăm chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      <Hop tone={nguong.ok ? 'tot' : 'canh'} title={nguong.tieu}>{nguong.than}</Hop>

      {dangTrong.length > 0 && (
        <Hop tone="trung" title={`${dangTrong.length} khách đang trong tòa`}>
          {dangTrong.map((r) => `${r.ho_ten} (${r.can})`).join(', ')}.
        </Hop>
      )}

      {quenQuet.length > 0 && (
        <Hop tone="canh" title={`${quenQuet.length} lượt quá giờ mà chưa quét ra`}>
          {quenQuet.slice(0, 6).map((r) => `${r.ho_ten} (${r.can})`).join(', ')}
          {quenQuet.length > 6 && ` và ${quenQuet.length - 6} lượt nữa`}. Gần như
          chắc chắn là khách về rồi mà quên quét — hệ thống để trống giờ ra chứ
          không đoán. Chúng KHÔNG được tính vào số &ldquo;đang trong tòa&rdquo; ở trên.
        </Hop>
      )}

      <Card>
        <CardHead
          title={`${rows.length} lượt khách`}
          sub={`${tu.split('-').reverse().join('/')} → ${den.split('-').reverse().join('/')}`}
        />
        {rows.length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có lượt khách nào trong kỳ">
              Cư dân tạo mã ở màn <strong>Khách thăm</strong>, bảo vệ quét ở sảnh.
              Chưa có lượt nào nghĩa là chưa ai dùng — sổ giấy vẫn đang là sổ chính.
            </Trong>
          </div>
        ) : (
          <div className="scroll-x overflow-x-auto">
            <Bang>
              <thead>
                <Tr>
                  {/* Trên điện thoại chỉ còn HAI cột: khách (kèm căn, người
                      mời và trạng thái) và giờ vào–ra. Giữ đủ năm cột thì tên
                      khách bị bóp thành một chữ mỗi dòng và cột trạng thái
                      trôi hẳn ra ngoài mép màn. */}
                  <Th>Khách</Th>
                  <Th className="hidden sm:table-cell">Căn</Th>
                  <Th className="hidden sm:table-cell">Người mời</Th>
                  <Th>Vào — ra</Th>
                  <Th className="hidden text-right sm:table-cell">Trạng thái</Th>
                </Tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <div className="font-medium text-ink">{r.ho_ten}</div>
                      {r.dien_thoai && (
                        <a href={`tel:${r.dien_thoai}`} className="num text-[0.75rem] whitespace-nowrap text-brand">
                          {r.dien_thoai}
                        </a>
                      )}
                      <div className="num mt-0.5 text-[0.75rem] whitespace-nowrap text-faint sm:hidden">
                        {r.can} · {r.nguoi_moi ?? '—'}
                      </div>
                      <div className="mt-1 sm:hidden">
                        <Pill tone={TONE_TRANG_THAI[r.trang_thai] ?? 'trung'}>
                          {nhanTrangThai(r.trang_thai)}
                        </Pill>
                      </div>
                    </Td>
                    <Td className="num hidden whitespace-nowrap sm:table-cell">{r.can}</Td>
                    <Td className="hidden sm:table-cell">{r.nguoi_moi ?? '—'}</Td>
                    <Td className="num whitespace-nowrap text-muted">
                      {r.vao_luc ? ngayGioVN(r.vao_luc) : '—'}
                      <div className="text-[0.75rem] text-faint">
                        {r.ra_luc
                          ? ngayGioVN(r.ra_luc)
                          : r.vao_luc
                            ? 'chưa quét ra'
                            : `hẹn ${khoangGio(r.hieu_luc_tu, r.hieu_luc_den)}`}
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
        )}
      </Card>

      <Hop tone="trung" title="Sổ này giữ 90 ngày rồi xóa">
        Sổ ra vào là dữ liệu về người ngoài tới thăm ai, lúc nào. Giữ mãi thì nó
        thành một kho hồ sơ quan hệ của cư dân mà không ai xin phép để lập. 90
        ngày đủ cho mọi việc cuốn sổ giấy đang phục vụ, và cư dân được nói cho
        biết điều này ngay trên màn của họ.
      </Hop>
    </div>
  )
}
