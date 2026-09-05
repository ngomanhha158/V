import {
  Bang, Card, CardHead, Field, Hop, Input, PageHead, Pill, Select, Td, Th, Tr,
  cx, ngayGioVN, vnd,
} from '@/components/ui'
import { NHAN_LOAI, TONE_LOAI, dauPhieu, giaBinhQuan, loiTon, soVN, tongPhieu, type Ton } from '@/lib/kho'

// Bộ số cố ý cộng lại ĐÚNG: một bản demo về kho mà tồn nhân giá không ra giá
// trị thì nó dạy sai đúng thứ nó sinh ra để dạy.
const TON: Ton[] = [
  { id: 'v1', ma: 'LED9', ten: 'Bóng LED 9W', don_vi: 'cái', ton: 46, ton_toi_thieu: 10,
    don_gia: 22_000, gia_tri: 1_012_000, sap_het: false },
  { id: 'v2', ma: 'SONCT', ten: 'Sơn chống thấm', don_vi: 'lít', ton: 12, ton_toi_thieu: 4,
    don_gia: 145_000, gia_tri: 1_740_000, sap_het: false },
  { id: 'v3', ma: 'GIOANG', ten: 'Gioăng vòi nước', don_vi: 'cái', ton: 8, ton_toi_thieu: 5,
    don_gia: 8_000, gia_tri: 64_000, sap_het: false },
  { id: 'v4', ma: 'BANGTAN', ten: 'Băng tan', don_vi: 'cuộn', ton: 3, ton_toi_thieu: 5,
    don_gia: 6_000, gia_tri: 18_000, sap_het: true },
  { id: 'v5', ma: 'CC10', ten: 'Cầu chì 10A', don_vi: 'cái', ton: 0, ton_toi_thieu: 6,
    don_gia: 12_000, gia_tri: 0, sap_het: true },
]

const YC = [
  { id: 'y1', title: 'Bóng đèn hành lang tầng 5 cháy', ma_can: 'P1-05.00' },
  { id: 'y2', title: 'Vòi nước bếp rỉ', ma_can: 'P1-12.04' },
]

// Phiếu đang soạn: 2 bóng LED + 1 gioăng + 1 băng tan.
const DANG_SOAN = [
  { vat_tu: 'v1', so_luong: 2 },
  { vat_tu: 'v3', so_luong: 1 },
  { vat_tu: 'v4', so_luong: 1 },
]

const SO = [
  { phieu_id: 'p1', loai: 'xuat', luc: '2026-09-05T01:40:00Z', tong_tien: 58_000,
    so_dong: 3, nguoi: 'Lê Văn Tú', ly_do: null as string | null,
    tieu_de_yc: 'Bóng đèn hành lang tầng 5 cháy', ma_can: 'P1-05.00' },
  { phieu_id: 'p2', loai: 'nhap', luc: '2026-09-03T02:10:00Z', tong_tien: 2_900_000,
    so_dong: 2, nguoi: 'Trưởng BQL', ly_do: 'Hóa đơn 0012345, nhà cung cấp Thiên Nam',
    tieu_de_yc: null as string | null, ma_can: null as string | null },
  { phieu_id: 'p3', loai: 'kiem_ke', luc: '2026-09-01T08:00:00Z', tong_tien: -132_000,
    so_dong: 2, nguoi: 'Trưởng BQL', ly_do: 'Kiểm kê quý III/2026',
    tieu_de_yc: null, ma_can: null },
  { phieu_id: 'p4', loai: 'xuat', luc: '2026-08-28T07:20:00Z', tong_tien: 16_000,
    so_dong: 1, nguoi: 'Lê Văn Tú', ly_do: 'Thay gioăng vòi rửa sảnh, bảo trì chung',
    tieu_de_yc: null, ma_can: null },
]

const GIA_MOI = giaBinhQuan(46, 22_000, 20, 45_000)

