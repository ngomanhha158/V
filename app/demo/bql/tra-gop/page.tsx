import {
  Bang, Card, CardHead, Field, Hop, Input, PageHead, Pill, Select, Td, Th, Tr,
  Textarea, cx, ngayVN, vnd,
} from '@/components/ui'
import { NHAN_CACH_CHIA, NHAN_DOT, TONE_DOT, ganhNang, kyVN, trangThaiDot } from '@/lib/tra-gop'
import { CAN, KE_HOACH } from '@/app/demo/tra-gop-mock'

// Dùng chung trangThaiDot/NHAN_DOT với màn thật: câu "hóa đơn còn thiếu" là chỗ
// dễ hiểu nhầm nhất của cả tính năng, và một bản demo nói khác bản thật thì nó
// dạy sai đúng chỗ người ta cần học.
export default function Page() {
  const k = KE_HOACH
  const g = ganhNang(k.tong_chi_phi, k.so_can, k.so_dot)!

  return (
    <div className="space-y-5">
      <PageHead
        title="Thu theo đợt"
        sub="Khoản lớn chia thành nhiều tháng — mỗi đợt là một DÒNG trên hóa đơn tháng, không phải một loại tiền khác"
      />

      <Card>
        <CardHead
          xuongDong
          title={k.ten}
          sub={
            `${NHAN_CACH_CHIA[k.cach_chia]} · ${k.so_can} căn · `
            + `${k.so_dot} đợt từ kỳ ${kyVN(k.ky_bat_dau)} · ${k.nghi_quyet} ngày ${ngayVN(k.ngay_nq)}`
          }
        />
        <div className="space-y-4 p-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-card border border-line bg-sunken px-3.5 py-3">
              <dt className="text-[0.75rem] font-medium text-muted">Tổng chi phí</dt>
              <dd className="num mt-1 text-[1.25rem] leading-none font-semibold text-ink">
                {vnd(k.tong_chi_phi)}
              </dd>
            </div>
            <div className="rounded-card border border-line bg-sunken px-3.5 py-3">
              <dt className="text-[0.75rem] font-medium text-muted">Đã lên hóa đơn phát hành</dt>
              <dd className="num mt-1 text-[1.25rem] leading-none font-semibold text-ink">
                {vnd(k.da_len_hoa_don)}
              </dd>
              <dd className="num mt-1.5 text-[0.75rem] text-faint">
                {k.dot_da_qua}/{k.so_dot} đợt đã tới kỳ
              </dd>
            </div>
            <div className="rounded-card border border-line bg-sunken px-3.5 py-3">
              <dt className="text-[0.75rem] font-medium text-muted">Chưa tới kỳ</dt>
              <dd className="num mt-1 text-[1.25rem] leading-none font-semibold text-ink">
                {vnd(k.chua_toi_ky)}
              </dd>
            </div>
          </dl>

          <Hop tone="canh">
            {k.so_can_con_no} căn còn nợ hóa đơn có chứa đợt thu này. Màn này không có ô
            &ldquo;đã thu bao nhiêu&rdquo;, và đó là cố ý: đợt thu nằm chung một tờ hóa đơn
            với phí quản lý và tiền nước, nên khi cư dân chuyển thiếu thì không có cách
            nào biết phần thiếu thuộc dòng nào. Mọi cách chia đều là bịa.
          </Hop>

          <div className="flex flex-wrap items-start gap-3 border-t border-line pt-4">
            <span className="inline-flex h-8 items-center rounded-ctl border border-line-firm bg-surface px-2.5 text-[0.8125rem] font-medium text-ink">
              Xem từng căn
            </span>
            <span className="inline-flex h-8 items-center rounded-ctl border border-line-firm bg-surface px-2.5 text-[0.8125rem] font-medium text-ink">
              Dừng thu
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Từng căn" sub={`${CAN.length} căn đầu trong ${k.so_can} · ${k.so_dot} đợt`} />
        <div className="scroll-x overflow-auto">
          <Bang>
            <thead>
              <Tr>
                <Th>Căn</Th>
                <Th className="hidden text-right sm:table-cell">Diện tích</Th>
                <Th className="text-right">Tổng phải trả</Th>
                {Array.from({ length: k.so_dot }, (_, i) => (
                  <Th key={i} className="text-right">Đợt {i + 1}</Th>
                ))}
              </Tr>
            </thead>
            <tbody>
              {CAN.map((c) => (
                <Tr key={c.unit_id}>
                  <Td className="num font-medium whitespace-nowrap">{c.ma_can}</Td>
                  <Td className="num hidden text-right whitespace-nowrap text-muted sm:table-cell">
                    {c.dien_tich.toLocaleString('vi-VN')} m²
                  </Td>
                  <Td className="num text-right font-medium whitespace-nowrap">
                    {vnd(c.dot.reduce((t, d) => t + d.so_tien, 0))}
                  </Td>
                  {c.dot.map((d) => {
                    const t = trangThaiDot({ ...d, hoa_don_id: d.hoa_don_trang_thai ? 'x' : null })
                    return (
                      <Td key={d.thu_tu} className="text-right whitespace-nowrap">
                        <span className={cx('num', t === 'con_thieu' && 'text-bad', t === 'da_tra' && 'text-ok')}>
                          {vnd(d.so_tien)}
                        </span>
                        <span className="mt-0.5 block text-[0.6875rem] text-faint">{NHAN_DOT[t]}</span>
                      </Td>
                    )
                  })}
                </Tr>
              ))}
            </tbody>
          </Bang>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-2.5 text-[0.75rem]">
          {(Object.keys(NHAN_DOT) as (keyof typeof NHAN_DOT)[]).map((t) => (
            <Pill key={t} tone={TONE_DOT[t]}>{NHAN_DOT[t]}</Pill>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="Lập kế hoạch thu mới" sub="Chỉ trưởng BQL hoặc thành viên BQT" />
        <div className="space-y-3 p-4">
          <Field
            label="Tên khoản thu"
            hint="In NGUYÊN VĂN lên hóa đơn của từng nhà, kèm 'đợt 2/3'. Viết như một dòng hóa đơn."
          >
            <Input readOnly defaultValue="Sơn lại mặt ngoài tháp A" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tổng chi phí (đ)" hint="Đúng số trên hóa đơn nhà thầu">
              <Input readOnly className="num" defaultValue="2100000000" />
            </Field>
            <Field label="Cách chia" hint="Chia theo diện tích cần mọi căn đã có m²">
              <Select defaultValue="theo_m2">
                {Object.entries(NHAN_CACH_CHIA).map(([kk, v]) => (
                  <option key={kk} value={kk}>{v}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Số đợt" hint="Tối đa 36. Dài hơn ba năm thì đó không còn là chia đợt.">
              <Input readOnly className="num" defaultValue="3" />
            </Field>
            <Field label="Kỳ bắt đầu" hint="Đợt 1 nằm trong hóa đơn của kỳ này">
              <Input readOnly className="num" defaultValue="2026-10" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Số nghị quyết" hint="Bắt buộc — hệ thống từ chối nếu để trống">
              <Input readOnly defaultValue="NQ-05/2026" />
            </Field>
            <Field label="Ngày nghị quyết" hint="Không bắt buộc">
              <Input readOnly className="num" defaultValue="2026-09-18" />
            </Field>
          </div>
          <Field label="Giải trình" hint="Không bắt buộc — vì sao phải chi, đã chọn nhà thầu nào">
            <Textarea rows={2} readOnly defaultValue={k.mo_ta} />
          </Field>

          {/* Con số quyết định KHÔNG phải tổng chi phí mà là "mỗi tháng nặng thêm
              bao nhiêu" — hiện ngay khi gõ, không đợi bấm xong mới thấy. */}
          <Hop tone="brand" title="Mỗi nhà thấy gì trên hóa đơn">
            <span className="block">
              Thu một lần: <b className="num">{vnd(g.moiCan)}</b> mỗi căn, trong một tháng.
            </span>
            <span className="mt-1 block">
              Chia {g.soDot} đợt: <b className="num">{vnd(g.moiThang)}</b> mỗi tháng, cộng vào
              hóa đơn các kỳ <span className="num">10/2026, 11/2026, 12/2026</span>.
            </span>
            <span className="mt-1 block text-[0.75rem]">
              Con số bên trên là chia đều để hình dung; chia theo diện tích thì căn to
              trả nhiều hơn, căn nhỏ trả ít hơn, và tổng vẫn đúng bằng chi phí.
            </span>
          </Hop>

          <span className="inline-flex h-8 items-center rounded-ctl border border-transparent bg-brand px-2.5 text-[0.8125rem] font-medium text-on-brand">
            Lập kế hoạch thu
          </span>
        </div>
      </Card>

      <Hop tone="trung" title="Vì sao chia đợt chứ không cho nợ rồi trả dần">
        <span className="block">
          Giữ một hóa đơn lớn rồi cho trả dần thì hạn nộp chỉ có MỘT. Hộ đang trả
          đúng lịch vẫn bị đếm là quá hạn ngay từ ngày đầu, và mọi màn công nợ sẽ
          tô đỏ đúng những người đang làm đúng.
        </span>
        <span className="mt-2 block">
          Chia đợt thì mỗi đợt là một dòng trên hóa đơn của kỳ nó thuộc về, với
          hạn nộp của kỳ đó. Cư dân vẫn chuyển một lần mỗi tháng, mã QR không đổi,
          và công nợ nói đúng sự thật.
        </span>
      </Hop>
    </div>
  )
}
