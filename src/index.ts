/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 * 
 * npx wrangler dev --test-scheduled
 * curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
 */

import {AliGetShareToken, AliListByShare, ShareTokenResponse} from "./alilist";


let yunziyuan_token = null;
let yunziyuan_explorer = null;
let yunziyuan_host = null;

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	kv_exploreshare: KVNamespace;
	YUNZIYUAN_HOST: string;
	YUNZIYUAN_EXPLORER: string;
	YUNZIYUAN_TOKEN: string;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
	//
	// Example binding to a D1 Database. Learn more at https://developers.cloudflare.com/workers/platform/bindings/#d1-database-bindings
	// DB: D1Database
}

type AliExploreShare = {
	error: string
	tag: string
	result: {
		id: string
		link: string
		parent: string
		password: string
		namepath: string
		idpath: string
	}
}

function ExploreConsumePayload(){
	return {
		'explorer': yunziyuan_explorer,
		'action': 'consume'
	};
}

function ExploreReportPayload(tag:string, payload:JSONObject){
	return {
		'explorer': yunziyuan_explorer,
		'action': 'report',
		'tag': tag,
		'payload': payload
	};
}

function api_yunziyuan<T>(url: string, headers: JSONObject = null, body: JSONObject = null): Promise<T> {
	const _url = `https://${yunziyuan_host}/api/${url}`
    let _headers = headers ? headers : {};	
    _headers['Content-Type'] = 'application/json';
    _headers['Authorization'] = `Bearer ${yunziyuan_token}`;

    const _body = body ? JSON.stringify(body) : null;

	return fetch(_url, {method: 'POST', headers: _headers, body: _body})
	.then(response => {
	  if (!response.ok) {
	    //throw new Error(response.statusText)
	    return null;
	  }
	  return response.json() as Promise<{ data: T }>
	})
	.then(data => {
	    return data
	})
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default {
	// The scheduled handler is invoked at the interval set in our wrangler.toml's
	// [[triggers]] configuration.
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`trigger fired at ${event.cron}`);
		yunziyuan_token = env.YUNZIYUAN_TOKEN;
		yunziyuan_explorer = env.YUNZIYUAN_EXPLORER;
		yunziyuan_host = env.YUNZIYUAN_HOST;

		let device_id = generateUUID();

		let r = await api_yunziyuan<AliExploreShare>('exploreshare', null, ExploreConsumePayload())

		if (r && r.tag && r.result){
			const alishare =  JSON.parse(r.result);
			const pattern = /^https:\/\/www\.aliyundrive\.com\/s\/([0-9a-zA-Z]+)$/;
            let match = alishare.link.match(pattern);
            if (match && alishare.parent){
            	console.log(alishare.link);
				let share_id = match[1];
				let parent = alishare.parent;
				let password = alishare.password ? alishare.password : "";

				let namepath = alishare.namepath ? alishare.namepath : `${share_id}/${alishare.parent}`
				let idpath = alishare.idpath ? alishare.idpath : `${share_id}/${alishare.parent}`

				let share_token = null; //await env.kv_exploreshare.get(share_id);        
				if (share_token === null) {            
					console.log('get share token from aliyundrive')
					let stoken = await AliGetShareToken(device_id, share_id, password);  
					if(stoken && stoken.share_token && stoken.expires_in){
						share_token = stoken.share_token;  
						console.log('set share token to cloudflare kv')
						//await env.kv_exploreshare.put(share_id, share_token, {expirationTtl: stoken.expires_in - 60});
					}
					if(stoken && stoken.code){
						if(stoken.code == "ShareLink.Cancelled"){
							console.log(`share_link ${share_id} is cancelled by the creator`);							
						}
						const reports = {
							namepath: namepath,
							idpath: idpath,
							error: stoken.code
						}
						r = await api_yunziyuan<AliExploreShare>('exploreshare', null, ExploreReportPayload(r.tag, reports));	
						console.log(r);					
					}
				}else{
					console.log('get share token from cloudflare kv')
				}

				if(share_token){
					const childs = await AliListByShare(device_id, share_token, share_id, parent);
					//for (const item of shares) {
					//     console.log( JSON.stringify(item) )
					//}						
					//console.log('length:',shares.length);
					let reports = {
						namepath: namepath,
						idpath: idpath
					};
					if (childs.error){
						reports.error = childs.error;
						console.log(reports.error)
					}else{
						reports.items = childs.items;
					}
					if (childs.error != 'Unauthorized'){
						console.log( JSON.stringify(reports) )
						r = await api_yunziyuan<AliExploreShare>('exploreshare', null, ExploreReportPayload(r.tag, reports));
						console.log(r);						
					}					
				}
            }				
		}
	},
};