export default function Page() {
  const bang = new Map(TON.map((t) => [t.id, t]))
  const sapHet = TON.filter((t) => t.sap_het)
  const tongGiaTri = TON.reduce((s, t) => s + t.gia_tri, 0)
  const tongSoan = tongPhieu(DANG_SOAN, bang)

  return (
    <div className="space-y-5">
      <PageHead
        title="Kho vật tư"
        sub="Tồn là TỔNG của sổ, không phải một con số ai cũng sửa được — và mỗi lần xuất đều gắn với một yêu cầu"
      />

      <Hop tone="canh" title={`${sapHet.length} vật tư sắp hết hoặc đã hết`}>
        {sapHet.map((t) => <span key={t.id} className="block">{t.ten}: {loiTon(t).loi}</span>)}
      </Hop>

      <Card>
        <CardHead title="Tồn kho" sub={`${TON.length} vật tư · giá trị ${vnd(tongGiaTri)}`} />
        <div className="scroll-x overflow-auto">
          <Bang>
            <thead>
              <Tr>
                <Th>Vật tư</Th>
                <Th className="text-right">Tồn</Th>
                <Th className="hidden text-right sm:table-cell">Tối thiểu</Th>
                <Th className="text-right">Đơn giá</Th>
                <Th className="hidden text-right sm:table-cell">Giá trị</Th>
              </Tr>
            </thead>
            <tbody>
              {TON.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <span className="font-medium text-ink">{t.ten}</span>
                    <span className="num text-faint"> · {t.ma}</span>
                  </Td>
                  <Td className={cx('num text-right whitespace-nowrap', t.sap_het && 'font-semibold text-bad')}>
                    {soVN(t.ton)} {t.don_vi}
                  </Td>
                  <Td className="num hidden text-right whitespace-nowrap text-muted sm:table-cell">
                    {soVN(t.ton_toi_thieu)}
                  </Td>
                  <Td className="num text-right whitespace-nowrap">{vnd(t.don_gia)}</Td>
                  <Td className="num hidden text-right whitespace-nowrap text-muted sm:table-cell">
                    {vnd(t.gia_tri)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Bang>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-[0.75rem] leading-relaxed text-faint">
          Không có ô nào để gõ tồn kho vào, và đó là cố ý: tồn là tổng của sổ. Sửa
          thì đi qua kiểm kê — có lý do, có tên người, có dòng chênh lệch nằm lại.
          Đơn giá là bình quân gia quyền, tính lại sau mỗi lần nhập.
        </p>
      </Card>

      <Card>
        <CardHead title="Xuất kho" sub="Gắn vào yêu cầu để cuối tháng tra ngược được" />
        <div className="space-y-3 p-4">
          <Field
            label="Xuất cho yêu cầu"
            hint="Đây là chỗ trả lời câu 'đã dùng gì cho căn nào'. Không có yêu cầu thì phải ghi lý do bên dưới."
          >
            <Select defaultValue="y1">
              <option value="">— không gắn yêu cầu nào —</option>
              {YC.map((y) => <option key={y.id} value={y.id}>{y.ma_can} · {y.title}</option>)}
            </Select>
          </Field>
          <Field label="Lý do" hint="Bắt buộc nếu không chọn yêu cầu">
            <Input readOnly defaultValue="" placeholder="Thay bóng hành lang tầng 5, bảo trì chung" />
          </Field>
          <Field label="Vật tư xuất" hint="Đơn giá lấy từ giá kho hiện tại, không gõ tay">
            <div className="space-y-2">
              {DANG_SOAN.map((d) => {
                const t = bang.get(d.vat_tu)!
                return (
                  <div key={d.vat_tu} className="flex flex-wrap items-center gap-2">
                    <Select defaultValue={t.id} className="min-w-[13rem] flex-1">
                      <option value={t.id}>{t.ten} ({soVN(t.ton)} {t.don_vi})</option>
                    </Select>
                    <span className="w-24 shrink-0">
                      <Input readOnly className="num" defaultValue={String(d.so_luong)} />
                    </span>
                    <span className="num w-32 text-right text-[0.8125rem] text-muted">
                      {vnd(t.don_gia)}
                    </span>
                  </div>
                )
              })}
            </div>
          </Field>
          <Hop tone="trung">Giá trị xuất: <b className="num">{vnd(tongSoan)}</b></Hop>
          <span className="inline-flex h-10 items-center rounded-ctl border border-transparent bg-brand px-3.5 text-sm font-medium text-on-brand">
            Xác nhận xuất kho
          </span>
        </div>
      </Card>

      <Card>
        <CardHead title="Nhập kho" sub="Giá kho tính lại theo bình quân gia quyền" />
        <div className="space-y-3 p-4">
          <Field label="Lý do / số hóa đơn" hint="Không bắt buộc, nhưng nó là thứ đối chiếu được về sau">
            <Input readOnly defaultValue="Hóa đơn 0012388, nhà cung cấp Thiên Nam" />
          </Field>
          <Field label="Vật tư nhập" hint="Đơn giá là giá của LÔ NÀY, không phải giá kho">
            <div className="flex flex-wrap items-center gap-2">
              <Select defaultValue="v1" className="min-w-[13rem] flex-1">
                <option value="v1">Bóng LED 9W (46 cái)</option>
              </Select>
              <span className="w-24 shrink-0"><Input readOnly className="num" defaultValue="20" /></span>
              <span className="w-32 shrink-0"><Input readOnly className="num" defaultValue="45000" /></span>
            </div>
          </Field>
          {/* Một lô nhỏ mua đắt kéo giá cả kho lên — phải hỏi lại nhà cung cấp
              NGAY, không phải phát hiện ba tháng sau lúc đối chiếu. */}
          <Hop tone="trung" title="Giá kho sau khi nhập">
            <span className="block">
              Bóng LED 9W: <span className="num">{vnd(22_000)}</span> →{' '}
              <b className="num">{vnd(GIA_MOI)}</b>
              {/* Điều kiện tính RA, không gõ tay: một bản demo hiện cảnh báo mà
                  bản thật không hiện là demo nói dối về chính hành vi của nó. */}
              {GIA_MOI > 22_000 * 1.2 && (
                <span className="text-warn"> — tăng hơn 20%, kiểm lại giá lô này</span>
              )}
            </span>
          </Hop>
          <span className="inline-flex h-10 items-center rounded-ctl border border-transparent bg-brand px-3.5 text-sm font-medium text-on-brand">
            Nhập kho
          </span>
        </div>
      </Card>

      <Card>
        <CardHead title="Sổ kho 30 ngày" sub={`${SO.length} phiếu`} />
        <div className="divide-y divide-line">
          {SO.map((p) => (
            <div key={p.phieu_id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={TONE_LOAI[p.loai as keyof typeof TONE_LOAI]}>
                  {NHAN_LOAI[p.loai as keyof typeof NHAN_LOAI]}
                </Pill>
                <span className="num text-[0.8125rem] font-medium text-ink">
                  {dauPhieu(p.loai)}{vnd(Math.abs(p.tong_tien))}
                </span>
                <span className="text-[0.75rem] text-faint">{p.so_dong} dòng</span>
              </div>
              <div className="num mt-0.5 text-[0.75rem] text-faint">
                {ngayGioVN(p.luc)} · {p.nguoi}
              </div>
              <div className="mt-0.5 text-[0.8125rem] text-muted">
                {p.tieu_de_yc
                  ? <>Cho yêu cầu <span className="num">{p.ma_can}</span> — {p.tieu_de_yc}</>
                  : (p.ly_do || 'Không ghi lý do')}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Hop tone="trung" title="Vì sao tồn kho không phải một cột">
        Cách hiển nhiên là để một cột <span className="num">ton</span> rồi trừ đi mỗi
        lần xuất. Làm thế thì không bao giờ giải thích được con số đó từ đâu ra, và
        hai người xuất cùng lúc là mất một lần trừ. Ở đây tồn là tổng các dòng giao
        dịch — mỗi con số trên màn này đều lần ngược về được một phiếu, một người và
        một thời điểm.
      </Hop>
    </div>
  )
}
