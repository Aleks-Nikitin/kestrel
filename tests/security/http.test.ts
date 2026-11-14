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

it.each(["http://localhost:3000","http://127.0.0.1:3000","http://[::1]:3000"])("accepts the legitimate local alias %s at the configured port",async origin=>{
 vi.stubEnv("APP_ORIGIN","http://localhost:3000");
 try{await expect(readJSON(new Request("http://localhost:3000/api/v1/analysis",{method:"POST",headers:{origin,"content-type":"application/json"},body:"{}"}),z.strictObject({}))).resolves.toEqual({});}
 finally{vi.unstubAllEnvs()}
});
it.each(["https://evil.invalid","http://localhost:3001","http://127.0.0.1.evil.invalid:3000","https://localhost:3000","http://localhost:3000/path","null"])("rejects the disallowed origin %s",async origin=>{
 vi.stubEnv("APP_ORIGIN","http://localhost:3000");
 try{await expect(readJSON(new Request("http://localhost:3000/api/v1/analysis",{method:"POST",headers:{origin,"content-type":"application/json"},body:"{}"}),z.strictObject({}))).rejects.toMatchObject({status:403});}
 finally{vi.unstubAllEnvs()}
});
it("does not extend a non-loopback configured origin to local callers",async()=>{
 vi.stubEnv("APP_ORIGIN","https://example.invalid");
 try{await expect(readJSON(new Request("http://localhost:3000/api/v1/analysis",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:"{}"}),z.strictObject({}))).rejects.toMatchObject({status:403});}
 finally{vi.unstubAllEnvs()}
});
