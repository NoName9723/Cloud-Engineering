const menuButton=document.querySelector('.menu-toggle');
const siteNav=document.querySelector('.site-nav');
if(menuButton&&siteNav){
  menuButton.addEventListener('click',()=>{
    const open=siteNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded',String(open));
    menuButton.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');
  });
  siteNav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
    siteNav.classList.remove('open');
    menuButton.setAttribute('aria-expanded','false');
  }));
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
}else{
  revealItems.forEach(item=>item.classList.add('is-visible'));
}

document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
  const group=button.closest('[data-tabs]');
  if(!group)return;
  group.querySelectorAll('[data-tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab===button)));
  group.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==button.dataset.tab);
}));

document.querySelectorAll('[data-faq]').forEach(button=>button.addEventListener('click',()=>{
  const answer=document.getElementById(button.getAttribute('aria-controls'));
  const expanded=button.getAttribute('aria-expanded')==='true';
  button.setAttribute('aria-expanded',String(!expanded));
  if(answer)answer.hidden=expanded;
}));

const contactForm=document.querySelector('#contact-form');
if(contactForm){
  contactForm.addEventListener('submit',event=>{
    event.preventDefault();
    if(!contactForm.reportValidity())return;
    const result=document.querySelector('#form-result');
    if(result){
      result.textContent='Formulaire validé. Cette version statique ne transmet pas les données : un service de formulaire ou un backend devra être connecté pour recevoir réellement votre demande.';
      result.classList.add('visible');
    }
    contactForm.reset();
  });
}

