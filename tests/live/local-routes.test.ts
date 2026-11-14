import { expect,it } from "vitest";
import { mkdir,writeFile } from "node:fs/promises";
import Decimal from "decimal.js";
import { apiResponse,CatalogResponse,Property,SpatialContext,ComparisonResponse } from "@/lib/contracts";
import { f01 } from "../fixtures/contracts";
const base=process.env.LIVE_BASE_URL??"http://127.0.0.1:3001";
it("executes the real production property, spatial and edited financial routes",async()=>{
 const catalog=apiResponse(CatalogResponse).parse(await(await fetch(base+"/api/v1/properties")).json());if(!catalog.ok)throw Error(`Catalog unavailable: ${catalog.error.code}`);
 expect(catalog.data.properties.length===1).toBe(true);const id=catalog.data.properties[0].id;
 const p=apiResponse(Property).parse(await(await fetch(base+"/api/v1/properties/"+encodeURIComponent(id))).json());if(!p.ok)throw Error(`Property unavailable: ${p.error.code}`);
 const s=apiResponse(SpatialContext).parse(await(await fetch(base+"/api/v1/properties/"+encodeURIComponent(id)+"/spatial")).json());if(!s.ok)throw Error(`Spatial unavailable: ${s.error.code}`);
 expect(s.data.match.status==="verified"&&s.data.model?.commercialPropertyId===p.data.id).toBe(true);
 if(!p.data.rentableAreaSqft.value||!s.data.model)throw Error("Verified area and model are required.");
 const area=new Decimal(p.data.rentableAreaSqft.value);const request=structuredClone(f01);request.propertyId=id;
 for(const [index,scenario]of request.scenarios.entries()){
  scenario.propertyId=id;scenario.rentableAreaSqft={value:area.toFixed()};
  scenario.operatingExpenses={mode:"total",annualAmount:{value:area.times(["6","8","8.5"][index]).toFixed(),note:"Disclosed illustrative annual owner-paid expenses, not sourced market facts."}};
  scenario.capex.renovation={value:area.times(["0","30","45"][index]).toFixed(),note:"Disclosed illustrative initial investment, not a contractor quote."};
 }
 request.constraints.maxInitialInvestment.value=area.times("50").toFixed();
 const compare=async()=>{const response=await fetch(base+"/api/v1/scenarios/compare",{method:"POST",headers:{"content-type":"application/json",origin:new URL(base).origin},body:JSON.stringify(request)});const parsed=apiResponse(ComparisonResponse).parse(await response.json());if(!parsed.ok)throw Error(`Comparison unavailable: ${parsed.error.code}: ${parsed.error.message}; fields ${parsed.error.fieldErrors?.map(e=>e.path+":"+e.message).join(";")??"none"}`);return parsed.data;};
 const first=await compare();expect(first.comparison.preferredScenarioId==="alternative-b").toBe(true);
 request.inputRevision++;request.constraints.maxInitialInvestment.value=area.times("35").toFixed();
 const second=await compare();expect(second.comparison.preferredScenarioId==="alternative-a").toBe(true);expect(second.inputRevision===request.inputRevision).toBe(true);
 // Only the owner-approved minimal projection and explicit binding are retained locally.
 if(process.env.KESTREL_EXPORT_PROTECTED==="true"){
  await mkdir("sponsor-data/runtime",{recursive:true});
  await writeFile("sponsor-data/runtime/demo-property.json",JSON.stringify({property:p.data,modelMapping:{propertyId:id,modelId:s.data.model.id,source:"commercial_property_mapping"}}),{mode:0o600});
  await writeFile("sponsor-data/runtime/reviewed-scenarios.json",JSON.stringify({...request,inputRevision:1}),{mode:0o600});
 }
 console.info("Unmocked production routes:",{propertyMode:p.data.dataMode,spatialMode:s.data.dataMode,explicitMatch:true,comparisonAdaptation:true});
});
