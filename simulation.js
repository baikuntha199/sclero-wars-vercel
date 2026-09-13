'use strict';
const Simulation=(()=>{
 const step=.5;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const high=['ubl','rtx','ocr','ofa','nat','cla','ale'];
 const s1p=['fin','sip','oza','pon'];
 const cd20=['ubl','rtx','ocr','ofa'];
 const plans={
  standard:{name:'Routine follow-up',cost:0,grant:0,retention:1,shock:.45,description:'Usual scheduled review. No extra financial support.'},
  access:{name:'Access navigator',cost:6,grant:10,retention:.55,shock:.45,description:'6 credits per review; a 10-credit assistance grant if eligible and active follow-up.'},
  resilience:{name:'Work & transport support',cost:6,grant:0,retention:.5,shock:.25,description:'6 credits per review; transport follow-up and a reserve that cushions an income shock.'}
 };
 function probability(metric,years=step,starting=true){
  if(!metric)return null;
  if(metric.kind==='initiation')return starting?metric.value:0;
  if(metric.kind==='rate')return 1-Math.exp(-metric.value*years);
  return 1-Math.pow(1-metric.value,years/metric.years);
 }
 function route(d){return ['ga','ifn','ofa'].includes(d.id)?'Self-injection':['ubl','rtx','ocr','nat','ale'].includes(d.id)?'Infusion':d.id==='review'?'Care plan':'Oral'}
 function blockers(p,d){
  const a=[];
  if(d.research)a.push('Investigational: no routine-care treatment draw is available.');
  if(p.risk==='cardiac'&&s1p.includes(d.id))a.push('Mobitz II block without a pacemaker: do not initiate this S1P modulator.');
  if(p.risk==='liver'&&d.id==='ter')a.push('ALT >2 × ULN with pre-existing liver disease: this scenario requires an alternative to teriflunomide.');
  if(p.risk==='low_alc'&&d.id==='cla')a.push('Lymphocytes must be normal before cladribine year 1. Investigate this lymphopenia first.');
  return a;
 }
 function warnings(p,d){
  const a=[];
  if(p.risk==='low_igg'&&[...cd20,'ale'].includes(d.id))a.push('Low IgG and recurrent infection need individualized immune assessment; trial averages can underestimate this patient’s risk.');
  if(p.risk==='low_alc'&&[...s1p,'dmf','drf','ale'].includes(d.id))a.push('Persistent lymphopenia requires a drug-specific review before further immune suppression.');
  if(p.risk==='liver'&&!['ga','review','ter'].includes(d.id))a.push('Liver disease changes eligibility and monitoring; the cohort event rate is not adjusted for it.');
  if(p.risk==='conception'&&!['ga','ifn','review'].includes(d.id))a.push('Agree a reproductive plan before treatment. Required intervals and pregnancy evidence differ by drug.');
  if(d.id==='ale'&&p.failures<2)a.push('US labeling generally reserves alemtuzumab for inadequate response to two or more MS drugs.');
  if(d.id==='nat'&&p.jcvPositive)a.push('Review JCV index, prior immunosuppression and cumulative natalizumab exposure. PML probability is not included in the random draw.');
  if(p.lastDrug&&p.lastDrug!==d.id)a.push('A switch needs an agreed transition and monitoring plan. Carry-over effects and rebound risk are not quantified here.');
  if(p.type==='PPMS'&&d.id!=='ocr'&&d.id!=='review')a.push('No established PPMS efficacy is assigned to this choice.');
  if(p.type==='Non-active SPMS'&&d.id!=='review')a.push('Expected anti-inflammatory benefit is uncertain in this non-active progressive profile.');
  if(d.id==='rtx'&&(p.age>50||p.duration>10))a.push('This profile is outside RIFUND-MS age or disease-duration eligibility.');
  if(p.type==='PPMS'&&d.id==='ocr'&&(p.age>55||p.edss>6.5||p.duration>(p.edss>5?15:10)))a.push('This profile is outside key ORATORIO eligibility limits; applicability is uncertain.');
  if(p.age>55||p.edss>5.5)a.push('Older age or advanced disability limits transferability from many relapsing-MS trials.');
  return a;
 }
 function budget(p,d,planId,override){
  const plan=plans[planId],grant=planId==='access'&&p.grantEligible?plan.grant:0,available=(override??p.budget)/2+grant;
  const extended=p.longMonitorUntil>p.year&&d.id!=='ale'?4:0;
  const cost=d.cost/2+plan.cost+extended;
  return {available,cost,grant,balance:available-cost,gap:Math.max(0,cost-available),extraMonitoring:extended};
 }
 function score(p,d,planId){
  if(d.research)return null;
  const originalActivity=p.baselineActivity||p.activity;
  let fit=0;
  if(p.type==='PPMS'){
   const outside=p.age>55||p.edss>6.5||p.duration>(p.edss>5?15:10);
   fit=d.id==='ocr'?(outside?30:40):d.id==='review'?(outside&&originalActivity==='Low'?34:24):d.id==='rtx'?10:0;
  }
  else if(p.type==='Non-active SPMS')fit=d.id==='review'?40:d.id==='sip'?14:6;
  else if(p.type==='Active SPMS')fit=d.id==='sip'?40:cd20.includes(d.id)?34:['nat','cla'].includes(d.id)?30:d.id==='review'?8:['ga','ifn'].includes(d.id)?16:24;
  else {
   fit=d.id==='review'?(originalActivity==='High'?0:15):originalActivity==='High'?(high.includes(d.id)?38:s1p.includes(d.id)?29:['dmf','drf','ter'].includes(d.id)?23:16):(high.includes(d.id)?36:['ga','ifn'].includes(d.id)?35:38);
   if(p.duration<=2&&originalActivity==='High'&&high.includes(d.id))fit+=2;
   if(p.lastDrug===d.id&&!p.breakthroughOn)fit=Math.min(40,fit+3);
   if(p.breakthroughOn===d.id&&(p.exposure[d.id]||0)>=1)fit-=10;
  }
  if(d.id==='ale'&&p.failures<2)fit=Math.min(fit,18);
  if(p.type==='Active SPMS'&&(p.age>60||p.edss>6.5)&&d.id!=='review')fit=Math.min(fit,30);
  let safety=25;
  if(d.id==='ale')safety=16;
  if(p.risk==='low_igg'&&[...cd20,'ale'].includes(d.id))safety-=14;
  if(p.risk==='low_alc'&&[...s1p,'dmf','drf','ale','cla'].includes(d.id))safety-=15;
  if(p.risk==='liver'&&!['ga','review'].includes(d.id))safety-=10;
  if(p.risk==='conception'&&!['ga','ifn','review'].includes(d.id))safety-=12;
  if(d.id==='nat'&&p.jcvPositive)safety-=p.jcv>1.5?12:6;
  if(d.id==='nat'&&p.priorIS)safety-=4;
  if(d.id==='nat'&&(p.exposure.nat||0)>=2&&p.jcvPositive)safety-=4;
  if(blockers(p,d).length)safety=0;
  const b=budget(p,d,planId);
  const access=b.gap>0?clamp(12-Math.ceil(b.gap),0,12):16+Math.floor(4*clamp(b.balance/Math.max(1,b.available),0,1));
  const preference=d.id==='review'||route(d)===p.preference||planId==='resilience'&&p.edss>=4?5:2;
  const fitPoints=clamp(fit,0,40),safetyPoints=clamp(safety,0,25);
  return {fit:fitPoints,safety:safetyPoints,access,preference,base:fitPoints+safetyPoints+access+preference};
 }
 function economicChances(p,d,planId,intensity=1,currentBudget){
  const plan=plans[planId],b=budget(p,d,planId,currentBudget);
  const annualJob=p.employment==='Salaried'?.08:p.employment==='Contract work'?.20:p.employment==='Self-employed'?.15:0;
  const annualGap=d.id==='review'?0:clamp((.04+(b.gap/Math.max(10,b.available))*.8)*plan.retention*intensity,0,.8);
  return {job:1-Math.pow(1-clamp(annualJob*intensity,0,.8),step),expense:1-Math.pow(1-clamp(.12*intensity,0,.8),step),missed:1-Math.pow(1-clamp(.08*plan.retention*intensity,0,.8),step),gap:1-Math.pow(1-annualGap,step)};
 }
 function forecast(p,d,planId,intensity=1){
  const evidence=Evidence.get(p,d);if(!evidence)return null;
  const starting=p.lastDrug!==d.id||Boolean(p.needsRestart);
  const firstProgression=Boolean(p.progressionRecorded);
  return {evidence,starting,relapse:probability(evidence.relapse),progression:firstProgression?null:probability(evidence.progression),complication:probability(evidence.complication,step,starting),firstProgression,economic:economicChances(p,d,planId,intensity),budget:budget(p,d,planId),score:score(p,d,planId)};
 }
 function shuffle(items,r){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
 function question(outcome,p,d,r){
  let title,correct,wrong1,wrong2,why,critical=false;
  if(outcome.complication){
   const type=outcome.forecast.evidence.complication.label;
   title=type+' reported. How will you respond?';
   const actions={
    'Serious infection':'Arrange urgent assessment, treat the infection and review holding further immunosuppression until it resolves.',
    'Serious hypersensitivity reaction':'Stop the infusion and arrange emergency treatment; reassess future exposure under the label.',
    'Infusion reaction':'Assess severity, manage the reaction and adjust or stop the infusion as clinically indicated.',
    'Initiation bradycardia':'Assess symptoms and ECG; manage and observe until clinically safe before further dosing.',
    'Symptomatic first-dose bradycardia':'Continue appropriate cardiac observation and treatment until clinically safe; reassess dosing.',
    'Macular edema':'Arrange prompt ophthalmic assessment and review discontinuation and alternatives.',
    'Lymphocytopenia':'Review the count, infections and recovery criteria before further courses.',
    'Thyroid disorder':'Arrange thyroid assessment and treatment, and continue required autoimmune surveillance.',
    'Adverse event requiring discontinuation':'Assess the adverse event and arrange a monitored treatment transition.',
    'Gastrointestinal adverse event':'Assess severity and tolerability, offer appropriate management and agree whether to continue.',
    'Injection-site reaction':'Review injection technique, site rotation and severity; distinguish local reactions from anaphylaxis.'
   };
   correct=actions[type];wrong1='Ignore the complication and continue automatically.';wrong2='Stop all neurological care and follow-up.';
   critical=outcome.forecast.evidence.complication.severity==='serious'||type.includes('bradycardia');
   why='Manage the event before deciding on further treatment. The sampled complication is one selected endpoint, not the drug’s entire safety profile.';
  }else if(outcome.gap||outcome.missed||outcome.jobLoss||outcome.expense){
   title=outcome.gap?'The next treatment is delayed by cost. What now?':outcome.missed?'The patient misses a scheduled review. What now?':outcome.jobLoss?'Employment income is lost. How do you protect continuity?':'An unexpected household bill reduces available funds. What now?';
   correct='Contact the patient, reassess affordability, arrange feasible support and plan any switch with appropriate monitoring.';
   wrong1='Keep the same unfunded plan and wait for the patient to solve it.';wrong2='Stop treatment abruptly without discussing a transition.';
   why='A feasible continuing plan earns care points. Support does not guarantee funding, restore a lost job or eliminate interruption risk. The reduced budget carries into the next review after job loss.';
  }else if(outcome.relapse){
   title='A relapse occurred. What is the next step?';
   correct='Assess and treat the relapse, verify exposure and alternative explanations, and review whether the DMT plan should change.';
   wrong1='Declare the DMT ineffective from this event alone.';wrong2='Ignore the relapse because the treatment has high efficacy.';
   why='A breakthrough event prompts review. Time on treatment, adherence, MRI, relapse severity and patient goals matter before declaring treatment failure.';
  }else if(outcome.progression){
   title='Sustained EDSS worsening is simulated. How do you respond?';
   correct='Reassess inflammation and other causes, review rehabilitation and goals, and reconsider treatment where appropriate.';
   wrong1='Assume every EDSS increase is inflammatory and automatically add another DMT.';wrong2='Discharge the patient because progression is inevitable.';
   why='Progression and relapse are different outcomes. Disability management includes rehabilitation, symptom care and reassessment of disease activity.';
  }else{
   title='No sampled event occurred. What is the follow-up plan?';
   correct=d.id==='ale'?'Continue clinical review and blood/urine monitoring for 48 months after the last infusion.':d.id==='cla'?'Continue surveillance and check lymphocyte eligibility before the next scheduled annual course.':d.id==='nat'?'Continue clinical and MRI surveillance, with JCV and cumulative-exposure reassessment.':'Continue the agreed plan, clinical/MRI surveillance and drug-specific safety monitoring.';
   wrong1='Stop surveillance because this draw proves the patient is safe.';wrong2='Promise that disability progression and adverse events can no longer occur.';
   why='An event-free draw does not mean cure or zero risk. Unmodeled complications and outcomes remain possible.';
  }
  return {title,answers:shuffle([{id:'manage',text:correct},{id:'ignore',text:wrong1},{id:'abandon',text:wrong2}],r),why,critical};
 }
 function sample(p,d,planId,intensity=1,r=Math.random){
  if(d.research||blockers(p,d).length)return null;
  const f=forecast(p,d,planId,intensity);
  const draw=chance=>chance!==null&&r()<chance;
  const relapse=draw(f.relapse),progression=draw(f.progression),complication=draw(f.complication);
  const jobLoss=draw(f.economic.job);
  const expense=!jobLoss&&draw(f.economic.expense);
  const nextAnnualBudget=jobLoss?Math.max(10,Math.round(p.budget*(1-plans[planId].shock))):p.budget;
  const effectiveBudget=expense?Math.max(10,nextAnnualBudget-16):nextAnnualBudget;
  const economicAfter=economicChances(p,d,planId,intensity,effectiveBudget);
  const gap=draw(economicAfter.gap),missed=draw(f.economic.missed);
  const impact=[];
  if(relapse)impact.push({label:'Relapse',points:6});
  if(progression)impact.push({label:'Sustained EDSS worsening',points:6});
  if(complication)impact.push({label:f.evidence.complication.label,points:{minor:3,moderate:5,serious:8}[f.evidence.complication.severity]});
  if(gap)impact.push({label:'Financial treatment interruption',points:4});
  if(missed)impact.push({label:'Missed review',points:2});
  const outcome={forecast:f,relapse,progression,complication,jobLoss,expense,gap,missed,nextAnnualBudget,effectiveBudget,economicAfter,impact,impactTotal:Math.min(20,impact.reduce((a,x)=>a+x.points,0)),before:{age:p.age,duration:p.duration,edss:p.edss,budget:p.budget},drug:d.id,plan:planId,answered:false};
  outcome.question=question(outcome,p,d,r);
  return outcome;
 }
 function resolve(p,d,outcome,response){
  if(!outcome||outcome.answered)return null;
  outcome.answered=true;
  const managed=response==='manage',followup=managed?10:0;
  const decision=outcome.forecast.score.base+followup;
  const major=!managed&&outcome.question.critical;
  let points=clamp(decision-outcome.impactTotal,0,100);
  if(major)points=Math.min(35,points);
  const oldEDSS=p.edss;
  if(outcome.progression){p.edss=clamp(p.edss+(p.edss===0?1.5:p.edss<=5.5?1:.5),0,9.5);p.progressionRecorded=true;}
  const periodStart=p.year;
  p.age+=step;p.duration+=step;p.year+=step;
  p.exposure[d.id]=(p.exposure[d.id]||0)+step;
  p.budget=outcome.nextAnnualBudget;
  if(outcome.jobLoss)p.employment='Not employed';
  if(d.id==='ale'&&(p.lastAleCourse===undefined||periodStart-p.lastAleCourse>=1)){p.lastAleCourse=periodStart;p.longMonitorUntil=periodStart+4;}
  p.lastDrug=d.id;
  p.latestRelapse=outcome.relapse;
  p.breakthroughOn=outcome.relapse?d.id:null;
  if(outcome.relapse&&(p.exposure[d.id]||0)>=1)p.failures=Math.min(3,p.failures+1);
  p.needsRestart=outcome.gap; // No rebound/washout probability is invented.
  p.followupMissed=outcome.missed&&!managed;
  const result={...outcome,decision,followup,points,major,managed,after:{age:p.age,duration:p.duration,edss:p.edss,budget:p.budget},edssChanged:p.edss!==oldEDSS,month:Math.round(p.year*12)};
  p.history.push(result);
  return result;
 }
 return {step,plans,probability,route,blockers,warnings,budget,score,economicChances,forecast,sample,resolve};
})();
