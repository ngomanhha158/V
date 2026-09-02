import { createClient } from '@/lib/db/server'
import { Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, Trong } from '@/components/ui'
import { conTrong, nhanLoai, vuotSucChua } from '@/lib/xe'
import { FormHanMuc, NutGoi } from './form'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Chỗ đỗ xe" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const [{ data: toaDs }, { data: ds, error }] = await Promise.all([
    db.from('buildings').select('id, name').eq('project_id', project.id).order('code'),
    db.rpc('bai_xe_tong_quan', { p_project: project.id }),
  ])

  const chuaDat = (ds ?? []).filter((r) => !r.co_han_muc)
  const quaTai = (ds ?? []).filter((r) => r.co_han_muc && vuotSucChua(r.tong_cho, r.dang_dung))

  return (
    <div className="space-y-5">
      <PageHead
        title="Chỗ đỗ xe"
        sub="Hạn mức mỗi căn giữ công bằng; số chỗ trong hầm là giới hạn vật lý"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được bãi xe">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần chỗ đỗ xe chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      {/* Tòa quên đặt hạn mức là chỗ hỏng LẶNG LẼ nhất của tính năng này: hệ
          thống vẫn nhận xe, không báo gì, cho tới lúc hầm đầy thật rồi mới vỡ.
          Nên nó phải nằm trên cùng, không nằm lẫn trong bảng. */}
      {chuaDat.length > 0 && (
        <Hop tone="canh" title={`${chuaDat.length} chỗ chưa đặt hạn mức`}>
          Những loại xe dưới đây đang có người đăng ký nhưng chưa có hạn mức, nên
          hệ thống <strong>nhận không giới hạn</strong>:{' '}
          {chuaDat.map((r) => `${r.toa} · ${nhanLoai(r.loai)}`).join(', ')}. Đặt số
          chỗ ở bảng bên dưới.
        </Hop>
      )}

      {quaTai.length > 0 && (
        <Hop tone="xau" title="Đang nhận quá sức chứa">
          {quaTai.map((r) => `${r.toa} · ${nhanLoai(r.loai)} (${r.dang_dung}/${r.tong_cho})`).join(', ')}.
          Xảy ra khi số chỗ bị siết xuống dưới số xe đang dùng. Hệ thống không tự
          đuổi ai — cần ban quản lý làm việc với các hộ liên quan.
        </Hop>
      )}

      <Card>
        <CardHead title="Từng tòa, từng loại xe" />
        {(ds ?? []).length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có gì để hiện">
              Chưa tòa nào đặt hạn mức và chưa ai đăng ký xe.
            </Trong>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Bang>
              <thead>
                <Tr>
                  <Th>Tòa</Th><Th>Loại</Th><Th>Hầm</Th><Th>Mỗi căn</Th>
                  <Th>Đang dùng</Th><Th>Còn trống</Th><Th>Hàng chờ</Th><Th>Vượt hạn mức</Th><Th></Th>
                </Tr>
              </thead>
              <tbody>
                {(ds ?? []).map((r) => (
                  <Tr key={`${r.building_id}:${r.loai}`}>
                    <Td>{r.toa}</Td>
                    <Td>{nhanLoai(r.loai)}</Td>
                    <Td className="num">
                      {r.co_han_muc ? r.tong_cho
                        : <Pill tone="canh" cham={false}>chưa đặt</Pill>}
                    </Td>
                    <Td className="num">{r.co_han_muc ? r.moi_can : '—'}</Td>
                    <Td className="num">{r.dang_dung}</Td>
                    <Td className="num">
                      {r.co_han_muc ? conTrong(r.tong_cho, r.dang_dung) : '—'}
                    </Td>
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
                    <Td>
                      {r.co_han_muc && r.hang_cho > 0 && (
                        conTrong(r.tong_cho, r.dang_dung) > 0
                          ? <NutGoi toa={r.building_id} loai={r.loai} />
                          // Có người xếp hàng mà không có nút bấm là chỗ dễ bị
                          // hiểu thành hỏng. Nói ra vì sao, đừng để trống.
                          : <span className="text-[0.75rem] text-faint">
                              Hầm chưa còn chỗ — có xe rút ra thì mới gọi được
                            </span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Bang>
          </div>
        )}
      </Card>

      <Card>
        <CardHead
          title="Đặt hạn mức"
          sub="Đặt lại cho một cặp tòa + loại xe đã có cũng dùng chính ô này"
        />
        <div className="p-4">
          <FormHanMuc toaDs={toaDs ?? []} />
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
    </div>
  )
}
