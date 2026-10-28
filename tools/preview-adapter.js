(async function(){
  const sources=await Promise.all(['/template','/style','/sudoku','/storage','/page'].map(p=>fetch(p).then(r=>r.text())));
  const css=sources[1].replace(/(-?[\d.]+)rpx/g,'calc($1 * var(--rpx))').replace(/^page\s*\{/,'#root{').replace(/\bview(?=[{, >])/g,'div').replace(/\btext(?=[{, >])/g,'span');
  document.getElementById('wxss').textContent=css;
  const xml=new DOMParser().parseFromString('<root xmlns:wx="urn:wx">'+sources[0].replace(/&/g,'&amp;').replace(/wx:else(?=[\s>])/g,'wx:else=""')+'</root>','application/xml');
  if(xml.querySelector('parsererror'))throw Error(xml.querySelector('parsererror').textContent);
  const modules={};let page,scheduled=false,lastView;
  window.wx={
    getStorageSync:k=>JSON.parse(localStorage.getItem('preview:'+k)||'null'),
    setStorageSync:(k,v)=>localStorage.setItem('preview:'+k,JSON.stringify(v)),
    setNavigationBarTitle:o=>{document.title=o.title;},
    showToast:o=>{const el=document.createElement('div');el.textContent=o.title;el.style='position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#283e34;color:white;padding:16px 24px;border-radius:16px;z-index:10;font:14px sans-serif;max-width:85vw';document.body.append(el);setTimeout(()=>el.remove(),2200);},
    showModal:o=>o.success({confirm:window.confirm(o.title+'\n\n'+o.content)}),
    showLoading:()=>{},hideLoading:()=>{},vibrateShort:()=>{}
  };
  function loadModule(name,src){const module={exports:{}};new Function('module','exports','require',src)(module,module.exports,p=>modules[p.split('/').pop()]);modules[name]=module.exports;}
  loadModule('sudoku',sources[2]);loadModule('storage',sources[3]);
  window.Page=config=>{page=config;page.data=JSON.parse(JSON.stringify(config.data));page.setData=function(update){Object.assign(page.data,update);if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;render();});}};};
  new Function('require',sources[4])(p=>modules[p.split('/').pop()]);
  const expressionCache=new Map();
  function evaluate(expr,scope){try{if(!expressionCache.has(expr))expressionCache.set(expr,new Function('scope','with(scope){return ('+expr+');}'));return expressionCache.get(expr)(scope);}catch(e){console.error('Template expression:',expr,e);return '';}}
  function value(raw,scope){const match=raw.match(/^\{\{((?:(?!\}\})[\s\S])*)\}\}$/);if(match)return evaluate(match[1],scope);return raw.replace(/\{\{([\s\S]*?)\}\}/g,(_,exp)=>String(evaluate(exp,scope)??''));}
  function renderChildren(parent,scope,target){
    let chain=false;
    for(const child of parent.childNodes){
      if(child.nodeType===3){const txt=value(child.textContent,scope);if(String(txt).trim() || child.textContent.includes('{{'))target.append(document.createTextNode(txt));continue;}
      if(child.nodeType!==1)continue;
      if(child.hasAttribute('wx:if')){chain=!!value(child.getAttribute('wx:if'),scope);if(!chain)continue;}
      else if(child.hasAttribute('wx:elif')){if(chain)continue;chain=!!value(child.getAttribute('wx:elif'),scope);if(!chain)continue;}
      else if(child.hasAttribute('wx:else')){if(chain)continue;chain=true;}
      else chain=false;
      if(child.hasAttribute('wx:for')){
        const arr=value(child.getAttribute('wx:for'),scope)||[];
        arr.forEach((item,index)=>{const nested=Object.assign({},scope);nested[child.getAttribute('wx:for-item')||'item']=item;nested[child.getAttribute('wx:for-index')||'index']=index;renderElement(child,nested,target);});
      }else renderElement(child,scope,target);
    }
  }
  function renderElement(node,scope,target){
    const tag=node.tagName, el=document.createElement(tag==='text'?'span':tag==='view'?'div':tag==='switch'?'input':tag);
    for(const attr of node.attributes){
      if(attr.name.startsWith('wx:')||attr.name.startsWith('bind'))continue;
      const val=value(attr.value,scope);
      if(attr.name==='disabled'){el.disabled=!!val;continue;}
      if(attr.name==='checked'){el.checked=!!val;continue;}
      el.setAttribute(attr.name,String(val));
    }
    if(tag==='switch')el.type='checkbox';
    for(const [attribute,eventName] of [['bindtap','click'],['bindchange','change']])if(node.hasAttribute(attribute)){
      const method=node.getAttribute(attribute);
      el.addEventListener(eventName,event=>{event.stopPropagation();page[method]({currentTarget:{dataset:el.dataset},detail:{value:el.checked}});});
    }
    renderChildren(node,scope,el);target.append(el);
  }
  function render(){const screen=document.getElementById('screen'),frag=document.createDocumentFragment();renderChildren(xml.documentElement,page.data,frag);screen.replaceChildren(frag);if(lastView!==page.data.view){window.scrollTo(0,0);lastView=page.data.view;}}
  document.addEventListener('visibilitychange',()=>document.hidden?page.onHide():page.onShow());
  window.addEventListener('pagehide',()=>page.onHide());
  page.onLoad();render();
})().catch(error=>{document.getElementById('screen').textContent=error.stack;console.error(error);});
