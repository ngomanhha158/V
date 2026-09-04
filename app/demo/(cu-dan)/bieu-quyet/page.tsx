import { Button, Card, CardHead, Hop, PageHead, Pill, cx } from '@/components/ui'
import { KetQuaBQ } from '@/components/ket-qua-bq'
import {
  GIAI_THICH_Y_KIEN, NHAN_Y_KIEN, TONE_Y_KIEN, Y_KIEN, loiConCanChuaBo, m2,
} from '@/lib/bieu-quyet'
import { CUA_TOI, CUOC, DANG_TINH } from '@/app/demo/bq-mock'

export default function Page() {
  const bq = CUOC[0]
  const chuaBo = CUA_TOI.filter((c) => !c.da_bo)
  const daBo = CUA_TOI.filter((c) => c.da_bo)

  return (
    <div className="space-y-5">
      <PageHead
        breadcrumb={<span>← Biểu quyết hội nghị</span>}
        title="Lá phiếu của bạn"
      />

      <Card>
        <CardHead title="Bỏ phiếu" sub={`${CUA_TOI.length} căn của bạn`} />
        <div className="space-y-4 p-4">
          <Hop tone="canh">{loiConCanChuaBo(CUA_TOI)}</Hop>

          {daBo.map((c) => (
            <div
              key={c.unit_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-sunken px-3.5 py-3"
            >
              <span className="text-[0.8125rem]">
                <span className="num font-medium text-ink">{c.ma_can}</span>
                <span className="num text-faint"> · {m2(c.dien_tich)}</span>
              </span>
              <Pill tone={TONE_Y_KIEN.tan_thanh}>Đã bỏ: {NHAN_Y_KIEN.tan_thanh}</Pill>
            </div>
          ))}

          {chuaBo.map((c) => (
            <div key={c.unit_id} className="space-y-3">
              <div className="text-[0.8125rem] text-muted">
                Phiếu của căn <span className="num font-medium text-ink">{c.ma_can}</span> có
                trọng số <span className="num font-medium text-ink">{m2(c.dien_tich)}</span>.
              </div>
              <div className="space-y-2">
                {Y_KIEN.map((y) => (
                  <div key={y} className="rounded-card border border-line bg-surface p-3">
                    <Button
                      type="button"
                      dang={y === 'tan_thanh' ? 'chinh' : 'phu'}
                      className={cx('w-full', y === 'khong_tan_thanh' && 'border-bad-line text-bad')}
                    >
                      {NHAN_Y_KIEN[y]}
                    </Button>
                    <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
                      {GIAI_THICH_Y_KIEN[y]}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[0.75rem] leading-relaxed text-faint">
                Bấm là ghi ngay, và phiếu KHÔNG sửa được. Bỏ nhầm thì nhờ ban quản
                trị hủy phiếu — họ phải ghi lý do, và tên họ nằm lại trong sổ.
              </p>
            </div>
          ))}
        </div>
      </Card>

      <KetQuaBQ bq={bq} k={DANG_TINH} dangTinh />

      <Hop tone="trung" title="Hàng xóm bỏ phiếu gì thì bạn không thấy">
        Bạn đọc được kết quả tổng và mẫu số của nó — đó là thứ để kiểm chứng nghị
        quyết. Nhưng từng lá phiếu thì chỉ chính căn đó và ban kiểm phiếu nhìn
        thấy. Bỏ phiếu mà cả tòa nhìn được là bỏ phiếu dưới áp lực.
      </Hop>
    </div>
  )
}
