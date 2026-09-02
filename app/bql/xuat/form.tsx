'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Bang, Card, CardHead, Pill, Td, Th, Tr } from '@/components/ui'
import type { BaoCao } from '@/lib/xuat/bao-cao'

/** Đổi kỳ là đổi URL, để chia sẻ link hay bấm quay lại đều ra đúng kỳ đó. */
export function ChonKy({ ky }: { ky: string }) {
  const router = useRouter()
  const [v, setV] = useState(ky)
  return (
    <div className="flex flex-wrap items-end gap-3 p-4">
      <label className="block w-48">
        <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Kỳ báo cáo</span>
        <input
          type="month" value={v}
          onChange={(e) => { setV(e.target.value); if (e.target.value) router.push(`/bql/xuat?ky=${e.target.value}`) }}
          className="num h-10 w-full rounded-ctl border border-line-firm bg-surface px-3 text-sm text-ink focus:border-brand"
        />
      </label>
      <p className="pb-2.5 text-[0.75rem] text-faint">
        Kỳ cắt theo <strong className="text-muted">giờ Việt Nam</strong>, không phải giờ UTC —
        tiền về rạng sáng mùng 1 vẫn thuộc tháng đó.
      </p>
    </div>
  )
}

export function TheBaoCao({
  bc, ky, soDong,
}: { bc: BaoCao; ky: string; soDong: number | null }) {
  const [moCot, setMoCot] = useState(false)
  const href = `/api/xuat/${bc.id}${bc.theoKy ? `?ky=${ky}` : ''}`
  const rong = soDong === 0

  return (
    <Card>
      <CardHead
        title={bc.ten}
        sub={bc.theoKy ? `Kỳ ${ky}` : 'Ảnh chụp tại thời điểm bấm tải'}
        right={soDong === null
          ? undefined
          : <Pill tone={rong ? 'canh' : 'trung'} cham={false}>{soDong} dòng</Pill>}
      />
      <div className="space-y-3 p-4">
        <p className="text-[0.8125rem] leading-relaxed text-muted">{bc.moTa}</p>

        {rong && (
          <p className="text-[0.75rem] leading-relaxed text-warn">
            Kỳ này chưa có dòng nào. File vẫn tải được và vẫn mở được — sheet Tổng hợp sẽ
            ghi <strong>0 dòng</strong>, để phân biệt &ldquo;chưa có số liệu&rdquo; với
            &ldquo;hệ thống hỏng&rdquo;.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Thẻ <a> thường, không phải fetch: để trình duyệt tự lo phần tải file
              và hộp thoại lưu, thay vì dựng blob trong bộ nhớ rồi tự bấm hộ. */}
          <a
            href={href} download
            className="inline-flex h-10 items-center gap-2 rounded-ctl border border-transparent bg-brand px-3.5 text-sm font-medium text-on-brand hover:bg-brand-deep"
          >
            Tải .xlsx
          </a>
          <button
            type="button" onClick={() => setMoCot((m) => !m)}
            className="h-10 rounded-ctl px-2.5 text-[0.8125rem] font-medium text-muted hover:text-ink"
            aria-expanded={moCot}
          >
            {moCot ? 'Ẩn cột' : `Xem ${bc.cot.length} cột`}
          </button>
        </div>

        {moCot && (
          <Bang className="text-[0.8125rem]">
            <thead>
              <tr><Th>Cột</Th><Th>Kiểu ô</Th></tr>
            </thead>
            <tbody>
              {bc.cot.map((c) => (
                <Tr key={c.khoa}>
                  <Td className="text-ink">{c.nhan}</Td>
                  <Td className="text-muted">{TEN_KIEU[c.kieu]}</Td>
                </Tr>
              ))}
            </tbody>
          </Bang>
        )}
      </div>
    </Card>
  )
}

export const TEN_KIEU: Record<string, string> = {
  chu: 'Chữ',
  tien: 'Số tiền (cộng được)',
  so: 'Số',
  ngay: 'Ngày',
  ngaygio: 'Ngày giờ',
}
