document.documentElement.classList.add('js-ready');
/* NEXORA site interactions */
const menuButton=document.querySelector('.menu-toggle');
const siteNav=document.querySelector('.site-nav');
if(menuButton&&siteNav){
  const closeMenu=({restoreFocus=false}={})=>{
    siteNav.classList.remove('open');
    menuButton.setAttribute('aria-expanded','false');
    menuButton.setAttribute('aria-label','Ouvrir le menu');
    if(restoreFocus)menuButton.focus();
  };
  menuButton.addEventListener('click',()=>{
    const open=siteNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded',String(open));
    menuButton.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');
  });
  siteNav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>closeMenu()));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&siteNav.classList.contains('open'))closeMenu({restoreFocus:true});
  });
  document.addEventListener('pointerdown',event=>{
    if(siteNav.classList.contains('open')&&!siteNav.contains(event.target)&&!menuButton.contains(event.target))closeMenu();
  });
  window.addEventListener('resize',()=>{
    if(window.matchMedia('(min-width: 951px)').matches)closeMenu();
  });
}
const currentPage=document.body.dataset.page;
const pageFiles={home:'index.html',expertise:'expertise.html',solutions:'solutions.html',architecture:'architecture.html',technologies:'technologies.html',company:'company.html',contact:'contact.html',lab:'lab.html'};
document.querySelectorAll('.site-nav a').forEach(link=>{
  const file=link.getAttribute('href')?.split('#')[0];
  if(file===pageFiles[currentPage])link.setAttribute('aria-current','page');
});
const revealItems=document.querySelectorAll('.reveal');
if('IntersectionObserver'in window){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
  }),{threshold:.12});
  revealItems.forEach(item=>observer.observe(item));
}else{revealItems.forEach(item=>item.classList.add('is-visible'));}
const architectureTabButtons=[...document.querySelectorAll('[data-tab]')];
function activateArchitectureTab(button,{focus=false}={}){
  const group=button.closest('[data-tabs]');
  if(!group)return;
  group.querySelectorAll('[data-tab]').forEach(tab=>{
    const active=tab===button;
    tab.setAttribute('aria-selected',String(active));
    tab.setAttribute('tabindex',active?'0':'-1');
  });
  group.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==button.dataset.tab);
  if(focus)button.focus();
}
architectureTabButtons.forEach((button,index)=>{
  button.addEventListener('click',()=>activateArchitectureTab(button));
  button.addEventListener('keydown',event=>{
    const group=button.closest('[data-tabs]');
    const tabs=[...group.querySelectorAll('[data-tab]')];
    const current=tabs.indexOf(button);
    let next=current;
    if(event.key==='ArrowRight')next=(current+1)%tabs.length;
    else if(event.key==='ArrowLeft')next=(current-1+tabs.length)%tabs.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=tabs.length-1;
    else return;
    event.preventDefault();
    activateArchitectureTab(tabs[next],{focus:true});
  });
  button.setAttribute('tabindex',button.getAttribute('aria-selected')==='true'?'0':'-1');
});
document.querySelectorAll('[data-faq]').forEach(button=>button.addEventListener('click',()=>{
  const answer=document.getElementById(button.getAttribute('aria-controls'));
  const expanded=button.getAttribute('aria-expanded')==='true';
  button.setAttribute('aria-expanded',String(!expanded));
  const icon=button.querySelector('span');
  if(icon)icon.textContent=expanded?'＋':'−';
  if(answer)answer.hidden=expanded;
}));
const contactForm=document.querySelector('#contact-form');
if(contactForm){
  const contactEmail='contact@nexora.example';
  contactForm.addEventListener('submit',event=>{
    event.preventDefault();
    if(!contactForm.reportValidity())return;
    const payload=Object.fromEntries(new FormData(contactForm).entries());
    const subject='NEXORA — '+payload.subject;
    const body=[
      'Nom : '+payload.name,
      'Adresse e-mail : '+payload.email,
      'Organisation : '+(payload.organization||'Non renseignée'),
      '',
      'Message :',
      payload.message
    ].join('\n');
    window.location.href='mailto:'+contactEmail+
      '?subject='+encodeURIComponent(subject)+
      '&body='+encodeURIComponent(body);
  });
}
