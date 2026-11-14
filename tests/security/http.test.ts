import {expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {z} from "zod";
import {readJSON} from "@/lib/api/http";
it("cancels a stalled body reader on request cancellation instead of waiting forever",async()=>{
 const controller=new AbortController();const canceled=vi.fn();
 const body=new ReadableStream({cancel:canceled});
 const request=new Request("http://localhost/api/v1/analysis",{method:"POST",headers:{"content-type":"application/json"},body,signal:controller.signal,duplex:"half"} as RequestInit);
 const pending=readJSON(request,z.object({}));
 controller.abort(new DOMException("Client canceled","AbortError"));
 await expect(pending).rejects.toMatchObject({name:"AbortError"});
 expect(canceled).toHaveBeenCalledOnce();
});
