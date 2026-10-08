import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {filterJobs,normalizeData,sortJobs,sourceSummary} from "../site/lib.mjs";

const now=Date.parse("2026-10-08T12:00:00+08:00");
const payload={
  updated_at:"2026-10-08T09:25:00+08:00",
  sources:[
    {name:"医院甲",status:"ok",found:2},
    {name:"医院乙",status:"error",found:null}
  ],
  jobs:[
    {id:"a",title:"基础医学博士科研岗",source:"医院甲",type:"医院",published:"2026-10-07",deadline:"2026-10-12",deadline_reliable:true,specialties:["基础医学"],phd_relevance:{category:"博士岗位",score:9,reasons:[],is_postdoc:false},excluded:false},
    {id:"b",title:"药理学岗位",source:"高校甲",type:"高校",published:"2026-09-01",deadline:null,specialties:["药理学"],phd_relevance:{category:"可能符合专业",score:3,reasons:[],is_postdoc:false},excluded:false},
    {id:"c",title:"招聘拟聘公示",source:"医院甲",type:"医院",published:"2026-10-08",phd:false,excluded:true}
  ]
};

test("旧数据可规范化，来源成功率不会把失败误报为空招聘",()=>{
  const data=normalizeData(payload);
  assert.equal(data.jobs.length,3);
  assert.deepEqual(sourceSummary(data.sources),{total:2,successful:1,rate:50});
});

test("关键词、类型、专业与博士判断筛选可以组合",()=>{
  const jobs=normalizeData(payload).jobs;
  const result=filterJobs(jobs,{query:"科研",type:"医院",specialty:"基础医学",relevance:"博士岗位",period:"",includeExcluded:false},now,new Set());
  assert.deepEqual(result.map(job=>job.id),["a"]);
});

test("最近发布、本轮发现、收藏和可靠截止日期筛选",()=>{
  const jobs=normalizeData(payload).jobs;
  jobs[0].is_newly_discovered=true;
  assert.deepEqual(filterJobs(jobs,{period:"7",includeExcluded:false},now,new Set()).map(job=>job.id),["a"]);
  assert.deepEqual(filterJobs(jobs,{period:"discovered",includeExcluded:false},now,new Set()).map(job=>job.id),["a"]);
  assert.deepEqual(filterJobs(jobs,{period:"closing",includeExcluded:false},now,new Set()).map(job=>job.id),["a"]);
  assert.deepEqual(filterJobs(jobs,{period:"favorites",includeExcluded:false},now,new Set(["b"])).map(job=>job.id),["b"]);
});

test("截止日期排序只把可靠日期作为截止依据",()=>{
  const jobs=normalizeData(payload).jobs;
  jobs[1].deadline="2026-10-09";
  jobs[1].deadline_reliable=false;
  assert.deepEqual(sortJobs(jobs.filter(job=>!job.excluded),"deadline").map(job=>job.id),["a","b"]);
});

test("页面加载 collect.yml，且静态资源文件存在",async()=>{
  const html=await readFile(new URL("../site/index.html",import.meta.url),"utf8");
  assert.match(html,/collect\.yml/);
  assert.doesNotMatch(html,/update\.yml/);
  assert.match(html,/\.\/app\.js/);
});
