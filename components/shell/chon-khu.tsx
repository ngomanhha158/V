'use client'

import { useState } from 'react'
import { cx } from '@/components/ui'
import { IcToaNha } from '@/components/icons'
import { nenHienHopChon, soLieuKhu, type Khu } from '@/lib/khu'
import { tenVaiTro } from '@/lib/vai-tro'

/**
 * Chọn khu đang quản lý.
 *
 * Chỉ hiện khi người này quản lý TỪ HAI KHU TRỞ LÊN. Một hộp chọn có đúng một
 * lựa chọn là một câu hỏi không có câu trả lời nào khác — nó chỉ chiếm chỗ và
 * làm người dùng tưởng mình đang thiếu quyền ở đâu đó.
 */
export function ChonKhu({
  dang, ds, chon,
}: { dang: Khu | null; ds: Khu[]; chon: (formData: FormData) => void }) {
  const [mo, setMo] = useState(false)
  if (!dang || !nenHienHopChon(ds)) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        className="flex w-full items-center gap-2 rounded-ctl border border-line-firm bg-surface px-2.5 py-1.5 text-left transition-colors hover:bg-sunken"
      >
        <IcToaNha className="size-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] leading-tight font-medium text-ink">
            {dang.name}
          </span>
          <span className="num block truncate text-[0.6875rem] leading-tight text-faint">
            {dang.so_can} căn · {ds.length} khu
          </span>
        </span>
        <span className="shrink-0 text-[0.625rem] text-faint">▼</span>
      </button>

      {mo && (
        <form
          action={chon}
          className="absolute z-40 mt-1 w-full min-w-[15rem] rounded-card border border-line bg-surface p-1 shadow-card"
        >
          {ds.map((k) => (
            <button
              key={k.id}
              type="submit"
              name="khu"
              value={k.id}
              className={cx(
                'block w-full rounded-ctl px-2.5 py-2 text-left transition-colors hover:bg-sunken',
                k.id === dang.id && 'bg-brand-soft',
              )}
            >
              <span className="block text-[0.8125rem] font-medium text-ink">
                {k.name}
                {k.id === dang.id && <span className="text-brand"> · đang xem</span>}
              </span>
              <span className="num block text-[0.6875rem] text-faint">
                {soLieuKhu(k)}
                {k.vai_tro && ` · ${tenVaiTro(k.vai_tro)}`}
              </span>
            </button>
          ))}
          <p className="px-2.5 py-2 text-[0.6875rem] leading-relaxed text-faint">
            Quyền tính riêng từng khu — nhân sự khu này không đọc được dữ liệu khu kia,
            và chốt đó nằm ở database chứ không ở màn hình.
          </p>
        </form>
      )}
    </div>
  )
}
