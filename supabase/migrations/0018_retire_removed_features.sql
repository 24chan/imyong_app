/* 0018: 없앤 기능(공부 자료 공유, 합격 인증·대학별 합격률)의 '쓰기' 통로 닫기
   - 표는 지우지 않음 (신고 처리 함수가 옛 글을 참조할 수 있어서). 새로 쓰기·올리기만 막음.
   - 남은 옛 내용까지 지우려면 맨 아래 주석 부분을 따로 실행 */
begin;

revoke execute on function public.create_material(text, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.update_material(bigint, text, text) from public, anon, authenticated;
revoke execute on function public.toggle_material_like(bigint) from public, anon, authenticated;
-- delete_material 은 남김 (글쓴이가 옛 자료를 지울 수 있게)

revoke execute on function public.request_pass_cert(int, text, text, text[]) from public, anon, authenticated;
drop policy if exists "합격 인증 사진 올리기" on storage.objects;

commit;

/* (선택) 옛 내용 완전 삭제 — 실행 전 꼭 확인
update public.materials set status = 'deleted' where status <> 'deleted';
delete from public.pass_certs;
*/
