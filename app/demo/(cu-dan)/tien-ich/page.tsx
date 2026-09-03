import { Card, CardHead, Hop, PageHead, Pill, cx } from '@/components/ui'
import { LichSuat, type ONgay } from '@/components/lich-suat'
import { loiConSuat, loiOKhongDat, nhanSuat, type OSuat } from '@/lib/tien-ich'

// Dùng chung loiConSuat / loiOKhongDat / tinhNgay với màn thật: hai màn nói khác
// nhau về "còn mấy suất" thì bản demo đang dạy sai đúng con số quyết định.
//
// Bộ số cố ý bày đủ: ngày còn chỗ, ngày còn đúng một suất, ngày kín, và ngày BQL
// đóng để bảo trì — bốn màu người ta sẽ gặp trong tuần đầu.
const o = (p: Partial<OSuat> & { suat_id: string }): OSuat => ({
  thu_tu: 1, bat_dau: '08:00:00', ket_thuc: '11:00:00',
  con_trong: true, cua_toi: false, dong_cua: false, ly_do: null, ...p,
})

const SUAT = [
  { thu_tu: 1, bat_dau: '08:00:00', ket_thuc: '11:00:00' },
  { thu_tu: 2, bat_dau: '14:00:00', ket_thuc: '17:00:00' },
  { thu_tu: 3, bat_dau: '18:00:00', ket_thuc: '21:00:00' },
]

const KIN = new Set(['2026-09-05', '2026-09-06'])
const IT = new Set(['2026-09-02', '2026-09-10'])
const DONG = new Set(['2026-09-13'])

const NGAY_DS: ONgay[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10)
  return {
    ngay: d,
    o: SUAT.map((s, j) =>
      o({
        suat_id: `${d}-${j}`, ...s,
        con_trong: DONG.has(d) ? false : KIN.has(d) ? false : IT.has(d) ? j === 2 : true,
        dong_cua: DONG.has(d),
        ly_do: DONG.has(d) ? 'Vệ sinh định kỳ' : null,
      }),
    ),
  }
})

const CHON = '2026-09-10'

export default function Page() {
  const oCuaNgay = NGAY_DS.find((n) => n.ngay === CHON)!.o
  // Căn này đã đặt 1 suất trong tuần, hạn mức 2.
  const hanMuc = loiConSuat(1, 2, 1)

  return (
    <div className="space-y-5">
      <PageHead title="Sảnh sinh hoạt" sub="Tầng 2, tháp A · 200.000đ một suất" />

      <Hop tone="trung" title="Hạn mức tuần này">{hanMuc.loi}</Hop>

      <Card>
        <CardHead title="Chọn ngày" sub="Mở đặt trước 14 ngày" />
        <div className="p-4">
          <LichSuat ngayDs={NGAY_DS} base="#" dangChon={CHON} phi={200_000} />
        </div>
      </Card>

      <Card>
        <CardHead title="Suất ngày 10/09/2026" />
        <div className="divide-y divide-line">
          {oCuaNgay.map((s) => {
            const ly = loiOKhongDat(s, hanMuc.ok, false)
            return (
              <div key={s.suat_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className={cx('num font-medium', s.con_trong ? 'text-ink' : 'text-muted')}>
                    {nhanSuat(s.bat_dau, s.ket_thuc)}
                  </div>
                  {ly && <div className="mt-0.5 text-[0.8125rem] text-muted">{ly}</div>}
                </div>
                <div className="shrink-0">
                  {ly ? (
                    <Pill tone="xau">Kín</Pill>
                  ) : (
                    <span className="inline-flex h-8 items-center rounded-lg border border-transparent bg-brand px-2.5 text-[0.8125rem] font-medium text-on-brand">
                      Đặt {nhanSuat(s.bat_dau, s.ket_thuc)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Hop tone="trung" title="Ai bấm trước thì được">
        Suất giữ ngay lúc bấm, không phải chờ ai duyệt. Hủy được cho tới lúc suất
        bắt đầu, và chỗ trả lại ngay cho người khác đặt.
      </Hop>
    </div>
  )
}
