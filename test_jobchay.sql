-- Nhật ký job nền. Chạy sau schema.sql.
--
-- Bảng này tồn tại để trả lời một câu duy nhất mà trước đây không ai trả lời
-- được: "job đó có thật sự chạy không". Nên phần phải test không phải là ghi
-- được hay không, mà là nó có GIỮ NỔI hai sự thật độc lập — từng chạy được, và
-- đang hỏng — qua những lần ghi đè xen kẽ nhau.

do $test$
declare
  r record;
  n int;
begin
  -- ── 1. Lần chạy đầu tiên: chưa có dòng nào thì tạo mới ──
  perform job_ghi_nhan('viec-thu', true, 7, 120, null);
  select * into r from job_chay where viec = 'viec-thu';
  if r.ok_luc is null or r.ok_so <> 7 or r.ok_ms <> 120 then
    raise exception 'FAIL 1: khong ghi duoc lan chay dau';
  end if;
  if r.loi_luc is not null or r.loi is not null then
    raise exception 'FAIL 1b: lan chay thanh cong ma van co loi';
  end if;

  -- ── 2. Một dòng cho mỗi job, không phải nhật ký dài dần ──
  -- Bảng lớn dần thì lại đẻ ra việc dọn, mà câu hỏi ở đây chỉ là "lần cuối".
  perform job_ghi_nhan('viec-thu', true, 9, 130, null);
  select count(*) into n from job_chay where viec = 'viec-thu';
  if n <> 1 then raise exception 'FAIL 2: chay hai lan sinh % dong', n; end if;
  select * into r from job_chay where viec = 'viec-thu';
  if r.ok_so <> 9 then raise exception 'FAIL 2b: khong ghi de so dong moi'; end if;

  -- ── 3. Lần LỖI không được xoá bằng chứng là job từng chạy được ──
  -- Gộp một cột thì một lần hỏng làm mất lịch sử, và màn go-live không phân
  -- biệt nổi "chưa bao giờ chạy" với "chạy được rồi mới hỏng" — hai tình
  -- trạng cần hai cách xử lý khác hẳn nhau.
  perform job_ghi_nhan('viec-thu', false, null, 40, 'Thieu VAPID_PUBLIC_KEY');
  select * into r from job_chay where viec = 'viec-thu';
  if r.ok_luc is null or r.ok_so <> 9 then
    raise exception 'FAIL 3: lan loi xoa mat lan chay thanh cong truoc do';
  end if;
  if r.loi_luc is null or r.loi <> 'Thieu VAPID_PUBLIC_KEY' then
    raise exception 'FAIL 3b: khong ghi lai duoc lan loi';
  end if;

  -- ── 4. Chạy lại được thì KHÔNG xoá lần lỗi ──
  -- Ngược chiều của assert 3. Giữ lại để người đọc thấy job này vừa mới hỏng
  -- xong, dù ngay lúc nhìn thì nó đang xanh.
  perform job_ghi_nhan('viec-thu', true, 3, 90, null);
  select * into r from job_chay where viec = 'viec-thu';
  if r.loi_luc is null or r.loi is null then
    raise exception 'FAIL 4: chay lai duoc xoa mat dau vet lan hong';
  end if;
  if r.ok_so <> 3 then raise exception 'FAIL 4b: khong cap nhat lan chay moi'; end if;

  -- ── 5. Thông điệp lỗi bị cắt, không nuốt cả stack trace ──
  -- Một dòng dài 20 nghìn ký tự trên màn hình BQL không giúp gì thêm, mà làm
  -- chính dòng đó không đọc nổi.
  perform job_ghi_nhan('viec-dai', false, null, 10, repeat('x', 5000));
  select length(loi) into n from job_chay where viec = 'viec-dai';
  if n <> 500 then raise exception 'FAIL 5: thong diep loi dai % ky tu', n; end if;

  -- ── 6. Job khác nhau nằm ở dòng khác nhau ──
  if (select count(*) from job_chay) <> 2 then
    raise exception 'FAIL 6: hai job khong tach thanh hai dong';
  end if;

  -- ── 7. Số dòng có thể là NULL và điều đó KHÁC với 0 ──
  -- Hàm SQL trả void (escalate_overdue_tickets) không nói được nó đụng bao
  -- nhiêu dòng. Ghi 0 vào đây là bịa ra một sự thật: "chạy mà không làm gì".
  perform job_ghi_nhan('viec-void', true, null, 15, null);
  select * into r from job_chay where viec = 'viec-void';
  if r.ok_so is not null then raise exception 'FAIL 7: bia ra so dong cho ham void'; end if;
  if r.ok_luc is null then raise exception 'FAIL 7b: khong ghi duoc lan chay ham void'; end if;

  delete from job_chay where viec in ('viec-thu', 'viec-dai', 'viec-void');

  raise notice 'TEST JOB_CHAY PASSED — mot dong moi job, lan OK va lan LOI khong xoa nhau';
end $test$;