/* Cloud Lab: local educational capacity simulation. No real cloud resources are provisioned. */
const cloudSim=document.querySelector('#cloud-sim');
if(cloudSim){
  const missions=[
    {title:'API publique — montée soudaine',type:'PIC API',description:'Une campagne provoque un afflux de requêtes sur le point d’entrée public.',demand:6,readHeavy:false},
    {title:'Catalogue produit — trafic lecture',type:'TRAFIC LECTURE',description:'Les visiteurs consultent massivement un catalogue. Les mêmes données sont demandées de nombreuses fois.',demand:9,readHeavy:true},
    {title:'Traitement batch — exécution planifiée',type:'CHARGE DE CALCUL',description:'Un traitement planifié consomme des ressources pendant une fenêtre courte et prévisible.',demand:10,readHeavy:false},
    {title:'Trafic standard — période calme',type:'CHARGE NORMALE',description:'Le trafic revient à un niveau stable. Garder trop de ressources allumées coûte inutilement.',demand:4,readHeavy:false},
    {title:'Lancement produit — pic mondial',type:'PIC DE TRAFIC',description:'Un lancement attire beaucoup de visiteurs. Le cache peut réduire la pression sur les services applicatifs.',demand:12,readHeavy:true}
  ];
  const budget=42;
  const state={round:0,spent:0,results:[],evaluated:false};
  const $=id=>document.getElementById(id);
  const replicaRange=$('replica-range');
  const replicaValue=$('replica-value');
  const cacheToggle=$('cache-toggle');
  const autoscaleToggle=$('autoscale-toggle');
  const evaluateButton=$('lab-evaluate');
  const nextButton=$('lab-next');
  const restartButton=$('lab-restart');
  const resultPanel=$('lab-result');
  const summaryPanel=$('lab-summary');
  const warning=$('lab-budget-warning');

  function configuration(){
    const replicas=Number(replicaRange.value);
    const cache=cacheToggle.checked;
    const autoscaling=autoscaleToggle.checked;
    const mission=missions[state.round];
    const effectiveDemand=cache&&mission.readHeavy?Math.ceil(mission.demand*.65):mission.demand;
    const capacity=replicas*2+(autoscaling?2:0);
    const cost=replicas*2+(cache?1:0)+(autoscaling?2:0);
    return {replicas,cache,autoscaling,effectiveDemand,capacity,cost};
  }

  function updateEstimate(){
    const config=configuration();
    replicaValue.value=String(config.replicas);
    replicaValue.textContent=String(config.replicas);
    $('lab-capacity').textContent=config.capacity+' unités';
    $('lab-cost').textContent=config.cost+' crédits';
    $('lab-effective-demand').textContent=config.effectiveDemand+' unités';
    $('lab-remaining').textContent=String(budget-state.spent);
    $('lab-spent').textContent=String(state.spent);
    const canAfford=config.cost<=budget-state.spent;
    warning.hidden=canAfford;
    warning.textContent=canAfford?'':'Budget insuffisant pour cette configuration. Réduisez les ressources ou désactivez une option.';
    evaluateButton.disabled=!canAfford||state.evaluated;
    evaluateButton.style.opacity=evaluateButton.disabled?'.55':'1';
    evaluateButton.style.cursor=evaluateButton.disabled?'not-allowed':'pointer';
  }

  function renderMission(){
    const mission=missions[state.round];
    state.evaluated=false;
    $('lab-round').textContent='MISSION '+(state.round+1)+' / '+missions.length;
    $('lab-progress-fill').style.width=((state.round+1)/missions.length*100)+'%';
    $('lab-progress-label').textContent=Math.round((state.round+1)/missions.length*100)+' %';
    $('lab-scenario-title').textContent=mission.title;
    $('lab-scenario-description').textContent=mission.description;
    $('lab-scenario-type').textContent=mission.type;
    $('lab-demand').textContent=mission.demand+' unités';
    $('lab-traffic-type').textContent=mission.readHeavy?'Orienté lecture':'Mixte / calcul';
    replicaRange.value='3';
    cacheToggle.checked=false;
    autoscaleToggle.checked=false;
    [replicaRange,cacheToggle,autoscaleToggle].forEach(input=>input.disabled=false);
    resultPanel.hidden=true;
    nextButton.hidden=true;
    evaluateButton.hidden=false;
    summaryPanel.hidden=true;
    restartButton.hidden=true;
    updateEstimate();
  }

  function evaluateMission(){
    if(state.evaluated)return;
    const config=configuration();
    const remaining=budget-state.spent;
    if(config.cost>remaining){
      warning.hidden=false;
      warning.textContent='Il ne reste que '+remaining+' crédits. Réduisez le nombre d’instances ou désactivez une option.';
      return;
    }
    const availability=Math.min(100,Math.round(config.capacity/config.effectiveDemand*100));
    const stable=availability===100;
    state.spent+=config.cost;
    state.results.push({title:missions[state.round].title,availability,cost:config.cost,stable});
    state.evaluated=true;
    [replicaRange,cacheToggle,autoscaleToggle].forEach(input=>input.disabled=true);
    evaluateButton.hidden=true;
    nextButton.hidden=false;
    nextButton.textContent=state.round===missions.length-1?'Voir le bilan final →':'Mission suivante →';
    resultPanel.className='lab-result'+(stable?'':' result-fail');
    const advice=stable
      ?(config.cache&&!missions[state.round].readHeavy?'La capacité est suffisante, mais le cache ne réduit pas ce type de charge. Vous pouviez économiser un crédit.':'Bonne configuration : la capacité couvre la charge simulée.')
      :(config.cache&&!missions[state.round].readHeavy?'Le cache ne réduit pas une charge de calcul. Ajoutez des instances ou activez l’autoscaling.':'La capacité disponible est inférieure à la charge. Augmentez les instances ou activez l’autoscaling.');
    resultPanel.innerHTML='<h3>'+(stable?'Service stable':'Saturation détectée')+'</h3><p>'+advice+'</p><div class="lab-result-metrics"><div><small>DISPONIBILITÉ SIMULÉE</small><strong>'+availability+' %</strong></div><div><small>CAPACITÉ</small><strong>'+config.capacity+' / '+config.effectiveDemand+'</strong></div><div><small>COÛT</small><strong>'+config.cost+' crédits</strong></div></div>';
    resultPanel.hidden=false;
    $('lab-spent').textContent=String(state.spent);
    $('lab-remaining').textContent=String(budget-state.spent);
  }

  function finishSimulation(){
    const successes=state.results.filter(result=>result.stable).length;
    const average=Math.round(state.results.reduce((sum,result)=>sum+result.availability,0)/state.results.length);
    const grade=successes===missions.length?'Plateforme résiliente':average>=90?'Bonne base, optimisations nécessaires':'Capacité à revoir';
    const rows=state.results.map((result,index)=>'<div class="lab-summary-row"><span>'+(index+1)+'. '+result.title+'</span><span>'+result.availability+' % · '+result.cost+' crédits</span></div>').join('');
    summaryPanel.innerHTML='<h3>'+grade+'</h3><p>Disponibilité moyenne : <strong>'+average+' %</strong>. Missions stables : <strong>'+successes+'/'+missions.length+'</strong>. Budget restant : <strong>'+(budget-state.spent)+' crédits</strong>.</p><div class="lab-summary-list">'+rows+'</div>';
    summaryPanel.hidden=false;
    nextButton.hidden=true;
    restartButton.hidden=false;
    $('lab-scenario-title').textContent='Simulation terminée';
    $('lab-scenario-description').textContent='Votre bilan est disponible ci-dessous. Relancez une partie pour essayer une autre stratégie.';
    $('lab-demand').textContent='—';
    $('lab-traffic-type').textContent='Bilan final';
    $('lab-scenario-type').textContent='FIN DE SESSION';
    $('lab-round').textContent='TERMINÉ · 5 / 5';
    $('lab-progress-fill').style.width='100%';
    $('lab-progress-label').textContent='100 %';
    document.querySelector('.lab-config').hidden=true;
  }

  evaluateButton.addEventListener('click',evaluateMission);
  nextButton.addEventListener('click',()=>{
    if(state.round<missions.length-1){state.round++;renderMission();}
    else finishSimulation();
  });
  restartButton.addEventListener('click',()=>{
    state.round=0;state.spent=0;state.results=[];state.evaluated=false;
    document.querySelector('.lab-config').hidden=false;
    restartButton.hidden=true;
    renderMission();
  });
  [replicaRange,cacheToggle,autoscaleToggle].forEach(input=>input.addEventListener('input',updateEstimate));
  renderMission();
}
