import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, ngayGioVN } from '@/components/ui'
import { KetQuaBQ, ketQuaDaChot, type CuocBQ } from '@/components/ket-qua-bq'
import {
  NHAN_Y_KIEN, TONE_Y_KIEN, loiConCanChuaBo, m2, trangThaiBQ,
  type KetQua, type YKien,
} from '@/lib/bieu-quyet'
import { LaPhieu } from '../form'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()

  const { data: bqRaw, error } = await db.from('bieu_quyet').select('*').eq('id', id).maybeSingle()
  if (error?.code === '42P01' || error?.code === '42883') {
    return (
      <div className="space-y-5">
        <PageHead title="Biểu quyết hội nghị" />
        <Hop tone="xau" title="Phần biểu quyết chưa có">Báo ban quản lý.</Hop>
      </div>
    )
  }
  if (!bqRaw) notFound()
  const bq = bqRaw as CuocBQ
  const t = trangThaiBQ(bq)

  const [{ data: kLive }, { data: cuaToi, error: loiCuaToi }] = await Promise.all([
    db.rpc('kiem_phieu_bieu_quyet', { p_bq: id }),
    db.rpc('bieu_quyet_cua_toi', { p_bq: id }),
  ])
  const ds = cuaToi ?? []
  const k: KetQua | null = t === 'da_dong'
    ? ketQuaDaChot(bq, ds.filter((c) => c.da_bo).length)
    : ((kLive?.[0] ?? null) as KetQua | null)
  const nhac = loiConCanChuaBo(ds)

  return (
    <div className="space-y-5">
      <PageHead
        breadcrumb={<Link href="/bieu-quyet" className="hover:text-ink">← Biểu quyết hội nghị</Link>}
        title="Lá phiếu của bạn"
      />

      {t === 'dang_mo' && (
        <Card>
          <CardHead
            title="Bỏ phiếu"
            sub={ds.length === 0 ? 'Không có căn nào bỏ phiếu được' : `${ds.length} căn của bạn`}
          />
          <div className="space-y-4 p-4">
            {loiCuaToi && <Hop tone="xau">{loiCuaToi.message}</Hop>}

            {ds.length === 0 ? (
              <Hop tone="canh" title="Bạn không có căn nào bỏ phiếu được ở cuộc này">
                Chỉ CHỦ SỞ HỮU hoặc người được chủ sở hữu ủy quyền mới bỏ phiếu.
                Người thuê và người nhà thì không — biểu quyết việc của tòa nhà là
                quyền của chủ sở hữu, và một nghị quyết có phiếu của người thuê là
                nghị quyết bị bác ngay khi có người soi lại. Bạn vẫn đọc được kết
                quả bên dưới.
              </Hop>
            ) : (
              <>
                {nhac && <Hop tone="canh">{nhac}</Hop>}
                <div className="space-y-4">
                  {ds.map((c) =>
                    c.da_bo ? (
                      <div
                        key={c.unit_id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-sunken px-3.5 py-3"
                      >
                        <span className="text-[0.8125rem]">
                          <span className="num font-medium text-ink">{c.ma_can}</span>
                          <span className="num text-faint"> · {m2(c.dien_tich)}</span>
                        </span>
                        <Pill tone={TONE_Y_KIEN[c.y_kien as YKien] ?? 'trung'}>
                          Đã bỏ: {NHAN_Y_KIEN[c.y_kien as YKien] ?? c.y_kien}
                        </Pill>
                      </div>
                    ) : (
                      <LaPhieu
                        key={c.unit_id}
                        bq={bq.id}
                        unit={c.unit_id}
                        maCan={c.ma_can}
                        dienTich={c.dien_tich}
                      />
                    ),
                  )}
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {t === 'da_dong' && ds.some((c) => c.da_bo) && (
        <Hop tone="trung" title="Phiếu của bạn ở cuộc này">
          {ds.filter((c) => c.da_bo).map((c) => (
            <span key={c.unit_id} className="block">
              <span className="num font-medium">{c.ma_can}</span> ({m2(c.dien_tich)}):{' '}
              {NHAN_Y_KIEN[c.y_kien as YKien] ?? c.y_kien}
            </span>
          ))}
          <span className="mt-1.5 block">
            Kiểm phiếu lúc <span className="num">{ngayGioVN(bq.dong_luc!)}</span>. Từ lúc đó
            con số được chốt lại, không tính lại nữa.
          </span>
        </Hop>
      )}

      <KetQuaBQ bq={bq} k={k} dangTinh={t === 'dang_mo'} />

      <Hop tone="trung" title="Hàng xóm bỏ phiếu gì thì bạn không thấy">
        Bạn đọc được kết quả tổng và mẫu số của nó — đó là thứ để kiểm chứng
        nghị quyết. Nhưng từng lá phiếu thì chỉ chính căn đó và ban kiểm phiếu
        nhìn thấy. Bỏ phiếu mà cả tòa nhìn được là bỏ phiếu dưới áp lực.
      </Hop>
    </div>
  )
}
