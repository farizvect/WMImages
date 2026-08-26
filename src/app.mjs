import { clamp, getContainRect, getWatermarkRect, resolvePosition, buildStyleLayout, makeExportName, scaleForCanvas, normalizeStyle, parseWatermarkLines, resolveStyleRotation } from './editor-core.mjs';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const els = Object.fromEntries(['imageInput','logoInput','dropzone','clearButton','resetButton','downloadButton','watermarkText','fontFamily','fontSize','color','colorValue','fontWeight','opacity','opacityOut','rotation','rotationOut','format','exportScale','quality','qualityOut','logoScale','logoScaleOut','logoInfo','imageMeta','zoomMeta','stageWrap','toast','positionControls','rotationControls','rowGap','rowGapOut','patternGap','patternGapOut'].map(id => [id,$(id)]));
const defaults = { mode:'text', position:'center', customPosition:null, opacity:72, rotation:0, style:'single', rowGap:24, patternGap:60 };
const state = { ...defaults, source:null, sourceName:'image', logo:null, logoName:'', dragging:false };
const styleButtons = [...document.querySelectorAll('.style-option')];
const STYLE_LABELS = { single:'drag watermark', tiled:'pola otomatis', rows:'baris teks penuh', bands:'jalur diagonal', dense:'grid rapat' };
const onboarding = $('onboarding');
const onboardingClose = $('onboardingClose');
const onboardingStart = $('onboardingStart');
const onboardingNext = $('onboardingNext');
const onboardingBack = $('onboardingBack');
const onboardingProgress = $('onboardingProgress');
const onboardingSlides = [...document.querySelectorAll('.onboarding-slide')];
const onboardingDots = [...document.querySelectorAll('.onboarding-dot')];
const ONBOARDING_KEY = 'mw-images-onboarding-seen';
let onboardingStep = 0;

function closeOnboarding(){ onboarding.hidden=true; localStorage.setItem(ONBOARDING_KEY,'1'); }
function showOnboardingStep(step){
  onboardingStep=Math.max(0,Math.min(3,step));
  onboardingSlides.forEach((slide,i)=>slide.classList.toggle('active',i===onboardingStep));
  onboardingDots.forEach((dot,i)=>dot.classList.toggle('active',i===onboardingStep));
  onboardingProgress.textContent=`Step ${onboardingStep+1} dari 4`;
  onboardingBack.hidden=onboardingStep===0;
  onboardingNext.hidden=onboardingStep===3;
  onboardingStart.hidden=onboardingStep!==3;
}
function initOnboarding(){
  if(localStorage.getItem(ONBOARDING_KEY)!=='1') onboarding.hidden=false;
  onboardingClose.addEventListener('click', closeOnboarding);
  onboardingStart.addEventListener('click', closeOnboarding);
  onboardingNext.addEventListener('click', ()=>showOnboardingStep(onboardingStep+1));
  onboardingBack.addEventListener('click', ()=>showOnboardingStep(onboardingStep-1));
  onboardingDots.forEach(dot=>dot.addEventListener('click',()=>showOnboardingStep(Number(dot.dataset.onboardingDot))));
  onboarding.addEventListener('click', e=>{ if(e.target===onboarding) closeOnboarding(); });
  showOnboardingStep(0);
}

function showToast(message){ els.toast.textContent=message; els.toast.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>els.toast.classList.remove('show'),1800); }
function loadImage(file){ return new Promise((resolve,reject)=>{ const url=URL.createObjectURL(file); const img=new Image(); img.onload=()=>{URL.revokeObjectURL(url);resolve(img)}; img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('File gambar tidak valid'))}; img.src=url; }); }
function setValue(id,value){ els[id].value=String(value); els[id].dispatchEvent(new Event('input')); }

async function acceptSource(file){
  if(!file?.type.startsWith('image/')) return showToast('Pilih file gambar yang valid');
  try{ state.source=await loadImage(file); state.sourceName=file.name; state.customPosition=null; els.dropzone.classList.add('hidden'); els.clearButton.disabled=false; els.downloadButton.disabled=false; els.imageMeta.textContent=`${file.name} · ${state.source.naturalWidth}×${state.source.naturalHeight}`; resizePreview(); showToast('Gambar siap diedit'); }catch(e){showToast(e.message)}
}
async function acceptLogo(file){
  if(!file?.type.startsWith('image/')) return showToast('Pilih file logo yang valid');
  try{ state.logo=await loadImage(file); state.logoName=file.name; els.logoInfo.textContent=`${file.name} · ${state.logo.naturalWidth}×${state.logo.naturalHeight}`; state.mode='image'; setTab('image'); render(); }catch(e){showToast(e.message)}
}

