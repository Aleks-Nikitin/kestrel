import { config } from "dotenv";
import { expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import Decimal from "decimal.js";
import { createRuntimeProviders } from "@/lib/providers/runtime";
import { createComparisonService } from "@/lib/contracts/service";
import { f01 } from "../fixtures/contracts";
config({quiet:true});
it("compares current real dataset facts through runtime adapters with disclosed user estimates",async()=>{
 if(process.env.SPONSOR_AGREEMENT_ACCEPTED!=="true"||process.env.SPONSOR_DISPLAY_PERMITTED!=="true")throw new Error("Explicit sponsor runtime access flags are required.");
 const providers=createRuntimeProviders();const signal=AbortSignal.timeout(20000);
 const property=(await providers.property.listProperties({limit:1,signal}))[0];
 if(!property.rentableAreaSqft.value)throw new Error("A sourced rentable area is required for the real-data fixture.");
 const input=structuredClone(f01);input.propertyId=property.id;
 const area=new Decimal(property.rentableAreaSqft.value);
 for(const [index,s]of input.scenarios.entries()){
  s.propertyId=property.id;s.rentableAreaSqft={value:area.toFixed()};
  s.operatingExpenses={mode:"total",annualAmount:{value:area.times(["6","8","8.5"][index]).toFixed(),note:"Explicit illustrative owner-paid annual costs; not sponsor market data."}};
  s.capex.renovation={value:area.times(["0","30","45"][index]).toFixed(),note:"Explicit illustrative conversion investment; not a contractor quote."};
 }
 input.constraints.maxInitialInvestment.value=area.times("50").toFixed();
 const service=createComparisonService(providers);const initial=await service.compare(input,signal);
 expect(initial.comparison.preferredScenarioId==="alternative-b").toBe(true);
 input.inputRevision++;input.constraints.maxInitialInvestment.value=area.times("35").toFixed();
 const edited=await service.compare(input,signal);
 expect(edited.comparison.preferredScenarioId==="alternative-a").toBe(true);
 expect(initial.scenarios.every(s=>s.rentableAreaSqft.origin==="source_data")).toBe(true);
 expect(initial.scenarios.every(s=>s.annualRentPerSqft.origin==="user_input")).toBe(true);
});
