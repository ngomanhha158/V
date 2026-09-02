import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { theoHan, tinhTrangHan } from '@/lib/bao-tri'
import {
  Card, CardHead, Hop, ngayVN, PageHead, Pill, Stat, Trong,
} from '@/components/ui'
import { FormThem, FormXong, HangKeHoach, type KeHoach } from './form'

export const dynamic = 'force-dynamic'

export default async function BaoTri() {
  const db = await createClient()

  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào trong hệ thống" />
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const [keHoach, dangMo, toaNha] = await Promise.all([
    db.from('maintenance_plans')
      .select('id, ten, hang_muc, chu_ky_ngay, han_ke_tiep, nhac_truoc_ngay, bat_buoc_phap_ly, nha_thau, building_id, is_active')
      .eq('project_id', project.id),
    db.from('maintenance_runs')
      .select('id, han, mo_luc, maintenance_plans!inner(id, ten, chu_ky_ngay, project_id, bat_buoc_phap_ly, nhac_truoc_ngay)')
      .is('lam_luc', null)
      .eq('maintenance_plans.project_id', project.id)
      .order('han'),
    db.from('buildings').select('id, code, name').eq('project_id', project.id).order('code'),
  ])

  if (keHoach.error) {
    return (
      <div className="space-y-5">
        <PageHead title="Bảo trì định kỳ" />
        <Hop tone="xau" title="Không đọc được lịch bảo trì">
          {keHoach.error.code === '42P01'
            ? 'Bảng maintenance_plans chưa có trên database. Chạy lại schema.sql rồi mở lại trang này.'
            : keHoach.error.code === '42501'
              ? 'Chưa mở quyền đọc lịch bảo trì. Chạy lại auth_hooks.sql (phần grant).'
              : keHoach.error.message}
        </Hop>
      </div>
    )
  }

  const ds = ((keHoach.data ?? []) as KeHoach[]).sort(theoHan)
  const bat = ds.filter((k) => k.is_active)
  const viec = dangMo.data ?? []
  const toa = toaNha.data ?? []

  const quaHan = bat.filter((k) => tinhTrangHan(k.han_ke_tiep, k.nhac_truoc_ngay, k.bat_buoc_phap_ly).muc === 'qua_han')
  const theoLuat = bat.filter((k) => k.bat_buoc_phap_ly)
  const luatQuaHan = quaHan.filter((k) => k.bat_buoc_phap_ly)

  return (
    <div className="space-y-5">
      <PageHead
        title="Bảo trì định kỳ"
        sub={`${project.name} · ${bat.length} hạng mục đang theo dõi`}
        actions={quaHan.length
          ? <Pill tone="xau">{quaHan.length} hạng mục quá hạn</Pill>
          : <Pill tone="tot">Không có hạng mục nào quá hạn</Pill>}
      />

      {luatQuaHan.length > 0 && (
        <Hop tone="xau" title={`${luatQuaHan.length} hạng mục BẮT BUỘC THEO LUẬT đang quá hạn`}>
          {luatQuaHan.map((k) => k.ten).join(' · ')}.
          <br /><br />
          Quá hạn kiểm định không chỉ là chậm việc: bị phạt là chuyện nhẹ hơn, chuyện nặng
          là thang máy hay hệ PCCC chạy ngoài hạn kiểm định khi có sự cố.
        </Hop>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat nhan="Đang theo dõi" so={bat.length} />
        <Stat nhan="Bắt buộc theo luật" so={theoLuat.length} tone={theoLuat.length ? 'brand' : 'trung'} />
        <Stat nhan="Quá hạn" so={quaHan.length} tone={quaHan.length ? 'xau' : 'tot'} />
        <Stat nhan="Việc đang mở" so={viec.length} phu="chờ đánh dấu đã làm" />
      </div>

      <Hop tone="trung" title="Việc tự mở, nhưng không tự đóng">
        Mỗi đêm hệ thống mở một lần bảo trì cho hạng mục đã tới cửa sổ nhắc. Đóng là việc
        của người làm — và lúc đóng, <strong>hạn kế tiếp tính từ ngày làm thật</strong> cộng
        chu kỳ, không phải từ hạn cũ. Giấy kiểm định có hiệu lực từ ngày kiểm chứ không từ
        ngày lẽ ra phải kiểm.
      </Hop>

      <Card>
        <CardHead
          title="Việc đang mở"
          sub="Đã tới cửa sổ nhắc, chưa ai đánh dấu làm xong"
          right={<span className="text-[0.8125rem] text-faint">{viec.length}</span>}
        />
        {viec.length === 0 ? (
          <div className="p-4">
            <Trong title="Không có việc nào đang mở">
              {bat.length === 0
                ? 'Chưa có hạng mục nào được theo dõi. Thêm ở khối bên dưới.'
                : 'Mọi hạng mục còn ngoài cửa sổ nhắc.'}
            </Trong>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {viec.map((v) => {
              const kh = Array.isArray(v.maintenance_plans) ? v.maintenance_plans[0] : v.maintenance_plans
              if (!kh) return null
              const t = tinhTrangHan(v.han, kh.nhac_truoc_ngay, kh.bat_buoc_phap_ly)
              return (
                <li key={v.id} className="space-y-3 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{kh.ten}</span>
                        {kh.bat_buoc_phap_ly && <Pill tone="brand" cham={false}>Theo luật</Pill>}
                      </div>
                      <div className="mt-0.5 text-[0.8125rem] text-muted">
                        Hạn {ngayVN(v.han)}
                      </div>
                    </div>
                    <Pill tone={t.tone}>{t.nhan}</Pill>
                  </div>
                  <FormXong id={v.id} ten={kh.ten} chuKy={kh.chu_ky_ngay} />
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHead
          title="Thêm hạng mục"
          sub="Thang máy, PCCC, bơm nước — những thứ có hạn kiểm định theo luật nên vào đây trước"
        />
        <FormThem toa={toa} />
      </Card>

      <Card>
        <CardHead
          title="Lịch bảo trì"
          right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>}
        />
        {ds.length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có hạng mục nào">
              Bắt đầu từ những thứ có hạn theo luật: kiểm định thang máy, bảo trì hệ PCCC,
              kiểm tra máy phát. Quên hạn ở đây là bị phạt, không chỉ là chậm việc.
            </Trong>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {ds.map((kh) => <HangKeHoach key={kh.id} kh={kh} toa={toa} />)}
          </ul>
        )}
      </Card>

      <p className="text-[0.75rem] leading-relaxed text-faint">
        Hạng mục <strong>bắt buộc theo luật</strong> không bao giờ xuống màu xanh dù hạn còn
        xa, để nó không trôi lẫn vào đống việc thường ngày. Cờ đó bật tắt được cho từng hạng
        mục — luật mỗi loại công trình mỗi khác, nên hệ thống gợi ý chứ không quyết thay.
      </p>
    </div>
  )
}
