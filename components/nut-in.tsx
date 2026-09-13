'use client'

import { Button } from '@/components/ui'

/**
 * Hộp thoại in của trình duyệt: chỗ duy nhất có sẵn "Lưu thành PDF" trên mọi
 * máy, kể cả điện thoại.
 *
 * Dùng chung cho phiếu thu và hóa đơn. Hai bản chép tay thì một ngày nào đó
 * một bên sửa chữ trên nút, và cư dân đọc hai câu khác nhau cho cùng một việc.
 */
export function NutIn() {
  return (
    <Button type="button" onClick={() => window.print()}>
      In / Lưu PDF
    </Button>
  )
}
