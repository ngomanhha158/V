import { createClient } from '@/lib/db/server'
import { requestJoin } from './actions'
import { Button, Card, Field, Hop, PageHead, Select } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function Onboarding() {
  const db = await createClient()
  const { data: units } = await db
    .from('units')
    .select('id, code, floor_no, buildings(name)')
    .order('code')

  return (
    <div className="space-y-5">
      <PageHead
        title="Xin gia nhập căn hộ"
        sub="Yêu cầu gửi tới chủ hộ. Được duyệt thì bạn mới thấy dữ liệu căn hộ."
      />

      <Card>
        <form action={requestJoin} className="space-y-4 p-4">
          <Field label="Căn hộ" hint="Tìm theo mã căn ghi trên cửa hoặc hợp đồng">
            <Select name="unit_id" required defaultValue="">
              <option value="" disabled>— Chọn căn hộ —</option>
              {units?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} · {u.buildings?.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Vai trò của bạn"
            hint="Người thuê và người được ủy quyền sẽ được chủ hộ đặt ngày hết hạn."
          >
            <Select name="role" required defaultValue="">
              <option value="" disabled>— Chọn vai trò —</option>
              <option value="owner">Chủ sở hữu</option>
              <option value="tenant">Người thuê</option>
              <option value="family">Thành viên gia đình</option>
              <option value="authorized">Người được ủy quyền</option>
            </Select>
          </Field>

          <Hop tone="trung">
            Yêu cầu tạo ra ở trạng thái <b>chờ duyệt</b> và chưa có quyền gì. Bạn
            không tự cấp quyền cho mình được — chủ hộ hoặc BQL phải duyệt.
          </Hop>

          <Button type="submit" dang="chinh" className="w-full">Gửi yêu cầu</Button>
        </form>
      </Card>
    </div>
  )
}
