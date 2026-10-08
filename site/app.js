import{dateValue,daysFrom,filterJobs,normalizeData,sortJobs,sourceSummary}from"./lib.mjs";

const $=id=>document.getElementById(id);
const state={data:normalizeData({jobs:[],sources:[]}),filtered:[],shown:0,favorites:new Set()};
const batchSize=20;

function element(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
}
function externalLink(url,text,className=""){
  const link=element("a",className,text);
  link.href=url;link.target="_blank";link.rel="noopener noreferrer";
  return link;
}
function displayDate(value){return value?String(value).slice(0,10):"未核实"}
function loadFavorites(){
  try{state.favorites=new Set(JSON.parse(localStorage.getItem("jinan-job-radar:favorites")||"[]"))}catch{state.favorites=new Set()}
}
function saveFavorites(){
  try{localStorage.setItem("jinan-job-radar:favorites",JSON.stringify([...state.favorites]))}catch{}
}
function currentFilters(){
  return{
    query:$("q").value,type:$("type").value,source:$("source").value,
    relevance:$("relevance").value,specialty:$("specialty").value,
    period:$("period").value,includeExcluded:$("include-excluded").checked
  };
}
function tag(text,kind=""){return element("span","tag "+kind,text)}
function reliableDeadlineLabel(job){
  if(!job.deadline_reliable||!job.deadline)return"截止：未核实";
  const left=daysFrom(job.deadline);
  if(left===null)return"截止：未核实";
  if(left<0)return`截止：${displayDate(job.deadline)}（已过）`;
  if(left===0)return`截止：${displayDate(job.deadline)}（今天）`;
  return`截止：${displayDate(job.deadline)}（剩 ${left} 天）`;
}
function detail(label,value){
  const box=element("div","detail");box.append(element("b","",label),document.createTextNode(value||"未核实"));return box;
}
function renderJob(job){
  const card=element("article","job"+(job.excluded?" excluded":""));
  const head=element("div","job-head"),main=element("div"),title=element("h3");
  title.append(externalLink(job.url,job.title));main.append(title);
  const tags=element("div","tags"),rel=job.phd_relevance||{};
  const kind=rel.category==="博士岗位"?"phd":rel.category==="可能符合专业"?"match":rel.category==="需要人工核实"?"warn":"";
  tags.append(tag(rel.category||"需要人工核实",kind));
  if(rel.is_postdoc)tags.append(tag("博士后","postdoc"));
  if(job.is_newly_discovered)tags.append(tag("本轮新发现","new"));
  const age=daysFrom(job.published);
  if(age!==null&&age<=0&&age>=-6)tags.append(tag("最近 7 天发布","new"));
  if(job.excluded)tags.append(tag("已排除","warn"));
  for(const specialty of (job.specialties||[]))tags.append(tag(specialty,"match"));
  main.append(tags);head.append(main);
  const favorite=element("button","favorite"+(state.favorites.has(job.id)?" active":""),state.favorites.has(job.id)?"★ 已收藏":"☆ 收藏");
  favorite.type="button";favorite.setAttribute("aria-label",`收藏 ${job.title}`);
  favorite.onclick=()=>{state.favorites.has(job.id)?state.favorites.delete(job.id):state.favorites.add(job.id);saveFavorites();render()};
  head.append(favorite);card.append(head);
  const meta=element("div","meta");
  meta.append(element("span","",job.source),element("span","",`发布：${displayDate(job.published)}`),element("span","",reliableDeadlineLabel(job)),element("span","",`首次发现：${displayDate(job.first_seen)}`));
  card.append(meta);
  const details=element("div","details");
  details.append(detail("学历",job.education),detail("学位",job.degree),detail("招聘人数",job.recruitment_count),detail("工作地点",job.location));
  card.append(details);
  if((rel.reasons||[]).length){
    const reasons=element("ul","reasons");
    for(const reason of rel.reasons)reasons.append(element("li","",reason));
    for(const restriction of (job.restrictions||[]))reasons.append(element("li","restriction",restriction));
    card.append(reasons);
  }
  if((job.attachments||[]).length){
    const attachments=element("div","attachments");attachments.append(element("span","muted","官方附件："));
    for(const item of job.attachments)attachments.append(externalLink(item.url,`${item.name||"附件"} ↗`));
    card.append(attachments);
  }
  const foot=element("div","job-foot");
  const evidence=job.published_evidence?"发布日期有来源依据":"发布日期未核实";
  foot.append(element("span","muted",evidence+(job.revisions?.length?` · 修订 ${job.revisions.length} 次`:"")));
  const actions=element("div","job-actions");actions.append(externalLink(job.url,"查看官方原文 ↗"));foot.append(actions);card.append(foot);
  return card;
}
function more(){
  const list=$("list"),slice=state.filtered.slice(state.shown,state.shown+batchSize);
  for(const job of slice)list.append(renderJob(job));
  state.shown+=slice.length;
  $("more").style.display=state.shown<state.filtered.length?"flex":"none";
  if(!state.filtered.length)list.append($("empty-template").content.cloneNode(true));
}
function render(){
  const filtered=filterJobs(state.data.jobs,currentFilters(),Date.now(),state.favorites);
  state.filtered=sortJobs(filtered,$("sort").value);state.shown=0;$("list").replaceChildren();
  $("count").textContent=`符合条件 ${state.filtered.length} 条`;more();
}
function renderSources(){
  const box=$("sources");box.replaceChildren();
  for(const source of state.data.sources){
    const card=element("article","source-card"),top=element("div","source-top");
    top.append(externalLink(source.url,source.name));
    const ok=source.status==="ok";
    top.append(element("span","source-status "+(ok?"ok":"error"),ok?`成功 · ${source.found} 条`:"采集失败 · 数量未知"));
    card.append(top);
    card.append(element("div","source-meta",`方法：${source.method||"HTML 列表解析"} · 最近成功：${source.last_success_at?source.last_success_at.replace("T"," ").slice(0,19):"尚未验证"}`));
    if(!ok&&source.error)card.append(element("div","source-error",source.error));
    box.append(card);
  }
}
function renderMetrics(){
  const jobs=state.data.jobs.filter(job=>!job.excluded),summary=sourceSummary(state.data.sources);
  $("m-total").textContent=jobs.length;
  $("m-phd").textContent=jobs.filter(job=>job.phd_relevance.category==="博士岗位").length;
  $("m-new").textContent=jobs.filter(job=>{const age=daysFrom(job.published);return age!==null&&age<=0&&age>=-6}).length;
  $("m-source").textContent=summary.total?`${summary.rate}%`:"—";
  $("updated").textContent=state.data.updated_at?`数据更新时间：${state.data.updated_at.replace("T"," ").slice(0,19)}（北京时间）`:"尚无采集时间";
  const notice=$("notice");notice.className="notice";
  if(!state.data.updated_at)notice.textContent="尚未执行首次采集。请前往 GitHub Actions 手动运行 collect.yml。";
  else if(summary.successful===0){notice.classList.add("error");notice.textContent="本轮所有来源采集失败，页面保留历史公告；失败不代表这些单位没有招聘。";}
  else if(summary.successful<summary.total){notice.classList.add("warning");notice.textContent=`本轮 ${summary.successful}/${summary.total} 个来源采集成功。失败来源保留历史公告，数量显示为未知。`;}
  else notice.textContent=`本轮 ${summary.total} 个官方来源均采集成功。岗位条件仍须核对官方原文与附件。`;
}
function populateSources(){
  const select=$("source"),current=select.value;
  select.replaceChildren(new Option("全部官方来源",""));
  const names=[...new Set([...state.data.sources.map(item=>item.name),...state.data.jobs.map(item=>item.source)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,"zh-CN"));
  for(const name of names)select.add(new Option(name,name));select.value=current;
}
async function load(){
  const notice=$("notice");notice.className="notice";notice.textContent="正在读取已发布数据……";
  try{
    const response=await fetch(`./data/jobs.json?t=${Date.now()}`,{cache:"no-store"});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    state.data=normalizeData(await response.json());populateSources();renderMetrics();renderSources();render();
  }catch(error){notice.classList.add("error");notice.textContent=`无法读取数据：${error.message}。请检查 GitHub Pages 部署状态。`;}
}
function reset(){
  for(const id of ["q","type","source","relevance","specialty","period"])$(id).value="";
  $("sort").value="published";$("include-excluded").checked=false;render();
}
loadFavorites();
const owner="dujunyao044818-web",repo="jinan-job-radar";
$("run").href=`https://github.com/${owner}/${repo}/actions/workflows/collect.yml`;
$("refresh").onclick=load;$("reset").onclick=reset;$("more").onclick=more;
for(const id of ["q","type","source","relevance","specialty","period","sort","include-excluded"])$(id).addEventListener(id==="q"?"input":"change",render);
load();
