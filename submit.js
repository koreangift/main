(function(){
'use strict';
const $=s=>document.querySelector(s),msg=$('#message');
function message(text,error=false){msg.textContent=text;msg.classList.toggle('error',error)}
const statuses={pending:'검토 대기',approved:'승인·공개',rejected:'반려',unpublished:'공개 중지'};
async function showAccount(){
 const user=KG.user();$('#auth-panel').hidden=!!user;$('#submission-panel').hidden=!user;$('#my-panel').hidden=!user;
 if(!user)return;$('#account').textContent=user.email;$('#submission-form [name="contact_email"]').value=user.email;
 const rows=await KG.mine();const target=$('#my-requests');target.replaceChildren();
 if(!rows.length)target.textContent='아직 신청한 상품이 없습니다.';
 for(const row of rows){const p=document.createElement('p');p.textContent=row.name+' · '+(statuses[row.status]||row.status)+' · '+new Date(row.created_at).toLocaleDateString('ko-KR');target.append(p)}
}
if(!KG.configured){message('상품 등록 접수는 준비 중입니다. 현재 입력 내용은 전송·접수되지 않습니다. 서비스 연결 후 신청할 수 있습니다.');document.querySelectorAll('form input,form button').forEach(el=>el.disabled=true);return}
message('로그인 후 상품을 의뢰해 주세요.');
async function auth(signup=false){
 const f=$('#auth-form');if(!f.reportValidity())return;const data=new FormData(f);const controls=[...f.querySelectorAll('button')];controls.forEach(b=>b.disabled=true);
 try{if(signup){const loggedIn=await KG.signUp(data.get('email'),data.get('password'));message(loggedIn?'가입되었습니다. 상품을 등록해 주세요.':'인증 메일을 확인한 후 로그인해 주세요.')}else{await KG.signIn(data.get('email'),data.get('password'));message('로그인되었습니다.')}
 f.reset();await showAccount();
 }catch(e){message(e.message,true)}finally{controls.forEach(b=>b.disabled=false)}
}
$('#auth-form').addEventListener('submit',e=>{e.preventDefault();auth()});$('#signup').addEventListener('click',()=>auth(true));
$('#logout').addEventListener('click',async()=>{try{await KG.signOut();location.reload()}catch(e){message(e.message,true)}});
let previewUrl;$('#submission-form [name="image"]').addEventListener('change',e=>{if(previewUrl)URL.revokeObjectURL(previewUrl);$('#image-preview').removeAttribute('src');const file=e.target.files[0];if(!file)return;try{KG.validFile(file);previewUrl=URL.createObjectURL(file);$('#image-preview').src=previewUrl}catch(err){e.target.value='';message(err.message,true)}});
$('#submission-form').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget,data=new FormData(form),fieldset=form.querySelector('fieldset');
 const fields={};for(const key of ['manufacturer','contact_name','contact_email','contact_phone','name','description','specs'])fields[key]=String(data.get(key)||'').trim();
 fields.price_krw=Number(data.get('price_krw'));
 if(!Number.isSafeInteger(fields.price_krw)||fields.price_krw<1||fields.price_krw>100000000){message('가격은 1원부터 1억 원까지의 정수로 입력해 주세요.',true);return}
 fieldset.disabled=true;message('이미지와 상품 정보를 전송하고 있습니다.');
 try{const id=await KG.submit({...fields,rights_confirmed:true,privacy_consent:true},data.get('image'));form.reset();$('#image-preview').removeAttribute('src');message('검토 의뢰가 접수되었습니다. 접수번호: '+id+' · 승인 후 컬렉션에 공개됩니다.');await showAccount()}
 catch(err){message(err.message+' 접수 완료 안내가 없으면 등록되지 않은 상태입니다.',true)}
 finally{fieldset.disabled=false}
});
showAccount().catch(e=>message(e.message,true));
})();