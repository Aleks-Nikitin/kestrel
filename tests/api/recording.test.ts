import {describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {FakeToolCallingModel} from "langchain";
import {buildRequest} from "@/features/scenarios/model";
import {verificationCall} from "../fixtures/verification";
import {recordingModel} from "../fixtures/recording";
import {property as fixtureProperty,spatial} from "../fixtures/contracts";
import {createComparisonService} from "@/lib/contracts/service";
import {createHandlers} from "@/lib/api/handlers";
import {runPropertyAnalysis} from "@/lib/agent/analysis";
import {readAgentConfig} from "@/lib/agent/config";
// Fictional recorded-area input; no shared fixture or sponsor record is altered.
const property={...fixtureProperty,rentableAreaSqft:{...fixtureProperty.rentableAreaSqft,origin:"source_data" as const}};
const providers={property:{async listProperties(){return[property]},async getProperty(){return property}},spatial:{async getSpatialContext(){return spatial}}};
const service=createComparisonService(providers);
const config=readAgentConfig({ANALYSIS_ENABLED:"true"});
const request=()=>buildRequest(recordingModel(property),property.id,1);
const http=(input:unknown)=>new Request("http://localhost/api/v1/scenarios/compare",{method:"POST",headers:{"content-type":"application/json",origin:"http://localhost"},body:JSON.stringify(input)});
describe("actual scenario-editor financial payload and analysis path",()=>{
 it("transmits the disclosed cost basis, five capex categories, lease note and constraints separately",async()=>{
  const input=request();
  expect(input.scenarios[1].capex).toEqual({renovation:{value:"100000",acceptedEstimate:true},conversion:{value:"0",acceptedEstimate:true},softCosts:{value:"15000",acceptedEstimate:true},contingency:{value:"15000",acceptedEstimate:true},other:{value:"0",acceptedEstimate:true}});
  expect(input.scenarios[1].totalProjectCost.value).toBe("6130000");expect(input.scenarios[1].totalProjectCost.note).toContain("Hypothetical");
  expect(input.scenarios.every(s=>s.leaseBasis==="gross"&&!!s.rentNormalizationNote)).toBe(true);
  expect(input.constraints.maxInitialInvestment.value).toBe("2000000");
  const response=await createHandlers(()=>providers).compare(http(input));expect(response.status).toBe(200);
  const body=await response.json();expect(body.ok).toBe(true);expect(body.data.comparison.preferredScenarioId).toBe("alternative-b");
  expect(body.data.comparison.results.map((r:{noi:{value:string}})=>r.noi.value)).toEqual(["77810","92560","105380"]);
  expect(body.data.comparison.results[1].initialInvestment.value).toBe("130000");expect(body.data.comparison.results[1].yieldOnCost.value).not.toBeNull();
 });
 it("returns a safe input error for malformed period dates",async()=>{
  const input=request();input.scenarios[0].period.start="not-a-date";
  const response=await createHandlers(()=>providers).compare(http(input));
  expect(response.status).toBe(400);
  const body=await response.json();expect(body.ok).toBe(false);expect(body.error.code).toBe("INVALID_INPUT");
  expect(JSON.stringify(body)).not.toContain("RangeError");
 });
 it("never uses a total-project-cost value as missing upfront capex; analysis still requests input",async()=>{
  const input=request();for(const s of input.scenarios.filter(s=>s.role==="alternative"))for(const d of Object.values(s.capex))d.value=null;
  const comparison=await service.compare(input,AbortSignal.timeout(1000));expect(comparison.comparison.preferredScenarioId).toBeNull();expect(comparison.comparison.results[1].initialInvestment.value).toBeNull();
  const primary=new FakeToolCallingModel();
  const analysis=await runPropertyAnalysis({request:{...input,action:"analyze"},service,config,signal:AbortSignal.timeout(1000),models:{primary}});
  expect(analysis.status).toBe("needs_input");expect(primary.index).toBe(0);
  if(analysis.status==="needs_input")expect(analysis.missingInputs.filter(i=>i.path.includes("capex")).length).toBe(10);
 });
 it("keeps unsupported lease normalization and absent capital/return criteria insufficient",async()=>{
  const input=request();input.scenarios.forEach(s=>s.rentNormalizationNote=null);
  let result=await service.compare(input,AbortSignal.timeout(1000));expect(result.comparison.preferredScenarioId).toBeNull();expect(result.comparison.results[0].noi.value).toBeNull();
  const noCriteria=request();noCriteria.constraints.maxInitialInvestment.value=null;noCriteria.constraints.maxPaybackYears.value=null;
  result=await service.compare(noCriteria,AbortSignal.timeout(1000));expect(result.comparison.preferredScenarioId).toBeNull();expect(result.comparison.reasons.some(r=>r.code==="CAPITAL_OR_RETURN_CONSTRAINT_REQUIRED")).toBe(true);
  for(const incomplete of [input,noCriteria]){
   const primary=new FakeToolCallingModel();
   const analysis=await runPropertyAnalysis({request:{...incomplete,action:"analyze"},service,config,signal:AbortSignal.timeout(1000),models:{primary}});
   expect(analysis.status).toBe("needs_input");expect(primary.index).toBe(0);
  }
 });
 it("completes actual native tools after the corrected editor inputs are supplied",async()=>{
  const input=request();const primary=new FakeToolCallingModel({toolCalls:[
   [{name:"write_todos",args:{todos:[{content:"Review disclosed inputs",status:"in_progress"}]},id:"plan"}],
   [{name:"getPropertyContext",args:{propertyId:input.propertyId},id:"context"}],
   [{name:"proposeScenarios",args:{scenarioIds:input.scenarios.map(s=>s.id)},id:"scenarios"}],
   [{name:"runComparison",args:{propertyId:input.propertyId,inputRevision:input.inputRevision},id:"comparison"}],verificationCall(input.propertyId,input.inputRevision,"alternative-b","105380"),[],
  ]});
  const result=await runPropertyAnalysis({request:{...input,action:"analyze"},service,config,signal:AbortSignal.timeout(10000),models:{primary}});
  expect(result.status).toBe("complete");if(result.status!=="complete")throw Error("Incomplete fixture analysis");
  expect(result.comparison.preferredScenarioId).toBe("alternative-b");expect(result.summary.preferredScenarioId).toBe("alternative-b");
  expect(result.execution.completedTools.some(t=>t.name==="runComparison")).toBe(true);
 });
});
