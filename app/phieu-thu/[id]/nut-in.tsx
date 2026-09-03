'use client'

import { Button } from '@/components/ui'

/** Hộp thoại in của trình duyệt: chỗ duy nhất có sẵn "Lưu thành PDF" trên mọi
 *  máy, kể cả điện thoại. */
export function NutIn() {
  return (
    <Button type="button" onClick={() => window.print()}>
      In / Lưu PDF
    </Button>
  )
}
