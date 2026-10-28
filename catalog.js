(function(){
'use strict';
if(!window.KG?.configured)return;
const en=document.documentElement.lang==='en',section=document.createElement('section');
section.className='approved-products';section.hidden=true;
const title=document.createElement('h2');title.className='section-title';title.textContent=en?'Approved Maker Collection':'승인된 입점 상품';
const note=document.createElement('p');note.className='section-note';note.style.textAlign='left';note.textContent=en?'Products reviewed and approved by Korean Gift. Prices are in Korean won.':'Korean Gift가 검토하고 승인한 제조자 상품입니다. 판매 가격은 원화 기준입니다.';
const grid=document.createElement('div');grid.className='gallery';section.append(title,note,grid);document.querySelector('#gallery').append(section);
let fingerprint='',loading=false;
function text(tag,className,value){const el=document.createElement(tag);el.className=className;el.textContent=value;return el}
async function load(){
 if(loading||document.hidden)return;loading=true;
 try{
 const rows=await KG.products(),next=JSON.stringify(rows);if(next===fingerprint)return;fingerprint=next;grid.replaceChildren();section.hidden=rows.length===0;
 for(const row of rows){
 const name=en?row.name_en:row.name,desc=en?row.description_en:row.description,specs=en?row.specs_en:row.specs;
 const article=document.createElement('article');article.className='artwork';
 const button=document.createElement('button');button.className='image-button';button.type='button';button.setAttribute('aria-label',en?'View '+name:name+' 크게 보기');
 const img=document.createElement('img');img.src=KG.publicUrl(row.image_path);img.alt=name;img.loading='lazy';img.width=1024;img.height=1024;
 const hint=text('span','zoom-hint',en?'↗ View larger':'↗ 크게 보기');hint.setAttribute('aria-hidden','true');button.append(img,hint);
 button.addEventListener('click',()=>{const modal=document.querySelector('#image-modal');document.querySelector('#modal-image').src=img.src;document.querySelector('#modal-image').alt=name;document.querySelector('#modal-caption').textContent=name;if(typeof modal.showModal==='function')modal.showModal();else modal.setAttribute('open','')});
 const price=text('p','approved-price',new Intl.NumberFormat(en?'en-US':'ko-KR',{style:'currency',currency:'KRW',maximumFractionDigits:0}).format(row.price_krw));
 article.append(button,text('h3','',name),price,text('p','',desc),text('p','product-detail',specs));grid.append(article);
 }
 }catch{if(!section.hidden){note.textContent=en?'Updates are temporarily unavailable. Please refresh later.':'최신 상품 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.'}}
 finally{loading=false}
}
load();setInterval(load,60000);document.addEventListener('visibilitychange',load);
})();