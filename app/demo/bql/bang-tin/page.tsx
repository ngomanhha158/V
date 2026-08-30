import { BANG_TIN, SO_TAY } from '@/lib/demo/data'
import {
  Button, Card, CardHead, Field, Hop, Input, PageHead, Pill, Select, Stat, Textarea,
} from '@/components/ui'
import { IcGui } from '@/components/icons'

export const dynamic = 'force-dynamic'

const khiNao = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

export default function DemoBqlBangTin() {
  const daPhatHanh = BANG_TIN.filter((a) => a.published_at)
  const phamVi = (a: (typeof BANG_TIN)[number]) =>
    a.unit_id ? 'Căn P1-10.01'
      : a.floor_no != null ? `Tòa P1 · tầng ${a.floor_no}`
      : a.building_id ? 'Toàn tòa P1'
      : 'Toàn khu'

  return (
    <div className="space-y-5">
      <PageHead title="Bảng tin" sub="Sunrise Riverside · soạn và phát hành thông báo" />

      <div className="grid grid-cols-3 gap-3">
        <Stat nhan="Đã phát hành" so={daPhatHanh.length} />
        <Stat nhan="Bản nháp" so={1} tone="canh" />
        <Stat nhan="Mục nội quy" so={SO_TAY.length} phu="để trích dẫn" />
      </div>

      <Card>
        <CardHead title="Soạn thông báo mới" />
        <div className="space-y-4 p-4">
          <Field label="Tiêu đề">
            <Input placeholder="Ví dụ: Cắt nước bảo trì bể ngầm" disabled />
          </Field>
          <Field label="Nội dung" hint="Viết như nói với hàng xóm: việc gì, khi nào, ảnh hưởng ra sao.">
            <Textarea rows={5} placeholder="Từ 8h đến 11h ngày…" disabled />
          </Field>

          <fieldset className="space-y-3 rounded-ctl border border-line bg-raised p-3">
            <legend className="px-1 text-[0.8125rem] font-medium text-ink">Gửi cho ai</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tòa">
                <Select disabled defaultValue=""><option value="">Toàn khu</option></Select>
              </Field>
              <Field label="Tầng">
                <Select disabled defaultValue=""><option value="">Mọi tầng</option></Select>
              </Field>
              <Field label="Riêng một căn">
                <Select disabled defaultValue=""><option value="">Không</option></Select>
              </Field>
            </div>
            <p className="text-[0.8125rem] text-muted">
              Thông báo sẽ tới <b className="font-semibold text-ink">toàn khu</b>.
            </p>
          </fieldset>

          <Field label="Trích nội quy" hint="Gắn một mục trong sổ tay để cư dân bấm đọc luôn.">
            <Select disabled defaultValue="">
              <option value="">Không trích</option>
            </Select>
          </Field>

          <label className="flex items-start gap-2.5 rounded-ctl border border-line p-3">
            <input type="checkbox" disabled className="mt-0.5 size-4 shrink-0" />
            <span className="text-[0.8125rem]">
              <span className="font-medium text-ink">Đánh dấu khẩn</span>
              <span className="mt-0.5 block text-muted">
                Hiện đỏ lên đầu bảng tin. Dùng nhiều thì cư dân quen mắt và hết tác dụng.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button dang="chinh" disabled><IcGui width={15} height={15} /> Phát hành ngay</Button>
            <Button disabled>Lưu nháp</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Bản nháp" sub="Cư dân chưa thấy. Phát hành thì mới hiện trên bảng tin của họ." />
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">Lịch phun muỗi định kỳ tháng 9</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Pill tone="trung">Nháp</Pill>
              <span className="text-[0.75rem] text-faint">Toàn khu</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button co="sm" dang="chinh" disabled>Phát hành</Button>
            <Button co="sm" dang="nguy" disabled>Xóa</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Đã phát hành"
          right={<span className="text-[0.8125rem] text-faint">{daPhatHanh.length}</span>}
        />
        <ul className="divide-y divide-line">
          {daPhatHanh.map((a) => (
            <li key={a.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm font-medium text-ink">{a.title}</div>
                {a.is_urgent && <Pill tone="xau">Khẩn</Pill>}
              </div>
              <div className="mt-1 text-[0.75rem] text-faint">
                {phamVi(a)} · {a.published_at && khiNao(a.published_at)}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Hop tone="trung" title="Đã phát hành thì không sửa được">
        Thông báo tới tay cư dân rồi mà sửa lại là viết lại lịch sử — ai đọc bản
        cũ vẫn nhớ bản cũ. Sai thì đăng đính chính, để cả hai bản cùng tồn tại.
      </Hop>
    </div>
  )
}
