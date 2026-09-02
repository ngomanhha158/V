'use client'

import { useState } from 'react'
import { Bang, Card, CardHead, Hop, ngayGioVN, ngayVN, Pill, Td, Th, Tr, vnd } from '@/components/ui'
import { BAO_CAO, kyHienTai, tenTep, type BaoCao } from '@/lib/xuat/bao-cao'
import { TEN_KIEU } from '@/app/bql/xuat/form'
import { CONG_NO, DOI_SOAT, DU_AN } from '@/lib/demo/data'

// Dùng chung BAO_CAO và TEN_KIEU với màn thật — bộ cột bày ở đây phải đúng bằng
// bộ cột trong file thật, nếu không bản demo dạy sai người dùng về nội dung file.
// Không gọi /api/xuat: đường đó cần đăng nhập và đọc dữ liệu thật.

const ngay = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10)

/** Vài dòng mẫu cho mỗi báo cáo, đúng khóa cột của báo cáo đó. */
function dongMau(id: string): Record<string, unknown>[] {
  if (id === 'cong-no') return CONG_NO.slice(0, 4) as unknown as Record<string, unknown>[]
  if (id === 'doi-soat') {
    return DOI_SOAT.slice(0, 4).map((g) => ({
      paid_at: g.paid_at, provider: g.provider, provider_ref: g.bank_ref,
      amount: g.amount, content: g.content, trang_thai: g.trang_thai,
      cach_khop: g.cach_khop, unit_code: g.unit_code, con_du: g.con_du,
    }))
  }
  if (id === 'so-quy') {
    return [
      { paid_at: `${ngay(3)}T02:14:00Z`, building_code: 'P1', unit_code: 'P1-10.01', amount: 2983500, method: 'bank_transfer', bank_ref: 'MBVCB.9921334', matched_by: 'auto', ky_hoa_don: `${kyHienTai()}-01` },
      { paid_at: `${ngay(2)}T08:41:00Z`, building_code: 'P1', unit_code: 'P1-07.02', amount: 2660000, method: 'bank_transfer', bank_ref: 'MBVCB.9921502', matched_by: 'auto', ky_hoa_don: `${kyHienTai()}-01` },
      { paid_at: `${ngay(1)}T01:05:00Z`, building_code: 'P2', unit_code: 'P2-11.04', amount: 1500000, method: 'bank_transfer', bank_ref: 'MBVCB.9922077', matched_by: 'thu_cong', ky_hoa_don: `${kyHienTai()}-01` },
    ]
  }
  return [
    { building_code: 'P1', unit_code: 'P1-10.01', trang_thai: 'issued', due_date: ngay(-12), description: 'Phí quản lý 96,4 m²', quantity: 96.4, unit_price: 16500, amount: 1590600, total_amount: 2983500, paid_amount: 2983500 },
    { building_code: 'P1', unit_code: 'P1-10.01', trang_thai: 'issued', due_date: ngay(-12), description: 'Nước sinh hoạt 14 m³', quantity: 14, unit_price: 8500, amount: 119000, total_amount: 2983500, paid_amount: 2983500 },
    { building_code: 'P1', unit_code: 'P1-10.01', trang_thai: 'issued', due_date: ngay(-12), description: 'Gửi ô tô', quantity: 1, unit_price: 1200000, amount: 1200000, total_amount: 2983500, paid_amount: 2983500 },
    { building_code: 'P2', unit_code: 'P2-03.01', trang_thai: 'draft', due_date: ngay(-12), description: 'Phí quản lý 78,5 m²', quantity: 78.5, unit_price: 16500, amount: 1295250, total_amount: 2090000, paid_amount: 0 },
  ]
}

function hien(kieu: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (kieu === 'tien') return vnd(Number(v))
  if (kieu === 'ngay') return ngayVN(String(v))
  if (kieu === 'ngaygio') return ngayGioVN(String(v))
  return String(v)
}

