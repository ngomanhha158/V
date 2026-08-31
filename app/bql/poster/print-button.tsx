'use client'
import { Button } from '@/components/ui'

/** Một nút, một dòng. Tách file client vì Server Component không gắn onClick. */
export function PrintButton() {
  return (
    <Button dang="chinh" onClick={() => window.print()}>In poster</Button>
  )
}
