import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {FakeToolCallingModel,type StructuredTool} from "langchain";
import {runPropertyAnalysis} from "@/lib/agent/analysis";
import {readAgentConfig} from "@/lib/agent/config";
import {createComparisonService} from "@/lib/contracts/service";
import {failure} from "@/lib/api/http";
import {f01,property,spatial} from "../fixtures/contracts";
class UnavailableModel extends FakeToolCallingModel {
 calls=0;
 constructor(private readonly status:number){super()}
 override bindTools(tools:StructuredTool[]){void tools;return this}
 override async _generate(...args:Parameters<FakeToolCallingModel["_generate"]>):Promise<never>{void args;this.calls++;throw Object.assign(new Error("fictional-credential-must-stay-private"),{status:this.status})}
}
const config=readAgentConfig({ANALYSIS_ENABLED:"true",FALLBACK_ENABLED:"true",OPENROUTER_API_KEY:"fictional-key"});
const request={...f01,action:"analyze" as const};
function service(sponsor=false){const p=structuredClone(property);if(sponsor)p.dataMode="sponsor_dataset";return createComparisonService({property:{async listProperties(){return [p]},async getProperty(){return p}},spatial:{async getSpatialContext(){return spatial}}})}
describe("production analysis failure and deterministic recovery",()=>{
 it.each([400,401,403])("does not retry or switch providers after non-retryable status %s",async status=>{
  const primary=new UnavailableModel(status),secondary=new UnavailableModel(503);
  const error=await runPropertyAnalysis({request,config,service:service(),signal:AbortSignal.timeout(10000),models:{primary,secondary}}).then(()=>null,e=>e);
  expect(error?.code).toBe(status===400?"ANALYSIS_UNAVAILABLE":"UPSTREAM_AUTH");expect(primary.calls).toBe(1);expect(secondary.calls).toBe(0);
  expect(await failure(error).text()).not.toContain("fictional-credential");
 });
 it("does not send approved primary sponsor data to a secondary without separate permission",async()=>{
  const primary=new UnavailableModel(503),secondary=new UnavailableModel(503),comparison=service(true);
  const error=await runPropertyAnalysis({request,config:{...config,sponsorDataProcessingPermitted:true,fallbackSponsorDataPermitted:false},service:comparison,signal:AbortSignal.timeout(10000),models:{primary,secondary}}).then(()=>null,e=>e);
  expect(error?.code).toBe("ANALYSIS_UNAVAILABLE");expect(primary.calls).toBe(2);expect(secondary.calls).toBe(0);
  const result=await comparison.compare(f01,AbortSignal.timeout(1000));expect(result.comparison.preferredScenarioId).toBe("alternative-b");
 });
 it("reports both-provider failure safely while direct financial comparison remains healthy",async()=>{
  const primary=new UnavailableModel(429),secondary=new UnavailableModel(503),comparison=service();
  const original=JSON.stringify(request),started=performance.now();
  const prior=await comparison.compare(f01,AbortSignal.timeout(1000));
  const error=await runPropertyAnalysis({request,config,service:comparison,signal:AbortSignal.timeout(10000),models:{primary,secondary}}).then(()=>null,e=>e);
  expect(error?.code).toBe("ANALYSIS_UNAVAILABLE");expect(primary.calls).toBe(2);expect(secondary.calls).toBe(1);
  const response=failure(error);expect(response.status).toBe(503);const text=await response.text();expect(text).not.toContain("fictional-credential");
  const body=JSON.parse(text);expect(body.ok).toBe(false);expect(body.error.code).toBe("ANALYSIS_UNAVAILABLE");expect(body.error.retryable).toBe(true);
  expect(body).not.toHaveProperty("data");expect(text).not.toContain("bound_claims_v1");
  expect(JSON.stringify(request)).toBe(original);expect(performance.now()-started).toBeLessThan(10000);
  const result=await comparison.compare(f01,AbortSignal.timeout(1000));expect(result.comparison.results[1].noi.value).toBe("190000");
  expect(result.comparison).toEqual(prior.comparison);
 });
 it("does no model work after caller cancellation",async()=>{
  const primary=new UnavailableModel(503),controller=new AbortController();controller.abort(new DOMException("Canceled","AbortError"));
  await expect(runPropertyAnalysis({request,config,service:service(),signal:controller.signal,models:{primary}})).rejects.toMatchObject({name:"AbortError"});expect(primary.calls).toBe(0);
 });
});
