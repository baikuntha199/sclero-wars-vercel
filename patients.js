'use strict';
// Deliberately varied synthetic referrals, not population prevalence estimates.
const PatientFactory=(()=>{
 const names=['Ananya','Ravi','Meera','Arjun','Farah','Dev','Isha','Kabir','Nisha','Rohan','Aditi','Samar','Tara','Neel','Zoya','Vikram','Leela','Aman','Kavya','Riya','Milan','Anika','Sana','Ishan'];
 const pick=(a,r)=>a[Math.floor(r()*a.length)];
 const integer=(a,b,r)=>a+Math.floor(r()*(b-a+1));
 function generate(r=Math.random){
  const type=pick(['RRMS','RRMS','RRMS','RRMS','Active SPMS','Non-active SPMS','PPMS'],r);
  const progressive=type!=='RRMS';
  const age=integer(progressive?38:20,progressive?65:59,r);
  const duration=type.includes('SPMS')?integer(10,Math.min(28,age-18),r):type==='PPMS'?integer(1,Math.min(14,age-25),r):integer(1,Math.min(36,(age-18)*2),r)/2;
  const edss=pick(type==='RRMS'?[0,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5]:type==='PPMS'?[3,3.5,4,4.5,5,5.5,6,6.5]:[3.5,4,4.5,5,5.5,6,6.5,7],r);
  const relapses=type==='Non-active SPMS'||type==='PPMS'?0:pick(type==='Active SPMS'?[0,1,1,2]:[0,0,1,1,2,2,3],r);
  const lesions=type==='Non-active SPMS'?0:type==='Active SPMS'&&relapses===0?integer(1,3,r):integer(0,relapses>1?6:2,r);
  const activity=relapses>=2||lesions>=3?'High':relapses||lesions?'Moderate':'Low';
  const employment=pick(['Salaried','Salaried','Contract work','Self-employed','Not employed'],r);
  const budget=integer(employment==='Not employed'?25:35,employment==='Salaried'?100:80,r);
  let risk=pick(['none','none','none','none','low_igg','low_alc','cardiac','liver','conception'],r);
  if(risk==='conception'&&age>45)risk='none';
  const grantEligible=budget<=70&&r()<.65;
  const flags={none:'No major additional safety flag identified.',low_igg:'Recurrent respiratory infections; IgG below the laboratory range.',low_alc:'ALC 0.6 × 10⁹/L; investigate persistent lymphopenia before lymphocyte-lowering treatment.',cardiac:'Mobitz II AV block without a functioning pacemaker.',liver:'Chronic liver disease with ALT 3.5 × the upper limit of normal.',conception:'Pregnancy planned within the coming year; agree a treatment-specific reproductive plan.'};
  const jcv=pick([0.15,0.18,0.7,1.2,2.1,2.6],r);
  const failures=type==='RRMS'&&duration>2?pick([0,0,1,2],r):0;
  return {id:'PT-'+integer(1000,9999,r),name:pick(names,r),type,age,duration,edss,relapses,lesions,activity,employment,budget,grantEligible,risk,riskText:flags[risk],jcv,jcvPositive:jcv>=0.4,failures,preference:pick(['Oral','Self-injection','Infusion'],r),priorIS:r()<0.15,history:[],exposure:{},lastDrug:null,year:0};
 }
 function referrals(r=Math.random){const list=[];while(list.length<3){const p=generate(r);if(!list.some(x=>x.id===p.id))list.push(p)}return list}
 function activity(p){return p.type==='Non-active SPMS'?'Low':p.relapses>=2||p.lesions>=3?'High':p.relapses||p.lesions?'Moderate':'Low'}
 return {generate,referrals,activity};
})();
