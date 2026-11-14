import { describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { createAnalysisHandler } from "@/lib/api/analysis";
import { readAgentConfig } from "@/lib/agent/config";
import { createComparisonService } from "@/lib/contracts/service";
import { apiResponse, AnalysisResponse } from "@/lib/contracts";
import { f01, property, spatial } from "../fixtures/contracts";
const service=createComparisonService({property:{async listProperties(){return [property]},async getProperty(){return property}},spatial:{async getSpatialContext(){return spatial}}});
const post=(enabled=false)=>createAnalysisHandler(()=>({service,config:readAgentConfig({ANALYSIS_ENABLED:String(enabled)})}));
const request=(data:unknown,origin="http://localhost")=>new Request("http://localhost/api/v1/analysis",{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify(data)});
describe("analysis HTTP boundary",()=>{
 it("rejects invalid data before provider or model work",async()=>expect((await post()(request({}))).status).toBe(400));
 it("rejects cross-origin mutation",async()=>expect((await post()(request({...f01,action:"analyze"},"https://elsewhere.invalid"))).status).toBe(403));
 it("honors the kill switch",async()=>{
  const response=await post()(request({...f01,action:"analyze"}));expect(response.status).toBe(503);expect((await response.json()).error.code).toBe("ANALYSIS_UNAVAILABLE");
 });
 it("returns canonical needs-input without a model when assumptions are missing",async()=>{
  const input=structuredClone(f01);input.scenarios[0].annualRentPerSqft.value=null;
  const response=await post(true)(request({...input,action:"analyze"}));const envelope=apiResponse(AnalysisResponse).parse(await response.json());
  expect(response.status).toBe(200);expect(envelope.ok).toBe(true);if(envelope.ok)expect(envelope.data.status).toBe("needs_input");
 });
});