export function XuatDemo({ chotLuc }: { chotLuc: string }) {
  const [ky, setKy] = useState(kyHienTai())
  const [mo, setMo] = useState<string | null>('cong-no')

  return (
    <>
      <Card>
        <CardHead title="Kỳ" sub="Áp cho ba báo cáo theo kỳ; công nợ luôn là ảnh chụp lúc bấm tải" />
        <div className="flex flex-wrap items-end gap-3 p-4">
          <label className="block w-48">
            <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink">Kỳ báo cáo</span>
            <input
              type="month" value={ky} onChange={(e) => setKy(e.target.value || kyHienTai())}
              className="num h-10 w-full rounded-ctl border border-line-firm bg-surface px-3 text-sm text-ink focus:border-brand"
            />
          </label>
          <p className="pb-2.5 text-[0.75rem] text-faint">
            Kỳ cắt theo <strong className="text-muted">giờ Việt Nam</strong>, không phải giờ
            UTC — tiền về rạng sáng mùng 1 vẫn thuộc tháng đó.
          </p>
        </div>
      </Card>

      {BAO_CAO.map((bc) => (
        <TheDemo
          key={bc.id} bc={bc} ky={ky} chotLuc={chotLuc}
          mo={mo === bc.id} bat={() => setMo((m) => (m === bc.id ? null : bc.id))}
        />
      ))}
    </>
  )
}

function TheDemo({
  bc, ky, chotLuc, mo, bat,
}: { bc: BaoCao; ky: string; chotLuc: string; mo: boolean; bat: () => void }) {
  const dong = dongMau(bc.id)
  const cotTien = bc.cot.filter((c) => c.kieu === 'tien')

  return (
    <Card>
      <CardHead
        title={bc.ten}
        sub={bc.theoKy ? `Kỳ ${ky}` : 'Ảnh chụp tại thời điểm bấm tải'}
        right={<Pill tone="trung" cham={false}>{bc.cot.length} cột</Pill>}
      />
      <div className="space-y-3 p-4">
        <p className="text-[0.8125rem] leading-relaxed text-muted">{bc.moTa}</p>
        <p className="font-mono text-[0.75rem] text-faint">
          {tenTep(bc, bc.theoKy ? ky : null, new Date(chotLuc))}
        </p>
        <button
          type="button" onClick={bat} aria-expanded={mo}
          className="h-9 rounded-ctl border border-line-firm px-3 text-[0.8125rem] font-medium text-ink hover:bg-sunken"
        >
          {mo ? 'Ẩn nội dung file' : 'Xem nội dung file'}
        </button>

        {mo && (
          <div className="space-y-3">
            <div className="rounded-card border border-line bg-raised p-3">
              <div className="mb-2 text-[0.75rem] font-semibold tracking-wide text-faint uppercase">
                Sheet 1 · Tổng hợp
              </div>
              <dl className="space-y-1 text-[0.8125rem]">
                <Doi nhan="Báo cáo">{bc.ten}</Doi>
                <Doi nhan="Dự án">{DU_AN.ten}</Doi>
                <Doi nhan="Kỳ">{bc.theoKy ? ky : 'Ảnh chụp tại thời điểm xuất'}</Doi>
                <Doi nhan="Chốt lúc">{ngayGioVN(chotLuc)}</Doi>
                <Doi nhan="Số dòng">{dong.length}</Doi>
                {cotTien.map((c) => (
                  <Doi key={c.khoa} nhan={`Tổng · ${c.nhan}`}>
                    {vnd(dong.reduce((s, d) => s + (Number(d[c.khoa]) || 0), 0))}
                  </Doi>
                ))}
              </dl>
            </div>

            <div>
              <div className="mb-2 text-[0.75rem] font-semibold tracking-wide text-faint uppercase">
                Sheet 2 · Chi tiết
              </div>
              <Bang className="text-[0.8125rem]">
                <thead>
                  <tr>
                    {bc.cot.map((c) => (
                      <Th key={c.khoa} phai={c.kieu === 'tien' || c.kieu === 'so'}>
                        {c.nhan}
                        <span className="block font-normal normal-case text-faint">
                          {TEN_KIEU[c.kieu]}
                        </span>
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dong.map((d, i) => (
                    <Tr key={i}>
                      {bc.cot.map((c) => (
                        <Td
                          key={c.khoa}
                          phai={c.kieu === 'tien' || c.kieu === 'so'}
                          so={c.kieu === 'tien' || c.kieu === 'so'}
                          className="whitespace-nowrap"
                        >
                          {hien(c.kieu, d[c.khoa])}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </tbody>
              </Bang>
            </div>

            <Hop tone="trung">
              Trong file thật, các ô tiền ở đây là <strong>số</strong> chứ không phải chữ —
              bôi đen cả cột là Excel cộng ra đúng con số ghi ở sheet Tổng hợp.
            </Hop>
          </div>
        )}
      </div>
    </Card>
  )
}

function Doi({ nhan, children }: { nhan: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted">{nhan}</dt>
      <dd className="min-w-0 text-right font-medium text-ink">{children}</dd>
    </div>
  )
}
