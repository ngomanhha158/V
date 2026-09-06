-- Ca "cả hệ thống chỉ có MỘT khu" của du_an_nhan_tien (§28).
--
-- Phải chạy trên schema CÒN TRẮNG, ngay sau schema.sql và TRƯỚC seed.sql:
-- mọi file test khác đều để lại dự án của nó, nên tới lượt test_nganhang.sql
-- thì trong bảng đã có cả chục khu và nhánh này không đời nào chạy tới.
--
-- Vì sao nhánh này đáng một file riêng: bản cài một khu đang chạy thật, và số
-- tài khoản của nó nằm ở biến môi trường chứ chưa có trong bảng. Bỏ nhánh này
-- là mọi khoản tiền về đều bị từ chối cho tới khi có người kịp khai — tức là
-- một bản deploy làm hỏng một hệ thống đang chạy đúng.
--
-- So bằng `is distinct from`, KHÔNG phải `<>`: hàm trả NULL khi từ chối, mà
-- `null <> x` ra NULL và `if NULL then` không chạy — bài test sẽ xanh kể cả
-- khi hàm hỏng hoàn toàn.

do $test$
declare
  p1 uuid := 'aaaaaaaa-0000-0000-0000-0000000f0001';
  p2 uuid := 'aaaaaaaa-0000-0000-0000-0000000f0002';
  n int;
begin
  select count(*) into n from projects;
  if n <> 0 then
    raise exception 'FAIL 0: file nay phai chay truoc seed.sql (dang co % du an)', n;
  end if;

  insert into projects (id, name) values (p1, 'Khu duy nhat');

  -- Chưa khai tài khoản: vẫn phải ra đúng khu đó.
  if du_an_nhan_tien(null) is distinct from p1 then
    raise exception 'FAIL 1: mot khu, chua khai tai khoan, ma khong ra khu do';
  end if;
  -- Số tài khoản lạ hoắc cũng vậy — một khu thì không có khu nào khác để nhầm.
  if du_an_nhan_tien('9999999999') is distinct from p1 then
    raise exception 'FAIL 1b: mot khu ma so tai khoan la lai khong ra khu do';
  end if;

  -- Khu thứ hai xuất hiện: từ đây KHÔNG được đoán nữa.
  insert into projects (id, name) values (p2, 'Khu thu hai');
  if du_an_nhan_tien(null) is not null then
    raise exception 'FAIL 2: co khu thu hai ma van doan — day la tien ghi nham so';
  end if;
  if du_an_nhan_tien('9999999999') is not null then
    raise exception 'FAIL 2b: so tai khoan khong thuoc khu nao ma van ra mot khu';
  end if;

  -- Dọn sạch: chưa có gì trỏ tới hai dự án này nên xóa được, và các file test
  -- sau phải thấy đúng cái database mà chúng vẫn thấy.
  delete from projects where id in (p1, p2);

  raise notice 'TEST MOT KHU PASSED — mot khu thi nhan, hai khu thi tha tu choi con hon doan';
end $test$;