function watermarkLines(){ return state.mode==='image' ? [' '] : parseWatermarkLines(els.watermarkText.value); }
function joinedLine(){ return watermarkLines().join(' · '); }
function textForStyle(){ return state.style==='rows' ? watermarkLines() : [joinedLine()]; }
function baseFontSize(){ return scaleForCanvas(Number(els.fontSize.value), canvas.width); }
function markMetrics(renderCtx=ctx, lines=textForStyle()){
  if(state.mode==='image' && state.logo){ const maxWidth=canvas.width*(Number(els.logoScale.value)/100); const scale=maxWidth/state.logo.naturalWidth; return getWatermarkRect({type:'image',imageWidth:state.logo.naturalWidth,imageHeight:state.logo.naturalHeight,scale}); }
  const fs=baseFontSize(), pad=Math.max(5,fs*.18); renderCtx.font=`${els.fontWeight.value} ${fs}px ${els.fontFamily.value}`; const widths=lines.map(l=>renderCtx.measureText(l||' ').width);
  return { width: Math.max(...widths)+pad*2, height: fs+pad*2 };
}
function currentPosition(mark){
  if(state.customPosition) return {x:state.customPosition.x*canvas.width,y:state.customPosition.y*canvas.height};
  return resolvePosition(state.position,{width:canvas.width,height:canvas.height},mark,Math.max(18,canvas.width*.025));
}
function drawMark(drawCtx,x,y,mark,textOverride=null,rotationOverride=null){
  drawCtx.save(); drawCtx.globalAlpha=Number(els.opacity.value)/100; drawCtx.translate(x+mark.width/2,y+mark.height/2); drawCtx.rotate((rotationOverride??Number(els.rotation.value))*Math.PI/180);
  if(state.mode==='image' && state.logo){ drawCtx.drawImage(state.logo,-mark.width/2,-mark.height/2,mark.width,mark.height); }
  else { const fs=baseFontSize(), pad=Math.max(5,fs*.18); drawCtx.font=`${els.fontWeight.value} ${fs}px ${els.fontFamily.value}`; drawCtx.textAlign='left'; drawCtx.textBaseline='top'; drawCtx.fillStyle=els.color.value; drawCtx.shadowColor='rgba(0,0,0,.28)'; drawCtx.shadowBlur=Math.max(2,fs*.08); drawCtx.fillText(textOverride??joinedLine(),-mark.width/2+pad,-mark.height/2+pad); }
  drawCtx.restore();
}
function drawScene(drawCtx=ctx){
  drawCtx.clearRect(0,0,canvas.width,canvas.height); if(!state.source)return;
  drawCtx.drawImage(state.source,0,0,canvas.width,canvas.height);
  if(state.mode==='image'&&!state.logo)return;
  const lines=textForStyle(), mark=markMetrics(drawCtx,lines), style=state.style;
  if(style==='single'){ const p=currentPosition(mark); drawMark(drawCtx,p.x,p.y,mark,lines[0]); }
  else {
    const fraction=Number(els.patternGap.value)/100;
    const rotation=resolveStyleRotation(style, Number(els.rotation.value));
    const layout=buildStyleLayout({
      style, width:canvas.width, height:canvas.height, markWidth:mark.width, markHeight:mark.height, lines,
      gap:style==='bands' ? mark.height*fraction : Number(els.rowGap.value),
      rotation,
    });
    layout.forEach(item=>drawMark(drawCtx,item.x,item.y,mark,item.text??lines[0],item.rotation));
  }
}
function render(){ requestAnimationFrame(()=>drawScene()); }
function resizePreview(){
  if(!state.source)return; const box=els.stageWrap.getBoundingClientRect(); const rect=getContainRect(state.source.naturalWidth,state.source.naturalHeight,box.width,box.height); const dpr=Math.min(devicePixelRatio||1,2); canvas.width=Math.max(1,Math.round(rect.width*dpr)); canvas.height=Math.max(1,Math.round(rect.height*dpr)); canvas.style.width=`${rect.width}px`;canvas.style.height=`${rect.height}px`; els.zoomMeta.textContent=`Preview ${Math.round(rect.scale*100)}% · ${state.style==='single'?'drag watermark':STYLE_LABELS[state.style]}`; render();
}
function setTab(mode){ state.mode=mode; document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===mode)); $('textPanel').classList.toggle('active',mode==='text'); $('imagePanel').classList.toggle('active',mode==='image'); render(); }
function setStyle(style){
  state.style=normalizeStyle(style); styleButtons.forEach(b=>b.classList.toggle('active',b.dataset.style===state.style));
  els.positionControls.hidden=state.style!=='single';
  els.rotationControls.hidden=!['single','bands'].includes(state.style);
  els.rowGap.closest('.context-control').hidden=state.style!=='rows';
  els.patternGap.closest('.context-control').hidden=state.style!=='bands';
  if(state.source) els.zoomMeta.textContent=`${els.zoomMeta.textContent.split('·')[0].trim()} · ${state.style==='single'?'drag watermark':STYLE_LABELS[state.style]}`;
  render();
}
function reset(){ Object.assign(state,defaults); setTab('text'); els.watermarkText.value='© MW IMAGES'; els.fontFamily.selectedIndex=0; els.fontWeight.value='600'; els.color.value='#ffffff'; els.colorValue.value='#FFFFFF'; els.rowGap.value=24; els.rowGapOut.value='24'; els.patternGap.value=60; els.patternGapOut.value='60'; setValue('fontSize',54); setValue('opacity',72); setValue('rotation',0); setValue('logoScale',25); document.querySelectorAll('[data-position]').forEach(b=>b.classList.toggle('active',b.dataset.position==='center')); setStyle('single'); render(); }
function clear(){ state.source=null;state.sourceName='image';state.customPosition=null;ctx.clearRect(0,0,canvas.width,canvas.height);canvas.width=300;canvas.height=150;canvas.style.width='';canvas.style.height='';els.dropzone.classList.remove('hidden');els.clearButton.disabled=true;els.downloadButton.disabled=true;els.imageMeta.textContent='Belum ada gambar';els.zoomMeta.textContent='Preview otomatis';els.imageInput.value=''; }
function pointerPoint(e){ const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(canvas.width/r.width),y:(e.clientY-r.top)*(canvas.height/r.height)}; }
function canDragAt(e){ if(!state.source||state.style!=='single'||(state.mode==='image'&&!state.logo))return false; const p=pointerPoint(e),m=markMetrics(),pos=currentPosition(m); return p.x>=pos.x&&p.x<=pos.x+m.width&&p.y>=pos.y&&p.y<=pos.y+m.height; }
function exportImage(){
  if(!state.source)return;
  const old={w:canvas.width,h:canvas.height,sw:canvas.style.width,sh:canvas.style.height};
  const scale=Number(els.exportScale.value)/100;
  const format=els.format.value,quality=Number(els.quality.value)/100;
  canvas.width=Math.max(1,Math.round(state.source.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(state.source.naturalHeight*scale));
  drawScene();
  canvas.toBlob(blob=>{
    if(!blob){showToast('Format tidak didukung browser');return}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=makeExportName(state.sourceName,format);a.click();
    showToast(`${(blob.size/1024/1024).toFixed(2)} MB · ${canvas.width}×${canvas.height}`);
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    canvas.width=old.w;canvas.height=old.h;canvas.style.width=old.sw;canvas.style.height=old.sh;drawScene();
  },`image/${format}`,quality);
}

els.imageInput.addEventListener('change',e=>acceptSource(e.target.files[0])); els.logoInput.addEventListener('change',e=>acceptLogo(e.target.files[0]));
['dragenter','dragover'].forEach(type=>els.dropzone.addEventListener(type,e=>{e.preventDefault();els.dropzone.classList.add('drag')}));['dragleave','drop'].forEach(type=>els.dropzone.addEventListener(type,e=>{e.preventDefault();els.dropzone.classList.remove('drag')}));els.dropzone.addEventListener('drop',e=>acceptSource(e.dataTransfer.files[0]));
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));document.querySelectorAll('[data-position]').forEach(b=>b.addEventListener('click',()=>{state.position=b.dataset.position;state.customPosition=null;document.querySelectorAll('[data-position]').forEach(x=>x.classList.toggle('active',x===b));render()}));
styleButtons.forEach(b=>b.addEventListener('click',()=>setStyle(b.dataset.style)));
['watermarkText','fontFamily','fontSize','color','fontWeight','opacity','rotation','logoScale','rowGap','patternGap'].forEach(id=>els[id].addEventListener('input',()=>{els.opacityOut.value=`${els.opacity.value}%`;els.rotationOut.value=`${els.rotation.value}°`;els.logoScaleOut.value=`${els.logoScale.value}%`;els.colorValue.value=els.color.value.toUpperCase();els.rowGapOut.value=els.rowGap.value;els.patternGapOut.value=`${els.patternGap.value}%`;render()}));els.quality.addEventListener('input',()=>els.qualityOut.value=`${els.quality.value}%`);els.clearButton.addEventListener('click',clear);els.resetButton.addEventListener('click',reset);els.downloadButton.addEventListener('click',exportImage);window.addEventListener('resize',()=>state.source&&resizePreview());
canvas.addEventListener('pointerdown',e=>{if(canDragAt(e)){state.dragging=true;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing'}});canvas.addEventListener('pointermove',e=>{if(!state.source)return;if(state.dragging){const p=pointerPoint(e),m=markMetrics();state.customPosition={x:clamp(p.x-m.width/2,0,canvas.width-m.width)/canvas.width,y:clamp(p.y-m.height/2,0,canvas.height-m.height)/canvas.height};render()}else canvas.style.cursor=canDragAt(e)?'grab':'default'});canvas.addEventListener('pointerup',e=>{state.dragging=false;canvas.style.cursor='default';try{canvas.releasePointerCapture(e.pointerId)}catch{}});
initOnboarding();
reset();
