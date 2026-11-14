import {createReadStream} from "node:fs";
import {readFile,writeFile} from "node:fs/promises";
import {createInterface} from "node:readline";
import {expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {CommercialRecord,normalizeCommercialProperty} from "@/lib/providers/costar/records";
import {readCommercialModelMapping,selectCommercialModel} from "@/lib/providers/costar/mapping";
it("verifies the explicit selected mapping and documented address range without assuming scan coverage",async()=>{
 const sceneNumber=Number(process.env.KESTREL_SCENE_STREET_NUMBER);if(!Number.isInteger(sceneNumber)||sceneNumber<=0)throw Error("Supply the independently verified Showcase street number through KESTREL_SCENE_STREET_NUMBER.");
 const filename="sponsor-data/runtime/demo-property.json",config=JSON.parse(await readFile(filename,"utf8"));
 const kitDir="sponsor-data/costar-hackathon-kit";
 const matches=await readCommercialModelMapping({kitDir,agreementAccepted:true},AbortSignal.timeout(10000));
 const match=selectCommercialModel(matches,config.modelMapping.propertyId,config.modelMapping.modelId);
 expect(match.modelId===config.modelMapping.modelId&&match.propertyId===config.property.id).toBe(true);
 const stream=createReadStream(kitDir+"/data/commercial-property.jsonl"),lines=createInterface({input:stream});
 let selected:unknown;try{for await(const line of lines){const r=JSON.parse(line);if(String(r.id)===config.property.id){selected=r;break}}}finally{lines.close();stream.destroy()}
 const record=CommercialRecord.parse(selected);
 expect(record.addresses?.some(a=>a.streetName===record.primaryAddress?.streetName&&Number(a.streetNumber)<=sceneNumber&&Number(a.streetNumberEndRange)>=sceneNumber)).toBe(true);
 const property=normalizeCommercialProperty(record,new Date().toISOString(),{display:true,modelProcessing:true,export:false});
 expect(property.address.note?.includes("Dataset address range:")).toBe(true);
 if(process.env.KESTREL_SAVE_RECORDING==="true")await writeFile(filename,JSON.stringify({...config,property},null,2),{mode:0o600});
 console.info("Address verification",{explicitMapping:true,sceneWithinRecordedAddressRange:true,scanCoverageNotAssumed:true});
});
