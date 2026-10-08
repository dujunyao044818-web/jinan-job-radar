export const PRIORITY_SPECIALTIES=["基础医学","药理学","肾脏病学","临床检验诊断学","医学检验","生物医学","分子生物学"];

export function dateValue(value){
  if(!value)return null;
  const stamp=Date.parse(String(value).slice(0,10)+"T00:00:00+08:00");
  return Number.isNaN(stamp)?null:stamp;
}

export function daysFrom(value,now=Date.now()){
  const stamp=dateValue(value);
  if(stamp===null)return null;
  return Math.ceil((stamp-now)/86400000);
}

export function normalizeJob(job){
  const relevance=job.phd_relevance||{
    category:job.phd?"博士岗位":"需要人工核实",
    score:job.phd?6:0,
    reasons:[job.phd?"旧数据仅有标题级博士标记":"旧数据尚未完成正文规则分析"],
    specialties:job.specialties||[],
    restrictions:job.restrictions||[],
    is_postdoc:/博士后/.test(job.title||"")
  };
  return {
    ...job,
    type:job.type||"未分类",
    attachments:Array.isArray(job.attachments)?job.attachments:[],
    specialties:Array.isArray(job.specialties)?job.specialties:(relevance.specialties||[]),
    restrictions:Array.isArray(job.restrictions)?job.restrictions:(relevance.restrictions||[]),
    phd_relevance:relevance,
    deadline_reliable:job.deadline_reliable===true,
    excluded:job.excluded===true
  };
}

export function normalizeData(payload){
  const jobs=(payload.jobs||[]).map(normalizeJob);
  return {
    ...payload,
    jobs,
    sources:Array.isArray(payload.sources)?payload.sources:[],
    statistics:payload.statistics||{
      sources_total:(payload.sources||[]).length,
      sources_successful:(payload.sources||[]).filter(source=>source.status==="ok").length,
      jobs_total:jobs.length,
      phd_jobs:jobs.filter(job=>job.phd_relevance.category==="博士岗位").length
    }
  };
}

export function filterJobs(jobs,filters,now=Date.now(),favorites=new Set()){
  const query=(filters.query||"").trim().toLowerCase();
  return jobs.filter(job=>{
    const relevance=job.phd_relevance||{};
    const haystack=[job.title,job.source,job.education,job.degree,job.location,...(job.specialties||[]),...(job.restrictions||[])].join(" ").toLowerCase();
    if(query&&!haystack.includes(query))return false;
    if(filters.type&&job.type!==filters.type)return false;
    if(filters.source&&job.source!==filters.source)return false;
    if(filters.specialty&&!(job.specialties||[]).includes(filters.specialty))return false;
    if(filters.relevance==="博士后"&&!relevance.is_postdoc)return false;
    if(filters.relevance&&filters.relevance!=="博士后"&&relevance.category!==filters.relevance)return false;
    if(!filters.includeExcluded&&job.excluded)return false;
    const age=daysFrom(job.published,now);
    if(filters.period==="7"&&(age===null||age>0||age<-6))return false;
    if(filters.period==="30"&&(age===null||age>0||age<-29))return false;
    if(filters.period==="discovered"&&!job.is_newly_discovered)return false;
    if(filters.period==="favorites"&&!favorites.has(job.id))return false;
    if(filters.period==="closing"){
      const left=daysFrom(job.deadline,now);
      if(!job.deadline_reliable||left===null||left<0||left>7)return false;
    }
    return true;
  });
}

export function sortJobs(jobs,sort){
  const result=[...jobs];
  const desc=(a,b)=>(b||"").localeCompare(a||"");
  result.sort((a,b)=>{
    if(sort==="deadline"){
      if(!a.deadline_reliable&&!b.deadline_reliable)return desc(a.published,b.published);
      if(!a.deadline_reliable)return 1;
      if(!b.deadline_reliable)return -1;
      return (a.deadline||"").localeCompare(b.deadline||"")||desc(a.published,b.published);
    }
    if(sort==="first_seen")return desc(a.first_seen,b.first_seen);
    if(sort==="score")return (b.phd_relevance?.score||0)-(a.phd_relevance?.score||0)||desc(a.published,b.published);
    if(sort==="title")return (a.title||"").localeCompare(b.title||"","zh-CN");
    return desc(a.published,b.published);
  });
  return result;
}

export function sourceSummary(sources){
  const total=sources.length;
  const successful=sources.filter(source=>source.status==="ok").length;
  return {total,successful,rate:total?Math.round(successful/total*100):0};
}
