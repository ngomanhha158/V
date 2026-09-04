import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import {
  Bang, Card, CardHead, Hop, PageHead, Pill, Td, Th, Tr, cx, ngayGioVN,
} from '@/components/ui'
import { KetQuaBQ, ketQuaDaChot, type CuocBQ } from '@/components/ket-qua-bq'
import {
  NHAN_Y_KIEN, TONE_Y_KIEN, m2, trangThaiBQ, type KetQua, type YKien,
} from '@/lib/bieu-quyet'
import { NutDong, NutHuyCuoc, NutHuyPhieu } from '../form'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  const { data: bqRaw, error } = await db.from('bieu_quyet').select('*').eq('id', id).maybeSingle()
  if (error?.code === '42P01' || error?.code === '42883') {
    return (
      <div className="space-y-5">
        <PageHead title="Biểu quyết hội nghị" />
        <Hop tone="xau" title="Phần biểu quyết chưa có trên database">
          Chạy lại schema.sql rồi auth_hooks.sql.
        </Hop>
      </div>
    )
  }
  if (!bqRaw) notFound()
  const bq = bqRaw as CuocBQ
  const t = trangThaiBQ(bq)

  const [{ data: kLive }, { data: dsCan }, { data: dsPhieu }] = await Promise.all([
    db.rpc('kiem_phieu_bieu_quyet', { p_bq: id }),
    db.from('bieu_quyet_can').select('unit_id, ma_can, dien_tich').eq('bieu_quyet_id', id),
    db.from('phieu_bieu_quyet').select('*').eq('bieu_quyet_id', id).order('bo_luc'),
  ])

  const phieu = dsPhieu ?? []
  const soDaBo = phieu.filter((p) => !p.huy_luc).length
  // Cuộc đã đóng đọc từ CỘT ĐÃ LƯU, không kiểm lại — xem ghi chú ở ketQuaDaChot.
  const k: KetQua | null = t === 'da_dong'
    ? ketQuaDaChot(bq, soDaBo)
    : ((kLive?.[0] ?? null) as KetQua | null)

  const theoCan = new Map(phieu.filter((p) => !p.huy_luc).map((p) => [p.unit_id, p]))
  const daHuy = phieu.filter((p) => p.huy_luc)
  const can = (dsCan ?? []).slice().sort((a, b) => a.ma_can.localeCompare(b.ma_can, 'vi'))

  return (
    <div className="space-y-5">
      <PageHead
        breadcrumb={
          <Link href="/bql/bieu-quyet" className="hover:text-ink">← Biểu quyết hội nghị</Link>
        }
        title="Kết quả kiểm phiếu"
        sub={`${bq.so_can} căn · ${m2(bq.tong_dien_tich)} diện tích toàn khu`}
      />

      <KetQuaBQ
        bq={bq}
        k={k}
        dangTinh={t === 'dang_mo'}
        hanhDong={
          t === 'dang_mo' ? (
            <div className="flex flex-wrap items-start gap-3 border-t border-line pt-4">
              <NutDong id={bq.id} />
              <NutHuyCuoc id={bq.id} />
            </div>
          ) : null
        }
      />

      <Card>
        <CardHead
          title="Từng căn"
          sub={`${soDaBo}/${bq.so_can} căn đã bỏ phiếu`}
        />
        <div className="scroll-x max-h-[32rem] overflow-auto">
          <Bang>
            <thead>
              <Tr>
                <Th>Căn</Th>
                <Th className="text-right">Diện tích</Th>
                <Th>Ý kiến</Th>
                <Th className="hidden sm:table-cell">Lúc</Th>
                {t === 'dang_mo' && <Th className="text-right">Sửa</Th>}
              </Tr>
            </thead>
            <tbody>
              {can.map((c) => {
                const p = c.unit_id ? theoCan.get(c.unit_id) : undefined
                return (
                  <Tr key={c.unit_id ?? c.ma_can} className={cx(!p && 'opacity-60')}>
                    <Td className="num font-medium whitespace-nowrap">{c.ma_can}</Td>
                    <Td className="num text-right whitespace-nowrap">{m2(c.dien_tich)}</Td>
                    <Td>
                      {p ? (
                        <Pill tone={TONE_Y_KIEN[p.y_kien as YKien] ?? 'trung'}>
                          {NHAN_Y_KIEN[p.y_kien as YKien] ?? p.y_kien}
                        </Pill>
                      ) : (
                        <span className="text-[0.8125rem] text-faint">Chưa bỏ phiếu</span>
                      )}
                    </Td>
                    <Td className="num hidden whitespace-nowrap text-muted sm:table-cell">
                      {p ? ngayGioVN(p.bo_luc) : '—'}
                    </Td>
                    {t === 'dang_mo' && (
                      <Td className="text-right">
                        {p && <NutHuyPhieu phieu={p.id} bq={bq.id} can={c.ma_can} />}
                      </Td>
                    )}
                  </Tr>
                )
              })}
            </tbody>
          </Bang>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-[0.75rem] leading-relaxed text-faint">
          Diện tích ở cột này là diện tích ĐÓNG BĂNG lúc mở cuộc. Sửa diện tích
          trong hồ sơ căn hộ từ giờ không làm đổi trọng số của lá phiếu đã bỏ,
          cũng không đổi mẫu số.
        </p>
      </Card>

      {daHuy.length > 0 && (
        <Card>
          <CardHead
            title="Phiếu đã hủy"
            sub={`${daHuy.length} lá — không tính vào kết quả, giữ lại để tra`}
          />
          <div className="divide-y divide-line">
            {daHuy.map((p) => {
              const c = can.find((x) => x.unit_id === p.unit_id)
              return (
                <div key={p.id} className="px-4 py-2.5 text-[0.8125rem]">
                  <span className="num font-medium text-ink">{c?.ma_can ?? '—'}</span>
                  <span className="text-muted">
                    {' '}bỏ {NHAN_Y_KIEN[p.y_kien as YKien] ?? p.y_kien} lúc{' '}
                    <span className="num">{ngayGioVN(p.bo_luc)}</span>, hủy lúc{' '}
                    <span className="num">{ngayGioVN(p.huy_luc!)}</span>
                  </span>
                  <div className="mt-0.5 text-[0.75rem] text-faint">
                    Lý do: {p.ly_do_huy?.trim() || 'không ghi'}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Hop tone="trung" title="Vì sao phiếu không sửa được, chỉ hủy rồi bỏ lại">
        Cho sửa thẳng thì một lần đổi ý của chủ căn và một lần ai đó đổi phiếu
        của người khác trông giống hệt nhau trong sổ. Hủy kèm lý do để lại tên
        người hủy và dòng giải thích — đó là thứ duy nhất phân biệt được hai
        chuyện đó về sau. Cuộc đã kiểm phiếu thì cả hủy lẫn bỏ lại đều khóa.
      </Hop>
    </div>
  )
}
