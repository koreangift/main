(function(){
'use strict';
const cfg=window.KG_CONFIG||{};
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl||'')&&!!cfg.publishableKey;
let session=null;
try{session=JSON.parse(sessionStorage.getItem('kg-session')||'null')}catch{}
function keep(value){session=value;try{if(value)sessionStorage.setItem('kg-session',JSON.stringify(value));else sessionStorage.removeItem('kg-session')}catch{}}
async function raw(path,{method='GET',body,token,file}={}){
 if(!configured)throw Error('상품 접수 서비스를 준비 중입니다. 아직 서버에 연결되지 않았습니다.');
 const headers={apikey:cfg.publishableKey};
 if(token)headers.Authorization='Bearer '+token;
 if(file)headers['Content-Type']=file.type;else if(body!==undefined)headers['Content-Type']='application/json';
 const response=await fetch(cfg.supabaseUrl+path,{method,headers,body:file|| (body===undefined?undefined:JSON.stringify(body))});
 const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{data=null}
 if(!response.ok){if(response.status===401)throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');if(response.status===403)throw Error('이 작업을 수행할 권한이 없습니다.');if(response.status===429)throw Error('요청이 많습니다. 잠시 후 다시 시도해 주세요.');throw Error('요청을 처리하지 못했습니다. 입력 내용과 서비스 연결을 확인해 주세요.');}
 return data;
}
let refreshing;
async function token(){
 if(!session)throw Error('로그인이 필요합니다.');
 if(session.expires_at*1000<Date.now()+60000){
  if(!refreshing)refreshing=raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}}).then(s=>{keep(s);return s.access_token}).catch(e=>{keep(null);throw e}).finally(()=>{refreshing=null});
  return refreshing;
 }
 return session.access_token;
}
async function request(path,options={}){return raw(path,{...options,token:await token()})}
function validFile(file){if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPG, PNG, WebP 이미지를 선택해 주세요.');if(file.size>5*1024*1024)throw Error('이미지는 5MB 이하로 등록해 주세요.');}
async function upload(file,bucket,folder){
 validFile(file);const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];const path=folder+'/'+crypto.randomUUID()+'.'+ext;
 await request('/storage/v1/object/'+bucket+'/'+path,{method:'POST',file});return path;
}
async function signed(path){const r=await request('/storage/v1/object/sign/kg-submissions/'+path,{method:'POST',body:{expiresIn:600}});return r.signedURL.startsWith('https://')?r.signedURL:cfg.supabaseUrl+'/storage/v1'+r.signedURL}
function publicUrl(path){return cfg.supabaseUrl+'/storage/v1/object/public/kg-products/'+path}
window.KG={
 configured,raw,request,upload,signed,publicUrl,validFile,
 user:()=>session?.user,
 signIn:async(email,password)=>{const s=await raw('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});keep(s);return s.user},
 signUp:async(email,password)=>{const s=await raw('/auth/v1/signup',{method:'POST',body:{email,password}});if(s.access_token)keep(s);return !!s.access_token},
 signOut:async()=>{try{if(session)await request('/auth/v1/logout',{method:'POST'})}finally{keep(null)}},
 isAdmin:()=>request('/rest/v1/rpc/kg_is_admin',{method:'POST',body:{}}),
 products:()=>raw('/rest/v1/kg_products?select=id,name,name_en,description,description_en,specs,specs_en,price_krw,image_path&order=published_at.desc'),
 submit:async(data,file)=>{const uid=session?.user?.id;if(!uid)throw Error('로그인이 필요합니다.');const id=crypto.randomUUID();const image_path=await upload(file,'kg-submissions',uid+'/'+id);await request('/rest/v1/kg_submissions',{method:'POST',body:{...data,id,owner_id:uid,image_path}});return id},
 submissions:()=>request('/rest/v1/kg_submissions?select=*&order=created_at.desc'),
 mine:()=>request('/rest/v1/kg_submissions?select=id,name,status,created_at&order=created_at.desc'),
 save:async(id,fields)=>request('/rest/v1/kg_submissions?id=eq.'+id,{method:'PATCH',body:fields}),
 approve:async(id)=>request('/rest/v1/rpc/kg_approve',{method:'POST',body:{submission_id:id}}),
 reject:async(id)=>request('/rest/v1/rpc/kg_reject',{method:'POST',body:{submission_id:id}}),
 unpublish:async(id)=>request('/rest/v1/rpc/kg_unpublish',{method:'POST',body:{submission_id:id}})
};
})();