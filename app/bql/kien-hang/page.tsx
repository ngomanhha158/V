import { createClient } from '@/lib/db/server'
import { Bang, Card, CardHead, Hop, LinkButton, PageHead, Td, Th, Tr, Trong, ngayGioVN } from '@/components/ui'
import { loiTuoiKien, nhanLoaiHoa } from '@/lib/kien-hang'
import { FormNhan, NutHuy } from './form'

/**
 * Quầy lễ tân. Danh sách ĐANG GIỮ đứng trên form nhận: người trực mở màn này
 * chủ yếu để trả hàng, không phải để nhập hàng — nhập là việc lúc shipper tới,
 * còn trả là việc cả ngày.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Nhận hàng hộ" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const [{ data: ds, error }, { data: canDs }] = await Promise.all([
    db.rpc('kien_dang_giu', { p_project: project.id }),
    db.from('units').select('id, code').order('code').limit(2000),
  ])

  const rows = ds ?? []
  const gap = rows.filter((r) => loiTuoiKien(r.so_ngay, r.loai).gap)

  return (
    <div className="space-y-5">
      <PageHead
        title="Nhận hàng hộ"
        sub="Quầy giữ hộ thì phải ghi được đã trao cho ai — trao bằng cách quét thẻ cư dân"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách kiện hàng">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần nhận hàng hộ chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      {gap.length > 0 && (
        <Hop tone="xau" title={`${gap.length} kiện cần xử lý gấp`}>
          {gap.slice(0, 6).map((r) => `${r.can} (${nhanLoaiHoa(r.loai).toLowerCase()}, ${r.so_ngay} ngày)`).join(', ')}
          {gap.length > 6 && ` và ${gap.length - 6} kiện nữa`}. Hệ thống đã nhắc cư dân
          mỗi ngày; quá lâu thì gọi điện, vì quầy không phải kho.
        </Hop>
      )}

      <Card>
        <CardHead
          title={`Đang giữ ${rows.length} kiện`}
          sub="Trao hàng: bấm Trao rồi quét thẻ cư dân bằng app camera"
        />
        {rows.length === 0 ? (
          <div className="p-4">
            <Trong title="Quầy đang trống">
              Chưa giữ hộ kiện nào. Shipper tới thì ghi nhận ở khối bên dưới —
              cư dân nhận thông báo ngay lúc bạn bấm.
            </Trong>
          </div>
        ) : (
          <div className="scroll-x overflow-x-auto">
            <Bang>
              <thead>
                <Tr>
                  {/* Trên điện thoại gộp còn HAI cột: khối kiện (căn, loại, chi
                      tiết, giờ, tuổi) và cột thao tác. Giữ đủ bốn cột thì thứ
                      trôi ra ngoài mép màn lại chính là NÚT TRAO — việc mà
                      người trực mở màn này để làm. */}
                  <Th className="hidden sm:table-cell">Căn</Th>
                  <Th>Kiện</Th>
                  <Th className="hidden sm:table-cell">Nhận lúc</Th>
                  <Th />
                </Tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const t = loiTuoiKien(r.so_ngay, r.loai)
                  return (
                    <Tr key={r.id}>
                      <Td className="num hidden font-medium whitespace-nowrap sm:table-cell">{r.can}</Td>
                      <Td>
                        <div className="num text-[0.75rem] text-faint sm:hidden">{r.can}</div>
                        <div className="num text-[0.75rem] text-faint sm:hidden">{r.can}</div>
                      <div className="font-medium text-ink">{nhanLoaiHoa(r.loai)}</div>
                        <div className="text-[0.75rem] text-faint">
                          {[r.nha_van_chuyen, r.ma_van_don, r.vi_tri].filter(Boolean).join(' · ') || '—'}
                        </div>
                        <div className={t.gap ? 'mt-0.5 text-[0.75rem] text-bad sm:hidden' : 'mt-0.5 text-[0.75rem] text-faint sm:hidden'}>
                          {ngayGioVN(r.nhan_luc)} · {t.loi}
                        </div>
                      </Td>
                      <Td className="num hidden whitespace-nowrap text-muted sm:table-cell">
                        {ngayGioVN(r.nhan_luc)}
                        <div className={t.gap ? 'text-[0.75rem] text-bad' : 'text-[0.75rem] text-faint'}>
                          {t.loi}
                        </div>
                      </Td>
                      <Td className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {/* Trao KHÔNG phải một nút bấm thẳng: phải quét thẻ
                              trước, vì cả tính năng dựng lên để ghi được đã
                              trao cho ai. Nhưng một cái nhãn chết nằm cạnh nút
                              Hủy thật thì người trực sẽ bấm vào — nên nó dẫn
                              tới hướng dẫn quét, chứ không đứng im. */}
                          <LinkButton href="/quet" co="sm" className="whitespace-nowrap">Quét thẻ để trao</LinkButton>
                          <NutHuy id={r.id} can={r.can} />
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Bang>
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="Shipper vừa tới" sub="Ghi nhận xong là cư dân có thông báo ngay" />
        <div className="p-4">
          <FormNhan canDs={(canDs ?? []).map((c) => ({ id: c.id, ma: c.code }))} />
        </div>
      </Card>

      <Hop tone="trung" title="Trao hàng bằng cách quét thẻ, không ký sổ">
        Mở app camera quét thẻ cư dân của người tới lấy. Màn quét sẽ hiện những
        kiện đang giữ cho căn đó và cho bấm trao — hệ thống ghi lại đúng con
        người đó, không phải một chữ ký nguệch ngoạc. Thẻ của căn khác không lấy
        được hàng căn này.
      </Hop>

      <Hop tone="canh" title="Chưa làm: ảnh kiện hàng">
        Đường tải ảnh hiện có phân quyền theo <em>&ldquo;căn này có phải của bạn
        không&rdquo;</em> — câu hỏi sai cho một bảo vệ đang chụp kiện hàng của
        người khác. Tổng quát hóa nó là một việc riêng, làm sau.
      </Hop>
    </div>
  )
}
