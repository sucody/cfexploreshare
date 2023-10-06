// src/alilist.ts
async function AliGetShareToken(device_id, share_id, share_pw) {
  let shareToken = null;
  const headers = {
    "Content-Type": "application/json",
    "Origin": "https://www.aliyundrive.com",
    "Referer": "https://www.aliyundrive.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    "X-Canary": "client=web,app=share,version=v2.3.1",
    "X-Device-Id": device_id
  };
  const rbody = JSON.stringify({
    share_id,
    share_pwd: share_pw
  });
  try {
    const response = await fetch("https://api.aliyundrive.com/v2/share_link/get_share_token", {
      method: "POST",
      headers,
      body: rbody
    });
    const data = await response.json();
    shareToken = data;
  } catch (error) {
    console.error(error);
  }
  return shareToken;
}
async function AliListByShare(device_id, shareToken, share_id, parent) {
  const headers = {
    "Content-Type": "application/json",
    "Origin": "https://www.aliyundrive.com",
    "Referer": "https://www.aliyundrive.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    "X-Canary": "client=web,app=share,version=v2.3.1",
    "X-Device-Id": device_id,
    "X-Share-Token": shareToken
  };
  let next_marker = "";
  let childs = {};
  childs.items = [];
  while (next_marker !== null) {
    let body = {
      share_id,
      parent_file_id: parent,
      limit: 100,
      image_thumbnail_process: "image/resize,w_256/format,jpeg",
      image_url_process: "image/resize,w_1920/format,jpeg/interlace,1",
      video_thumbnail_process: "video/snapshot,t_1000,f_jpg,ar_auto,w_256",
      order_by: "name",
      order_direction: "DESC"
    };
    if (next_marker && next_marker.length > 0) {
      body.marker = next_marker;
    }
    const rbody = JSON.stringify(body);
    next_marker = null;
    try {
      const response = await fetch("https://api.aliyundrive.com/adrive/v2/file/list_by_share", {
        method: "POST",
        headers,
        body: rbody
      });
      if (response.ok) {
        const rjson = await response.json();
        next_marker = rjson.next_marker;
        if (next_marker.length === 0) {
          next_marker = null;
        }
        console.log(`next_marker: ${next_marker}`);
        for (const item of rjson.items) {
          if (item.type === "folder") {
            item.childs = [];
          }
          childs.items.push(item);
        }
      } else {
        childs.error = `${response.status} ${response.statusText}`;
        childs.items = [];
      }
    } catch (error) {
      console.error(error);
      childs.error = `999 ${error}`;
      childs.items = [];
    }
  }
  return childs;
}

// src/index.ts
var yunziyuan_token = null;
var yunziyuan_explorer = null;
var yunziyuan_host = null;
function ExploreConsumePayload() {
  return {
    "explorer": yunziyuan_explorer,
    "action": "consume"
  };
}
function ExploreReportPayload(tag, payload) {
  return {
    "explorer": yunziyuan_explorer,
    "action": "report",
    "tag": tag,
    "payload": payload
  };
}
function api_yunziyuan(url, headers = null, body = null) {
  const _url = `https://${yunziyuan_host}/api/${url}`;
  let _headers = headers ? headers : {};
  _headers["Content-Type"] = "application/json";
  _headers["Authorization"] = `Bearer ${yunziyuan_token}`;
  const _body = body ? JSON.stringify(body) : null;
  return fetch(_url, { method: "POST", headers: _headers, body: _body }).then((response) => {
    if (!response.ok) {
      return null;
    }
    return response.json();
  }).then((data) => {
    return data;
  });
}
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
var src_default = {
  // The scheduled handler is invoked at the interval set in our wrangler.toml's
  // [[triggers]] configuration.
  async scheduled(event, env, ctx) {
    console.log(`trigger fired at ${event.cron}`);
    yunziyuan_token = env.YUNZIYUAN_TOKEN;
    yunziyuan_explorer = env.YUNZIYUAN_EXPLORER;
    yunziyuan_host = env.YUNZIYUAN_HOST;
    let device_id = generateUUID();
    let r = await api_yunziyuan("exploreshare", null, ExploreConsumePayload());
    if (r && r.tag && r.result) {
      const alishare = JSON.parse(r.result);
      const pattern = /^https:\/\/www\.aliyundrive\.com\/s\/([0-9a-zA-Z]+)$/;
      let match = alishare.link.match(pattern);
      if (match && alishare.parent) {
        console.log(alishare.link);
        let share_id = match[1];
        let parent = alishare.parent;
        let password = alishare.password ? alishare.password : "";
        let namepath = alishare.namepath ? alishare.namepath : `${share_id}/${alishare.parent}`;
        let idpath = alishare.idpath ? alishare.idpath : `${share_id}/${alishare.parent}`;
        let share_token = null;//await env.kv_exploreshare.get(share_id);
        if (share_token === null) {
          console.log("get share token from aliyundrive");
          let stoken = await AliGetShareToken(device_id, share_id, password);
          if (stoken && stoken.share_token && stoken.expires_in) {
            share_token = stoken.share_token;
            console.log("set share token to cloudflare kv");
            //await env.kv_exploreshare.put(share_id, share_token, { expirationTtl: stoken.expires_in - 60 });
          }
          if (stoken && stoken.code) {
            if (stoken.code == "ShareLink.Cancelled") {
              console.log(`share_link ${share_id} is cancelled by the creator`);
            }
            const reports = {
              namepath,
              idpath,
              error: stoken.code
            };
            r = await api_yunziyuan("exploreshare", null, ExploreReportPayload(r.tag, reports));
            console.log(r);
          }
        } else {
          console.log("get share token from cloudflare kv");
        }
        if (share_token) {
          const childs = await AliListByShare(device_id, share_token, share_id, parent);
          let reports = {
            namepath,
            idpath
          };
          if (childs.error) {
            reports.error = childs.error;
            console.log(reports.error);
          } else {
            reports.items = childs.items;
          }
          if (childs.error != "Unauthorized") {
            console.log(JSON.stringify(reports));
            r = await api_yunziyuan("exploreshare", null, ExploreReportPayload(r.tag, reports));
            console.log(r);
          }
        }
      }
    }
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map