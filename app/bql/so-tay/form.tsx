'use client'
import { useActionState } from 'react'
import { luuMuc, type SoTayState } from './actions'
import { Button, Field, Hop, Input, Textarea } from '@/components/ui'
import { IcThem } from '@/components/icons'

export function SoanMuc({ mucGoiY }: { mucGoiY: string[] }) {
  const [state, action, busy] = useActionState(luuMuc, {} as SoTayState)

  return (
    <form action={action} className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <Field label="Mục" hint="Gom theo chủ đề để cư dân duyệt nhanh.">
          {/* list= vừa gợi ý mục đã có vừa cho gõ mục mới — không khóa cứng
              danh sách vì mỗi khu có quy định riêng. */}
          <Input name="section" required list="muc-goi-y" placeholder="Thú cưng" />
          <datalist id="muc-goi-y">
            {mucGoiY.map((m) => <option key={m} value={m} />)}
          </datalist>
        </Field>
        <Field label="Tiêu đề">
          <Input name="title" required placeholder="Quy định nuôi thú cưng trong căn hộ" />
        </Field>
      </div>

      <Field
        label="Nội dung"
        hint="Viết rõ và ngắn. Đây là thứ cư dân sẽ trích ra khi tranh cãi với hàng xóm."
      >
        <Textarea name="body" rows={7} required />
      </Field>

      {state.error && <Hop tone="xau" title="Không lưu được">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}

      <Button type="submit" dang="chinh" disabled={busy}>
        <IcThem width={15} height={15} />
        {busy ? 'Đang lưu…' : 'Thêm vào sổ tay'}
      </Button>
    </form>
  )
}
