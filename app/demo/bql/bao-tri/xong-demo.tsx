'use client'

import { useState } from 'react'
import { Button, Field, Hop, Input } from '@/components/ui'
import { hanKeTiep } from '@/lib/bao-tri'
import { ngayVN } from '@/lib/ngay'

// Không import actions.ts — bản demo không ghi vào maintenance_runs thật. Nhưng
// hanKeTiep dùng chung với màn thật: hạn kế tiếp mà lệch nhau giữa hai màn thì
// bản demo đang dạy sai đúng cái quy tắc quan trọng nhất của tính năng này.

export function XongDemo({ ten, chuKy }: { ten: string; chuKy: number }) {
  const [mo, setMo] = useState(false)
  const [xong, setXong] = useState(false)
  const han = hanKeTiep(chuKy)

  if (xong) {
    return (
      <Hop tone="tot" title="Xong">
        Đã đóng &ldquo;{ten}&rdquo;. Hạn kế tiếp: {ngayVN(han)} — tính từ hôm nay cộng chu kỳ,
        vì giấy kiểm định có hiệu lực từ ngày kiểm chứ không từ ngày lẽ ra phải kiểm.
        <br /><br />
        <span className="text-muted">(Bản demo không lưu gì.)</span>
      </Hop>
    )
  }

  if (!mo) {
    return (
      <div className="flex items-center gap-2">
        <Button co="sm" dang="chinh" onClick={() => setMo(true)}>Đánh dấu đã làm</Button>
        <span className="text-[0.75rem] text-faint">Hạn kế tiếp sẽ là {ngayVN(han)}</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Field label="Kết quả" hint="Ghi lại để lần sau đọc lại được — không bắt buộc">
        <Input placeholder="Đạt, không có khuyến nghị" />
      </Field>
      <div className="flex gap-2">
        <Button co="sm" dang="chinh" onClick={() => setXong(true)}>Xác nhận đã làm</Button>
        <Button co="sm" dang="nhat" onClick={() => setMo(false)}>Hủy</Button>
      </div>
    </div>
  )
}
