import {mkdir,writeFile} from "node:fs/promises";
import {expect,it} from "vitest";
import {apiResponse,AnalysisResponse,CatalogResponse,ComparisonResponse,Property} from "@/lib/contracts";
import {buildRequest} from "@/features/scenarios/model";
import {recordingModel} from "../fixtures/recording";
const base=process.env.LIVE_BASE_URL??"http://localhost:3000";
it("completes the recording scenario with editor-built disclosed assumptions and real Gemini",async()=>{
 const catalog=apiResponse(CatalogResponse).parse(await(await fetch(base+"/api/v1/properties")).json());if(!catalog.ok)throw Error(`Catalog failed: ${catalog.error.code}`);
 const id=catalog.data.properties[0].id;
 const property=apiResponse(Property).parse(await(await fetch(base+"/api/v1/properties/"+encodeURIComponent(id))).json());if(!property.ok)throw Error(`Property failed: ${property.error.code}`);
 const model=recordingModel(property.data),input=buildRequest(model,id,101);
 const post=async(path:string,data:unknown)=>{const response=await fetch(base+path,{method:"POST",headers:{"content-type":"application/json",origin:new URL(base).origin},body:JSON.stringify(data)});return response.json()};
 const comparison=apiResponse(ComparisonResponse).parse(await post("/api/v1/scenarios/compare",input));if(!comparison.ok)throw Error(`Comparison failed: ${comparison.error.code}`);
 expect(comparison.data.comparison.conclusion==="conditional_preference"&&comparison.data.comparison.preferredScenarioId==="alternative-b").toBe(true);
 expect(comparison.data.comparison.results.every(r=>[r.noi,r.initialInvestment,r.incrementalNoi,r.yieldOnCost].every(m=>m.value!==null))).toBe(true);
 expect(comparison.data.scenarios.every(s=>s.annualRentPerSqft.origin==="user_input"&&!!s.totalProjectCost.note)).toBe(true);
 const analysis=apiResponse(AnalysisResponse).parse(await post("/api/v1/analysis",{...input,action:"analyze"}));if(!analysis.ok)throw Error(`Analysis failed: ${analysis.error.code}`);
 expect(analysis.data.status==="complete").toBe(true);if(analysis.data.status!=="complete")throw Error("Recording analysis still needs inputs.");
 expect(JSON.stringify(analysis.data.comparison)===JSON.stringify(comparison.data.comparison)).toBe(true);
 expect(analysis.data.execution.completedTools.some(t=>t.name==="runComparison")).toBe(true);
 const lower=structuredClone(input);lower.inputRevision++;lower.constraints.maxInitialInvestment.value="1000000";
 const edited=apiResponse(ComparisonResponse).parse(await post("/api/v1/scenarios/compare",lower));if(!edited.ok)throw Error(`Edited comparison failed: ${edited.error.code}`);
 expect(edited.data.comparison.preferredScenarioId==="alternative-a").toBe(true);
 if(process.env.KESTREL_SAVE_RECORDING==="true"){
  await mkdir("sponsor-data/runtime",{recursive:true});
  for(const [file,data]of Object.entries({"recording-scenarios.json":input,"recording-editor-model.json":model,"recording-results.json":{comparison:comparison.data,analysis:analysis.data,edited:edited.data}}))await writeFile("sponsor-data/runtime/"+file,JSON.stringify(data,null,2),{mode:0o600});
 }
 console.info("Recording path verified",{complete:true,canonicalMatch:true,budgetAdaptation:true,model:analysis.data.modelUsage.modelId,elapsedMs:analysis.data.execution.elapsedMs});
},90000);
