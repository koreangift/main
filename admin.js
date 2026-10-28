(function(){
'use strict';
const $=s=>document.querySelector(s),msg=$('#message'),form=$('#editor');let selected=null,rows=[],busy=false,previewUrl=null,dirty=false;
function message(text,error=false){msg.textContent=text;msg.classList.toggle('error',error)}
const statuses={pending:'검토 대기',approved:'승인·공개',rejected:'반려',unpublished:'공개 중지'};
if(!KG.configured){message('상품 관리 서비스가 아직 연결되지 않았습니다. 연결 후 운영자 로그인을 사용할 수 있습니다.');$('#auth-form').querySelectorAll('input,button').forEach(e=>e.disabled=true);return}
async function load(){
 rows=await KG.submissions();const target=$('#requests');target.replaceChildren();
 if(!rows.length)target.textContent='접수된 상품이 없습니다.';
 for(const row of rows){const b=document.createElement('button');b.type='button';b.className='request-item';b.textContent=(statuses[row.status]||row.status)+' · '+row.name+' · '+row.manufacturer;b.setAttribute('aria-pressed',String(selected?.id===row.id));b.addEventListener('click',()=>{if(busy)return;if(dirty&&!confirm('저장하지 않은 변경 내용을 버리고 다른 상품을 열까요?'))return;select(row).catch(e=>message(e.message,true))});target.append(b)}
}
async function select(row){
 selected=row;dirty=false;form.reset();$('#editor-panel').hidden=false;$('#editor-title').textContent=row.name+' · '+statuses[row.status];
 $('#private-details').textContent=row.manufacturer+' / '+row.contact_name+' / '+row.contact_email+(row.contact_phone?' / '+row.contact_phone:'');
 for(const key of ['name','price_krw','description','specs','name_en','description_en','specs_en'])form.elements[key].value=row[key]||'';
 form.elements.publish_en.checked=true;$('#editor-image').src=await KG.signed(row.image_path);
 $('#unpublish').disabled=row.status!=='approved';await load();
}
async function account(){
 if(!KG.user())return;
 if(!await KG.isAdmin()){await KG.signOut();message('이 계정에는 운영자 권한이 없습니다.',true);return}
 $('#auth-panel').hidden=true;$('#admin-panel').hidden=false;message('검토할 상품을 선택해 주세요.');await load();
}
$('#auth-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button'),d=new FormData(f);b.disabled=true;try{await KG.signIn(d.get('email'),d.get('password'));f.reset();await account()}catch(err){message(err.message,true)}finally{b.disabled=false}});
$('#logout').addEventListener('click',async()=>{if(busy)return;if(dirty&&!confirm('변경 내용을 저장하지 않고 로그아웃할까요?'))return;try{await KG.signOut();location.reload()}catch(e){message(e.message,true)}});
$('#refresh').addEventListener('click',()=>{if(!busy)load().catch(e=>message(e.message,true))});
form.addEventListener('input',()=>dirty=true);window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
form.elements.image.addEventListener('change',e=>{if(previewUrl)URL.revokeObjectURL(previewUrl);const file=e.target.files[0];if(!file)return;try{KG.validFile(file);previewUrl=URL.createObjectURL(file);$('#editor-image').src=previewUrl}catch(err){e.target.value='';message(err.message,true)}});
async function save(){
 const d=new FormData(form),fields={};form.querySelector('fieldset').disabled=true;for(const key of ['name','description','specs','name_en','description_en','specs_en'])fields[key]=String(d.get(key)||'').trim();
 fields.price_krw=Number(d.get('price_krw'));fields.publish_en=true;
 if(!Number.isSafeInteger(fields.price_krw)||fields.price_krw<1||fields.price_krw>100000000)throw Error('가격을 확인해 주세요.');
 
 const file=d.get('image');if(file?.size)fields.image_path=await KG.upload(file,'kg-submissions',KG.user().id+'/'+selected.id);
 await KG.save(selected.id,fields);Object.assign(selected,fields);dirty=false;
}
async function act(action){
 if(busy||!selected)return;if((action==='approve'||action==='save')&&!form.reportValidity())return;
 if(action==='reject'&&!confirm('이 상품을 반려할까요? 공개 중인 상품은 내려갑니다.'))return;
 if(action==='unpublish'&&!confirm('이 상품의 공개를 중지할까요?'))return;
 busy=true;const fs=form.querySelector('fieldset');fs.disabled=true;
 try{
 // FormData excludes disabled controls, so collect/save before locking field inputs.
 fs.disabled=false;
 if(action==='save'||action==='approve')await save();
 if((action==='approve'||(action==='save'&&selected.status==='approved'))&&(!selected.name_en||!selected.description_en||!selected.specs_en))throw Error('승인·공개하려면 영문 상품명·소개·스펙을 모두 입력해 주세요.');
 fs.disabled=true;
 if(action==='approve'||(action==='save'&&selected.status==='approved')){
  const privatePath=selected.image_path;
  const response=await fetch(await KG.signed(privatePath));if(!response.ok)throw Error('원본 이미지를 불러오지 못했습니다.');
  const blob=await response.blob(),file=new File([blob],'product',{type:blob.type});
  const publicPath=await KG.upload(file,'kg-products',selected.id);
  await KG.save(selected.id,{approved_image_path:publicPath});
  await KG.approve(selected.id);
 }else if(action==='reject')await KG.reject(selected.id);else if(action==='unpublish')await KG.unpublish(selected.id);
 message(action==='save'?'수정 내용을 저장했습니다.':action==='approve'?'승인되었습니다. 홈페이지를 열거나 새로고침하면 상품이 표시됩니다.':action==='reject'?'반려 처리했습니다.':'공개를 중지했습니다.');
 dirty=false;const id=selected.id;await load();const fresh=rows.find(r=>r.id===id);if(fresh)await select(fresh);
 }catch(err){message(err.message,true)}finally{fs.disabled=false;busy=false}
}
form.addEventListener('submit',e=>{e.preventDefault();act('save')});
for(const action of ['approve','reject','unpublish'])$('#'+action).addEventListener('click',()=>act(action));
account().catch(e=>message(e.message,true));
})();