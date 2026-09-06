'use client'
import { useActionState } from 'react'
import {
  previewReadings, commitReadings, type ReadingImportState,
} from './actions'
import {
  Bang, Button, Card, CardHead, Field, Hop, Input, Select, Stat, Td, Th, Tr, cx,
} from '@/components/ui'

const dau: ReadingImportState = { phase: 'idle' }

/**
 * Nhập chỉ số công tơ từ file Excel.
 *
 * Người đi đọc công tơ vốn đã ghi ra giấy hoặc ra file. Chỗ hay sai nhất không
 * phải lúc đọc đồng hồ mà lúc CHÉP LẠI vào 240 ô trên màn hình — và mỗi ô chép
 * nhầm là một tờ hóa đơn sai tiền, gửi đi rồi mới biết.
 *
 * Xem trước rồi mới ghi, giống import căn hộ: file của BQL luôn bẩn, và "import
 * thất bại" chung chung thì họ phải tự dò cả trăm dòng.
 */
export function NhapChiSo({
  period, feeTypes,
}: { period: string; feeTypes: { id: string; name: string }[] }) {
  const [xem, doXem, dangXem] = useActionState(previewReadings, dau)
  const [ghi, doGhi, dangGhi] = useActionState(commitReadings, dau)
  const state = ghi.phase === 'done' || ghi.phase === 'error' ? ghi : xem

  if (feeTypes.length === 0) return null

  return (
    <Card>
      <CardHead
        title="Nhập chỉ số từ Excel"
        sub="File được đọc và kiểm tra trước — không ghi gì cho tới khi bạn xác nhận"
      />

      <div className="space-y-4 p-4">
        {state.phase === 'done' && (
          <Hop tone="tot" title={`Đã lưu chỉ số cho ${state.saved} căn`}>
            Bảng phía trên đã cập nhật. Sinh hóa đơn kỳ này là dùng đúng những
            con số vừa ghi.
          </Hop>
        )}

        {state.phase === 'error' && (
          <Hop tone="xau" title="Không nhập được">{state.message}</Hop>
        )}

        <form action={doXem} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Kỳ">
            <Input type="month" name="period" defaultValue={period} required />
          </Field>
          <Field label="Loại chỉ số">
            <Select name="fee_type_id" required>
              {feeTypes.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </Field>
          <input
            type="file" name="file" accept=".xlsx" required
            className={cx(
              'w-full rounded-ctl border border-dashed border-line-firm bg-raised p-2.5',
              'text-[0.8125rem] text-muted sm:col-span-3',
              'file:mr-3 file:rounded-ctl file:border file:border-line-firm file:bg-surface',
              'file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-medium file:text-ink',
            )}
          />
          <Button type="submit" dang="chinh" disabled={dangXem} className="sm:col-span-3">
            {dangXem ? 'Đang đọc file…' : 'Xem trước'}
          </Button>
        </form>

        <p className="text-[0.75rem] leading-relaxed text-faint">
          Cột bắt buộc: <b className="text-muted">Mã căn</b> và{' '}
          <b className="text-muted">Chỉ số mới</b>. Cột{' '}
          <b className="text-muted">Chỉ số cũ</b> không bắt buộc — thiếu thì hệ
          thống lấy chỉ số cuối kỳ trước. Có mà lệch với sổ thì dừng lại hỏi,
          không tự chọn bên nào: công tơ vừa thay và đọc nhầm đồng hồ là hai
          chuyện khác hẳn nhau.
        </p>

        {state.phase === 'preview' && (
          <div className="space-y-4 border-t border-line pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat nhan="Dòng nhận được" so={state.ok.length} tone={state.ok.length ? 'tot' : 'trung'} />
              <Stat nhan="Dòng lỗi" so={state.issues.length} tone={state.issues.length ? 'xau' : 'tot'} />
              <Stat nhan="Dòng trống bỏ qua" so={state.skippedBlank} />
              <Stat
                nhan="Căn file không nhắc" so={state.thieu.length}
                tone={state.thieu.length ? 'canh' : 'tot'}
                phu={state.thieu.length ? 'Kỳ này sẽ không có dòng điện/nước' : 'Đủ cả tòa'}
              />
            </div>

            {state.issues.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-card border border-line">
                <Bang>
                  <thead className="sticky top-0 z-10">
                    <tr><Th>Dòng</Th><Th>Cột</Th><Th>Vấn đề</Th></tr>
                  </thead>
                  <tbody>
                    {state.issues.map((i, n) => (
                      <Tr key={n}>
                        <Td so className="font-medium text-ink">{i.row}</Td>
                        <Td className="text-muted">{i.column}</Td>
                        <Td className="text-bad">{i.message}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Bang>
              </div>
            )}

            {/* Kể TÊN căn bị bỏ sót, không chỉ đếm. Con số 12 không giúp ai đi
                tìm 12 căn nào; danh sách thì cầm đi đọc lại công tơ được. */}
            {state.thieu.length > 0 && (
              <Hop tone="canh" title={`${state.thieu.length} căn không có trong file`}>
                <span className="num">{state.thieu.join(', ')}</span>
                <br /><br />
                Không phải lỗi — công tơ khoá cửa không đọc được là chuyện thường.
                Nhưng kỳ này những căn đó sẽ không có dòng điện/nước trên hóa đơn.
              </Hop>
            )}

            {state.ok.length > 0 && (
              <form action={doGhi} className="space-y-3">
                <input type="hidden" name="payload" value={JSON.stringify(state.ok)} />
                <input type="hidden" name="period" value={state.period} />
                <input type="hidden" name="fee_type_id" value={state.feeTypeId} />
                {state.issues.length > 0 && (
                  <Hop tone="canh" title="Chỉ ghi phần hợp lệ">
                    {state.ok.length} dòng sẽ được ghi, {state.issues.length} dòng
                    lỗi bị bỏ qua. Sửa trong Excel rồi tải lên lại phần còn thiếu.
                  </Hop>
                )}
                <Button type="submit" dang="chinh" disabled={dangGhi}>
                  {dangGhi ? 'Đang ghi…' : `Ghi ${state.ok.length} dòng vào kỳ ${state.period.slice(0, 7)}`}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
