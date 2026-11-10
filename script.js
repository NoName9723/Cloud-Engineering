/* NEXORA site interactions */
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
}else{revealItems.forEach(item=>item.classList.add('is-visible'));}
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

/* Cloud Incident Lab: deterministic, local-only educational simulation. */
const campaignRoot=document.querySelector('#cloud-campaign');
if(campaignRoot){
  const STORAGE_KEY='nexora-cloud-incident-campaign-v3';
  const missions=[
    {
      id:'deployment',ticket:'INC-001',severity:'SEV-1 · CRITIQUE',title:'Déploiement API bloqué',
      summary:'Les pods ne deviennent pas Ready. Le service ne peut pas recevoir de trafic.',
      symptom:'Pods non disponibles',impact:'API indisponible',file:'k8s/deployment.yaml',language:'YAML',
      task:'Le sélecteur du Deployment ne correspond pas aux labels des pods. La sonde de disponibilité pointe aussi vers une mauvaise route.',
      hint:'Dans spec.selector.matchLabels, la valeur app doit être identique à spec.template.metadata.labels. Le readinessProbe doit interroger /health sur le port 8080.',
      initial:`apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexora-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nexora-edge
  template:
    metadata:
      labels:
        app: nexora-api
    spec:
      containers:
        - name: api
          image: ghcr.io/nexora/api:v1.4.2
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10`,
      diagnostics:{
        'kubectl get pods':'NAME                         READY   STATUS             RESTARTS\nnexora-api-7cdb9f6d9-x2m4p   0/1     Running            0\nnexora-api-7cdb9f6d9-k8n2r   0/1     Running            0\n\nLes conteneurs tournent, mais aucun pod ne passe Ready.',
        'kubectl describe deployment nexora-api':'Selector: app=nexora-edge\nPod template labels: app=nexora-api\nWarning: selector does not match template labels\nReadiness probe: GET /ready: 404 Not Found\nAvailable replicas: 0',
        'curl -I https://app.nexora.local':'HTTP/2 503\nserver: nexora-edge\nx-service-status: no-ready-upstream\n\nAucun pod sain n’est disponible pour recevoir le trafic.'
      },
      tests:[
        {name:'Structure Kubernetes reconnue',detail:'Le fichier décrit un Deployment apps/v1 nommé nexora-api.',check:c=>/apiVersion:\s*apps\/v1/.test(c)&&/kind:\s*Deployment/.test(c)&&/name:\s*nexora-api/.test(c)},
        {name:'Sélecteur et labels cohérents',detail:'selector.matchLabels et template.metadata.labels doivent porter la même valeur.',check:c=>{const s=c.match(/selector:\s*\n\s*matchLabels:\s*\n\s*app:\s*([\w-]+)/);const p=c.match(/template:\s*\n\s*metadata:\s*\n\s*labels:\s*\n\s*app:\s*([\w-]+)/);return !!(s&&p&&s[1]===p[1]&&s[1]==='nexora-api');}},
        {name:'Sonde de disponibilité correcte',detail:'Le endpoint HTTP /health doit être utilisé par le readinessProbe.',check:c=>/readinessProbe:[\s\S]*?httpGet:[\s\S]*?path:\s*\/health/.test(c)},
        {name:'Port applicatif exposé',detail:'Le conteneur API écoute sur le port 8080 et possède au moins deux réplicas.',check:c=>/containerPort:\s*8080/.test(c)&&Number((c.match(/replicas:\s*(\d+)/)||[])[1]||0)>=2}
      ]
    },
    {
      id:'routing',ticket:'INC-002',severity:'SEV-1 · CRITIQUE',title:'Routage NGINX défaillant',
      summary:'Le proxy inverse ne résout plus le service API. Les requêtes publiques retournent une erreur 502.',
      symptom:'Upstream introuvable',impact:'Trafic HTTP interrompu',file:'nginx/nginx.conf',language:'NGINX',
      task:'Corrigez le nom de l’upstream, la cible du service interne et conservez un endpoint de santé qui retourne HTTP 200.',
      hint:'Le bloc upstream s’appelle nexora_api. Le service interne écoute sur api-service:8080. proxy_pass doit réutiliser le nom de l’upstream.',
      initial:`upstream nexora_api {
    server api-service:8081;
}
server {
    listen 80;
    server_name app.nexora.local;

    location / {
        proxy_pass http://nexora_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location = /health {
        return 503 "upstream unavailable";
    }
}`,
      diagnostics:{
        'kubectl get svc':'NAME           TYPE        CLUSTER-IP      PORT(S)\napi-service    ClusterIP   10.20.4.18      8080/TCP\nweb-gateway    ClusterIP   10.20.4.21      80/TCP\n\nLe Service API est présent et écoute sur 8080/TCP.',
        'nginx -t':'nginx: [emerg] host not found in upstream "nexora_backend"\nnginx: configuration file test failed\n\nLe nom référencé par proxy_pass ne correspond à aucun upstream déclaré.',
        'curl -I https://app.nexora.local':'HTTP/2 502\nserver: nginx\nx-error: upstream-resolution-failed\n\nLe proxy ne peut pas transmettre les requêtes au service API.'
      },
      tests:[
        {name:'Bloc upstream déclaré',detail:'Le fichier doit déclarer un upstream nommé nexora_api.',check:c=>/upstream\s+nexora_api\s*\{/.test(c)},
        {name:'Cible du service correcte',detail:'Le backend doit pointer vers api-service:8080.',check:c=>/server\s+api-service:8080\s*;/.test(c)},
        {name:'Proxy relié au bon upstream',detail:'Les requêtes applicatives doivent être transmises à http://nexora_api.',check:c=>/proxy_pass\s+http:\/\/nexora_api\s*;/.test(c)},
        {name:'Endpoint de santé rétabli',detail:'La route /health doit retourner le code HTTP 200.',check:c=>/location\s*=\s*\/health\s*\{[\s\S]*?return\s+200\b/.test(c)}
      ]
    },
    {
      id:'storage',ticket:'INC-003',severity:'SEV-2 · MAJEUR',title:'Stockage de sauvegarde non conforme',
      summary:'Le contrôle de sécurité signale des sauvegardes non chiffrées et une rétention insuffisante.',
      symptom:'Contrôles de stockage en échec',impact:'Risque de perte de données',file:'infra/storage.tf',language:'HCL / TERRAFORM',
      task:'Rétablissez le chiffrement côté serveur, la gestion de versions et une durée de conservation des journaux d’au moins 30 jours.',
      hint:'Pour un bucket S3, utilisez AES256 ou aws:kms. Le versioning doit avoir le statut Enabled. La règle lifecycle doit conserver les objets au moins 30 jours.',
      initial:`resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES128"
    }
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id

  versioning_configuration {
    status = "Suspended"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "log-retention"
    status = "Enabled"

    expiration {
      days = 7
    }
  }
}`,
      diagnostics:{
        'terraform plan':'Plan: 0 to add, 3 to change, 0 to destroy.\n\nWARNING: server-side encryption uses AES128.\nWARNING: bucket versioning is Suspended.\nWARNING: lifecycle retention is set to 7 days.\n\nSecurity policy: encryption, versioning and 30-day retention are required.',
        'terraform validate':'Error: storage policy validation failed\n- encryption algorithm does not meet policy\n- object versioning is disabled\n- log retention is below minimum',
        'status':'Storage control plane: DEGRADED\nBackup objects: writable\nEncryption policy: NON-COMPLIANT\nVersion history: INACTIVE'
      },
      tests:[
        {name:'Configuration de chiffrement présente',detail:'Une ressource de chiffrement côté serveur est définie pour le bucket logs.',check:c=>/aws_s3_bucket_server_side_encryption_configuration/.test(c)&&/aws_s3_bucket\.logs\.id/.test(c)},
        {name:'Algorithme de chiffrement conforme',detail:'L’algorithme doit être AES256 ou aws:kms.',check:c=>/sse_algorithm\s*=\s*"(AES256|aws:kms)"/.test(c)},
        {name:'Versioning activé',detail:'Le statut de versioning du bucket doit être Enabled.',check:c=>/versioning_configuration\s*\{[\s\S]*?status\s*=\s*"Enabled"/.test(c)},
        {name:'Rétention minimale respectée',detail:'La règle de cycle de vie doit conserver les journaux au moins 30 jours.',check:c=>{const m=c.match(/expiration\s*\{[\s\S]*?days\s*=\s*(\d+)/);return !!(m&&Number(m[1])>=30);}}
      ]
    },
    {
      id:'pipeline',ticket:'INC-004',severity:'SEV-2 · MAJEUR',title:'Pipeline de livraison désordonné',
      summary:'Le workflow de déploiement peut démarrer sans attendre la validation des tests.',
      symptom:'Garde-fou CI/CD absent',impact:'Risque de livraison défectueuse',file:'.github/workflows/deploy.yml',language:'YAML / GITHUB ACTIONS',
      task:'Faites exécuter npm ci et npm test dans le job test, puis imposez au job deploy d’attendre ce job avant toute publication sur main.',
      hint:'Dans GitHub Actions, ajoutez needs: test au job deploy. Le job test doit installer les dépendances avec npm ci et exécuter la commande npm test. Le workflow cible main.',
      initial:`name: NEXORA Production Delivery

on:
  push:
    branches: ["main"]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:unit

  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy application
        run: echo "Deploying NEXORA"`,
      diagnostics:{
        'cat .github/workflows/deploy.yml':'Workflow: NEXORA Production Delivery\nTrigger: push to main\nJob test: configured\nJob deploy: configured\nDependency graph: deploy has no needs relation\nTest command: npm run test:unit\n\nThe deploy job is not gated by the test job.',
        'npm test':'Local simulation: test runner not started.\nPipeline configuration indicates npm run test:unit.\nExpected package script: npm test.',
        'status':'CI/CD: DEGRADED\nBuild job: defined\nTest gate: INVALID\nProduction deployment gate: MISSING'
      },
      tests:[
        {name:'Déclenchement sur main',detail:'Le workflow doit cibler la branche main.',check:c=>/branches:\s*\[\s*["']main["']\s*\]/.test(c)},
        {name:'Installation reproductible',detail:'Le job de test doit installer les dépendances avec npm ci.',check:c=>/run:\s*npm ci\b/.test(c)},
        {name:'Tests applicatifs exécutés',detail:'Le job de test doit exécuter npm test.',check:c=>/run:\s*npm test\s*(?:\n|$)/.test(c)},
        {name:'Déploiement bloqué jusqu’aux tests',detail:'Le job deploy doit déclarer needs: test.',check:c=>/deploy:[\s\S]*?needs:\s*test/.test(c)}
      ]
    },
    {
      id:'scaling',ticket:'INC-005',severity:'SEV-1 · CRITIQUE',title:'Autoscaling sous-dimensionné',
      summary:'Le service est à saturation lors du pic de trafic. Le contrôleur ne peut pas créer assez de réplicas.',
      symptom:'Capacité insuffisante',impact:'Latence et erreurs utilisateur',file:'k8s/hpa.yaml',language:'YAML',
      task:'Configurez l’HorizontalPodAutoscaler pour cibler nexora-api, conserver au moins 2 réplicas, permettre un maximum de 8 et viser 65 % d’utilisation CPU.',
      hint:'Vérifiez scaleTargetRef.name, minReplicas, maxReplicas et metrics.resource.target.averageUtilization.',
      initial:`apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nexora-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: legacy-api
  minReplicas: 1
  maxReplicas: 2
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 90`,
      diagnostics:{
        'kubectl get hpa':'NAME         REFERENCE              TARGETS    MINPODS   MAXPODS   REPLICAS\nnexora-api   Deployment/legacy-api   90%/90%    1         2         2\n\nScaling limit reached. Target deployment does not match the production API.',
        'kubectl get pods':'NAME                         READY   STATUS\nnexora-api-5b8f9d-1          1/1     Running\nnexora-api-5b8f9d-2          1/1     Running\n\nCPU utilization: 94%\nPending requests: elevated',
        'status':'Application: DEGRADED\nCPU utilization: 94%\nHPA max replicas: 2\nRequired minimum capacity: 8 replicas during burst'
      },
      tests:[
        {name:'API autoscaling v2',detail:'Le fichier doit définir un HorizontalPodAutoscaler autoscaling/v2.',check:c=>/apiVersion:\s*autoscaling\/v2/.test(c)&&/kind:\s*HorizontalPodAutoscaler/.test(c)},
        {name:'Cible de déploiement correcte',detail:'scaleTargetRef doit désigner le Deployment nexora-api.',check:c=>/scaleTargetRef:[\s\S]*?kind:\s*Deployment[\s\S]*?name:\s*nexora-api/.test(c)},
        {name:'Bornes de capacité cohérentes',detail:'minReplicas doit être au moins 2 et maxReplicas au moins 8.',check:c=>{const min=Number((c.match(/minReplicas:\s*(\d+)/)||[])[1]||0);const max=Number((c.match(/maxReplicas:\s*(\d+)/)||[])[1]||0);return min>=2&&max>=8&&max>=min;}},
        {name:'Seuil CPU raisonnable',detail:'La cible averageUtilization doit être comprise entre 50 et 75 %.',check:c=>{const n=Number((c.match(/averageUtilization:\s*(\d+)/)||[])[1]||0);return n>=50&&n<=75;}}
      ]
    }
  ];

  const freshState=()=>({solved:[],codes:{},scores:{},hints:{},attempts:{},events:[],selected:0});
  function loadCampaign(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(!saved||!Array.isArray(saved.solved))return freshState();
      return { ...freshState(),...saved,solved:saved.solved.filter(id=>missions.some(m=>m.id===id)) };
    }catch(error){return freshState();}
  }
  let state=loadCampaign();
  let selectedIndex=Math.min(state.selected||0,missions.length-1);
  let lastResults=[];
  let lastPassed=false;
  const $=id=>document.getElementById(id);
  const editor=$('code-editor');
  const terminalOutput=$('terminal-output');
  const workTabs=[...document.querySelectorAll('[data-work-tab]')];
  const workPanels=[...document.querySelectorAll('[data-work-panel]')];

  function escapeHTML(value){
    return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function saveState(){
    try{state.selected=selectedIndex;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));$('campaign-save-status').textContent='SAUVEGARDE ACTIVE';}
    catch(error){$('campaign-save-status').textContent='SAUVEGARDE INDISPONIBLE';}
  }
  function addEvent(message,kind){
    const time=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    state.events.unshift({time,message,kind:kind||'info'});
    state.events=state.events.slice(0,45);
    renderTimeline();
    saveState();
  }
  function fixedCount(){return missions.filter(m=>state.solved.includes(m.id)).length;}
  function nextOpenIndex(){const next=missions.findIndex(m=>!state.solved.includes(m.id));return next<0?missions.length-1:next;}
  function totalScore(){return Object.values(state.scores).reduce((sum,value)=>sum+Number(value||0),0);}
  function totalTests(){return fixedCount()*4;}
  function setTab(name){
    workTabs.forEach(tab=>{
      const active=tab.dataset.workTab===name;
      tab.classList.toggle('active',active);
      tab.setAttribute('aria-selected',String(active));
    });
    workPanels.forEach(panel=>{
      const active=panel.dataset.workPanel===name;
      panel.classList.toggle('active',active);
      panel.hidden=!active;
    });
    if(name==='terminal')$('terminal-input').focus();
  }
  workTabs.forEach(tab=>tab.addEventListener('click',()=>setTab(tab.dataset.workTab)));

  function renderCampaignStats(){
    const fixed=fixedCount();
    const tests=totalTests();
    $('kpi-restored').textContent=fixed+' / '+missions.length;
    $('kpi-tests').textContent=tests+' / '+(missions.length*4);
    $('kpi-score').textContent=totalScore()+' XP';
    $('campaign-progress-label').textContent=Math.round(fixed/missions.length*100)+' %';
    $('campaign-progress-bar').style.width=(fixed/missions.length*100)+'%';
    const complete=fixed===missions.length;
    $('service-status').textContent=complete?'OPÉRATIONNEL':fixed===0?'INCIDENT CRITIQUE':'RESTAURATION EN COURS';
    $('service-dot').classList.toggle('state-ok',complete);
    $('service-dot').classList.toggle('state-warn',fixed>0&&!complete);
    $('service-dot').classList.toggle('state-down',fixed===0);
  }
  function renderMissionList(){
    const fixed=fixedCount();
    const active=nextOpenIndex();
    $('mission-list').innerHTML=missions.map((mission,index)=>{
      const solved=state.solved.includes(mission.id);
      const locked=index>active;
      const selected=index===selectedIndex;
      const status=solved?'RÉSOLU':locked?'VERROUILLÉ':selected?'EN COURS':'À TRAITER';
      return '<button type="button" class="mission-item'+(selected?' selected':'')+(solved?' completed':'')+'" data-mission-index="'+index+'" '+(locked?'disabled':'')+'><span class="mission-number">'+String(index+1).padStart(2,'0')+'</span><span class="mission-label"><b>'+escapeHTML(mission.title)+'</b><small>'+escapeHTML(mission.file)+'</small><em>'+status+'</em></span><span class="mission-mark">'+(solved?'✓':locked?'•':'›')+'</span></button>';
    }).join('');
    $('mission-list').querySelectorAll('[data-mission-index]').forEach(button=>button.addEventListener('click',()=>{
      selectedIndex=Number(button.dataset.missionIndex);
      saveState();
      renderMission();
    }));
  }
  function updateLineNumbers(){
    const count=editor.value.split('\n').length;
    $('line-numbers').textContent=Array.from({length:count},(_,index)=>index+1).join('\n');
  }
  function renderTimeline(){
    const timeline=$('event-timeline');
    if(!state.events.length){timeline.innerHTML='<p class="event-empty">Aucun événement enregistré. Les diagnostics, tests et déploiements apparaîtront ici.</p>';return;}
    timeline.innerHTML=state.events.map(event=>'<div class="timeline-event '+escapeHTML(event.kind)+'"><time>'+escapeHTML(event.time)+'</time><span class="timeline-marker"></span><p>'+escapeHTML(event.message)+'</p></div>').join('');
  }
  function renderMission(){
    const mission=missions[selectedIndex];
    const solved=state.solved.includes(mission.id);
    const activeIndex=nextOpenIndex();
    const locked=selectedIndex>activeIndex;
    if(locked){selectedIndex=activeIndex;return renderMission();}
    $('incident-severity').textContent=mission.severity;
    $('incident-id').textContent=mission.ticket;
    $('incident-stage').textContent='ÉTAPE '+(selectedIndex+1)+' / '+missions.length;
    $('incident-title').textContent=mission.title;
    $('incident-summary').textContent=mission.summary;
    $('incident-state').textContent=solved?'RÉSOLU':'OUVERT';
    $('incident-state').className='incident-state'+(solved?' incident-resolved':'');
    $('incident-details').innerHTML='<div><small>SYMPTÔME</small><b>'+escapeHTML(mission.symptom)+'</b></div><div><small>IMPACT</small><b>'+escapeHTML(mission.impact)+'</b></div><div><small>FICHIER À CORRIGER</small><b>'+escapeHTML(mission.file)+'</b></div>';
    $('editor-filename').textContent=mission.file;
    $('editor-language').textContent=mission.language;
    $('editor-task').textContent=mission.task;
    $('editor-hint').hidden=true;
    $('editor-hint').textContent='';
    editor.value=state.codes[mission.id]??mission.initial;
    editor.readOnly=solved;
    editor.classList.toggle('readonly',solved);
    $('editor-file-state').textContent=solved?'DÉPLOYÉ':state.codes[mission.id]?'MODIFIÉ':'INCIDENT À CORRIGER';
    $('editor-status').textContent=solved?'Correction déployée et enregistrée.':'Modifiez le fichier puis lancez les tests.';
    $('hint-button').disabled=solved;
    $('run-tests').disabled=solved;
    $('deploy-fix').hidden=solved;
    $('deploy-fix').disabled=true;
    $('deploy-help').textContent=solved?'Cette étape est déjà restaurée.':'Tous les tests doivent réussir pour débloquer le déploiement.';
    $('test-summary').textContent=solved?'VALIDÉ LORS DU DÉPLOIEMENT':'NON EXÉCUTÉS';
    $('test-list').innerHTML=solved?'<div class="test-empty test-good">✓ Étape validée. Le fichier est verrouillé pour conserver la correction déployée.</div>':'<div class="test-empty">Aucun test lancé pour le moment. Revenez à l’éditeur et exécutez la suite.</div>';
    $('tab-test-count').textContent=solved?'4/4':'0/4';
    lastResults=[];
    lastPassed=solved;
    const logs=mission.diagnostics;
    const commands=Object.keys(logs);
    $('terminal-output').innerHTML='<p><span class="term-muted">NEXORA Operations Shell v1.0</span></p><p>Session ouverte sur le ticket '+escapeHTML(mission.ticket)+'. Tapez <b>help</b> pour les commandes de diagnostic.</p><p class="term-muted">Indice : '+escapeHTML(commands.slice(0,2).join(' · '))+'</p>';
    renderMissionList();
    renderCampaignStats();
    renderTimeline();
    $('campaign-complete').hidden=fixedCount()!==missions.length;
    saveState();
    setTab('editor');
  }

  function renderTests(results){
    const passed=results.filter(result=>result.pass).length;
    $('test-summary').textContent=passed+'/'+results.length+' RÉUSSIS';
    $('tab-test-count').textContent=passed+'/'+results.length;
    $('test-list').innerHTML=results.map((result,index)=>
      '<div class="test-row '+(result.pass?'test-pass':'test-fail')+'"><span class="test-icon">'+(result.pass?'✓':'×')+'</span><div><b>'+escapeHTML(result.name)+'</b><small>'+escapeHTML(result.detail)+'</small></div><strong>'+(result.pass?'PASS':'FAIL')+'</strong></div>'
    ).join('');
    $('deploy-fix').disabled=passed!==results.length||state.solved.includes(missions[selectedIndex].id);
    $('deploy-help').textContent=passed===results.length?'Tous les contrôles sont verts. Vous pouvez déployer.':(results.length-passed)+' contrôle(s) à corriger avant le déploiement.';
    $('editor-status').textContent=passed===results.length?'Tous les tests passent. Déploiement déverrouillé.':passed+'/'+results.length+' tests réussis. Consultez les résultats.';
  }
  function runTests(){
    const mission=missions[selectedIndex];
    const code=editor.value;
    state.codes[mission.id]=code;
    state.attempts[mission.id]=(state.attempts[mission.id]||0)+1;
    const results=mission.tests.map(test=>{
      let pass=false;
      try{pass=Boolean(test.check(code));}catch(error){pass=false;}
      return {name:test.name,detail:test.detail,pass};
    });
    lastResults=results;
    lastPassed=results.every(result=>result.pass);
    renderTests(results);
    addEvent('Suite de tests lancée sur '+mission.file+' : '+results.filter(result=>result.pass).length+'/'+results.length+' contrôles réussis.',lastPassed?'success':'warning');
    setTab('tests');
    saveState();
  }
  function deployFix(){
    const mission=missions[selectedIndex];
    if(!lastPassed||state.solved.includes(mission.id))return;
    const hints=state.hints[mission.id]||0;
    const attempts=Math.max(0,(state.attempts[mission.id]||1)-1);
    const score=Math.max(35,100-(hints*15)-(attempts*5));
    state.solved.push(mission.id);
    state.scores[mission.id]=score;
    addEvent('Correction déployée : '+mission.file+'. '+mission.title+' est résolu.', 'success');
    const next=nextOpenIndex();
    renderCampaignStats();
    renderMissionList();
    if(state.solved.length===missions.length){
      renderMission();
      showCompletion();
      return;
    }
    selectedIndex=next;
    renderMission();
    setTab('editor');
  }
  function showCompletion(){
    const panel=$('campaign-complete');
    const score=totalScore();
    const solved=state.solved.length;
    const hints=Object.values(state.hints).reduce((sum,value)=>sum+Number(value||0),0);
    const attempts=Object.values(state.attempts).reduce((sum,value)=>sum+Number(value||0),0);
    $('final-summary').textContent='Vous avez restauré les 5 composants, réussi les 20 contrôles de configuration et obtenu '+score+' XP. La campagne est terminée.';
    $('complete-stats').innerHTML='<div><small>INCIDENTS RÉSOLUS</small><b>'+solved+'/5</b></div><div><small>TESTS VALIDÉS</small><b>20/20</b></div><div><small>SCORE FINAL</small><b>'+score+' XP</b></div><div><small>INDICES UTILISÉS</small><b>'+hints+'</b></div>';
    panel.hidden=false;
    panel.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function terminalWrite(command,output,kind){
    const p=document.createElement('p');
    p.className='terminal-command-line';
    const prompt=document.createElement('span');
    prompt.className='term-prompt';prompt.textContent='ops@nexora:~$ ';
    const entered=document.createElement('span');
    entered.textContent=command;
    p.append(prompt,entered);
    const pre=document.createElement('pre');
    pre.className='terminal-response '+(kind||'');
    pre.textContent=output;
    terminalOutput.append(p,pre);
    while(terminalOutput.children.length>70)terminalOutput.removeChild(terminalOutput.children[0]);
    terminalOutput.scrollTop=terminalOutput.scrollHeight;
  }
  function currentDiagnostic(key){
    const mission=missions[selectedIndex];
    return mission.diagnostics[key]||null;
  }
  function commandOutput(command){
    const mission=missions[selectedIndex];
    const key=command.toLowerCase();
    if(key==='help'||key==='help --all'){
      return 'COMMANDES DISPONIBLES\nhelp                          afficher cette aide\nstatus                        état global de la simulation\nkubectl get pods               état des pods\nkubectl describe deployment nexora-api\nkubectl get svc                services Kubernetes\nkubectl get hpa                autoscaling horizontal\nnginx -t                       vérifier la configuration NGINX\nterraform plan                 aperçu des changements IaC\nterraform validate             valider la configuration Terraform\nnpm test                       lancer les tests applicatifs\ncurl -I https://app.nexora.local\njournalctl -u nexora-api       lire les événements de l’API\ncat <fichier>                  afficher le fichier de l’incident\nclear                          nettoyer le terminal\n\nTerminal pédagogique : seules ces commandes simulées sont disponibles.';
    }
    if(key==='clear'){terminalOutput.innerHTML='';return 'Terminal nettoyé.';}
    if(key==='status'){
      return 'NEXORA PLATFORM STATUS\nIncidents résolus : '+fixedCount()+'/5\nScore technique : '+totalScore()+' XP\nÉtat : '+(fixedCount()===5?'OPERATIONAL':fixedCount()===0?'CRITICAL':'RECOVERY IN PROGRESS')+'\nIncident actif : '+mission.ticket+' — '+mission.title;
    }
    if(key==='kubectl get pods'||key==='kubectl get pods -A'){
      if(mission.id==='deployment')return currentDiagnostic('kubectl get pods');
      if(mission.id==='scaling')return currentDiagnostic('kubectl get pods');
      return 'NAMESPACE   NAME                 READY   STATUS\nproduction   nexora-api           2/2     Running\nproduction   nexora-worker        1/1     Running\nproduction   nexora-postgres      1/1     Running\n\nLes pods sont actifs. Consultez les autres contrôles pour identifier la panne.';
    }
    if(key==='kubectl describe deployment nexora-api')return currentDiagnostic('kubectl describe deployment nexora-api')||'Deployment nexora-api : disponible. Aucun incident de déploiement ouvert sur cette étape.';
    if(key==='kubectl get svc')return currentDiagnostic('kubectl get svc')||'NAME          TYPE        PORT(S)\napi-service   ClusterIP   8080/TCP\nweb-gateway   ClusterIP   80/TCP';
    if(key==='nginx -t')return currentDiagnostic('nginx -t')||'nginx: configuration file syntax is ok\nnginx: configuration test is successful (simulation).';
    if(key==='terraform plan'||key==='terraform validate')return currentDiagnostic(key)||'Terraform: configuration disponible. Aucun contrôle de stockage bloquant sur cet incident.';
    if(key==='npm test'||key==='npm run test:unit')return currentDiagnostic('npm test')||'Tests applicatifs : suite de démonstration. Aucun problème signalé à cette étape.';
    if(key==='kubectl get hpa')return currentDiagnostic('kubectl get hpa')||'NAME         REFERENCE              TARGETS   MINPODS   MAXPODS\nnexora-api   Deployment/nexora-api  40%/65%   2         10';
    if(key==='curl -i https://app.nexora.local/health'||key==='curl -i https://app.nexora.local'||key==='curl -i https://app.nexora.local/'){
      return fixedCount()===5?'HTTP/2 200\ncontent-type: text/html\nx-platform-status: operational\n\nNEXORA service is healthy.':'HTTP/2 503\nserver: nexora-edge\nx-platform-status: incident-open\n\nThe active incident is not resolved yet.';
    }
    if(key==='curl -i https://app.nexora.local/health'||key==='curl -i https://app.nexora.local'||key==='curl https://app.nexora.local')return fixedCount()===5?'200 OK — service healthy':'503 Service Unavailable — incident open';
    if(key==='journalctl -u nexora-api'||key==='journalctl -u nexora-api --no-pager'){
      const map={
        deployment:'Readiness probe failed: GET /ready returned 404\nReplicaSet selector does not match pod labels\nService endpoints: 0 ready pods',
        routing:'Gateway error: upstream nexora_backend could not be resolved\nConnection target mismatch: configured port 8081, service port 8080',
        storage:'Storage policy audit failed\nServer-side encryption policy not met\nObject versioning suspended\nLog retention below 30-day baseline',
        pipeline:'Release gate missing: deploy job has no dependency on test\nUnit test command not found: npm run test:unit',
        scaling:'HPA target does not match Deployment nexora-api\nMax replicas limit reached at 2\nCPU utilization remains above target'
      };
      return map[mission.id]+'\n[simulation] Diagnostic journal for '+mission.ticket;
    }
    const files={'cat k8s/deployment.yaml':'deployment','cat nginx/nginx.conf':'routing','cat infra/storage.tf':'storage','cat .github/workflows/deploy.yml':'pipeline','cat k8s/hpa.yaml':'scaling'};
    if(files[key]){
      const target=missions.find(m=>m.id===files[key]);
      return state.codes[target.id]||target.initial;
    }
    return 'Commande non reconnue ou indisponible dans ce terminal pédagogique. Tapez help pour la liste des commandes.';
  }
  function executeCommand(value){
    const command=value.trim();
    if(!command)return;
    if(command.toLowerCase()==='clear'){terminalOutput.innerHTML='';return;}
    const output=commandOutput(command);
    terminalWrite(command,output,output.startsWith('Commande non reconnue')?'term-error':'');
    addEvent('Commande exécutée dans le terminal : '+command,'info');
  }
  $('terminal-form').addEventListener('submit',event=>{
    event.preventDefault();
    const input=$('terminal-input');
    executeCommand(input.value);
    input.value='';
  });
  document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>{
    setTab('terminal');executeCommand(button.dataset.command);
  }));

  editor.addEventListener('input',()=>{
    const mission=missions[selectedIndex];
    if(state.solved.includes(mission.id))return;
    state.codes[mission.id]=editor.value;
    $('editor-file-state').textContent='MODIFIÉ';
    $('editor-status').textContent='Modifications non validées. Relancez les tests après vos changements.';
    $('deploy-fix').disabled=true;
    $('test-summary').textContent='À RELANCER';
    $('tab-test-count').textContent='—';
    $('test-list').innerHTML='<div class="test-empty">Le fichier a changé. Relancez les tests pour vérifier cette version.</div>';
    updateLineNumbers();
    saveState();
  });
  editor.addEventListener('scroll',()=>{$('line-numbers').scrollTop=editor.scrollTop;});
  $('run-tests').addEventListener('click',runTests);
  $('deploy-fix').addEventListener('click',deployFix);
  $('hint-button').addEventListener('click',()=>{
    const mission=missions[selectedIndex];
    if(state.solved.includes(mission.id))return;
    state.hints[mission.id]=(state.hints[mission.id]||0)+1;
    $('editor-hint').textContent='INDICE : '+mission.hint;
    $('editor-hint').hidden=false;
    $('hint-button').textContent='Indice affiché';
    $('hint-button').disabled=true;
    addEvent('Indice consulté pour '+mission.ticket+' : le score de cette mission sera légèrement réduit.','warning');
    saveState();
  });
  $('reset-campaign').addEventListener('click',()=>{
    if(!window.confirm('Réinitialiser toute la campagne ? Les corrections et le score sauvegardés seront effacés.'))return;
    state=freshState();selectedIndex=0;lastResults=[];lastPassed=false;
    try{localStorage.removeItem(STORAGE_KEY);}catch(error){}
    addEvent('Nouvelle campagne initialisée.','info');
    renderMission();
    $('campaign-complete').hidden=true;
    $('campaign-save-status').textContent='NOUVELLE CAMPAGNE';
  });
  $('play-again').addEventListener('click',()=>{
    state=freshState();selectedIndex=0;lastResults=[];lastPassed=false;
    try{localStorage.removeItem(STORAGE_KEY);}catch(error){}
    renderMission();
    $('campaign-complete').hidden=true;
    window.scrollTo({top:$('cloud-campaign').offsetTop-110,behavior:'smooth'});
  });
  renderMission();
  if(state.solved.length===missions.length)showCompletion();
}
