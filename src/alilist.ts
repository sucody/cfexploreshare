export interface ShareTokenResponse {
  code: string;
  share_token: string;
  expires_in: number;
}

export interface ShareItem {
  type: string;
  file_id: string;
  childs?: ShareItem[];
  // Add other properties as needed
}

export async function AliGetShareToken(device_id:string, share_id: string, share_pw: string): Promise<ShareTokenResponse | null> {
  let shareToken: ShareTokenResponse | null = null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Origin": "https://www.aliyundrive.com",
    "Referer": "https://www.aliyundrive.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    "X-Canary": "client=web,app=share,version=v2.3.1",
    "X-Device-Id": device_id 
  };
  const rbody = JSON.stringify({
    share_id: share_id,
    share_pwd: share_pw,
  });

  try {
    const response = await fetch('https://api.aliyundrive.com/v2/share_link/get_share_token', {
      method: 'POST',
      headers: headers,
      body: rbody,
    });
    const data: ShareTokenResponse = await response.json();
    //console.log(response.status)
    //console.log(data)
    shareToken = data;
  } catch (error) {
    console.error(error);
  }
  return shareToken;
}

export async function AliListByShare(device_id:string, shareToken: string, share_id: string, parent: string): Promise<{}> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Origin": "https://www.aliyundrive.com",
    "Referer": "https://www.aliyundrive.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    "X-Canary": "client=web,app=share,version=v2.3.1",
    "X-Device-Id": device_id,
    'X-Share-Token': shareToken,
  };

  let next_marker: string | null = '';

  let childs = {}
  childs.items = [];
  //const lists: ShareItem[] = [];

  while (next_marker !== null) {

    let body = {
      share_id: share_id,
      parent_file_id: parent,
      limit: 100,
      image_thumbnail_process: 'image/resize,w_256/format,jpeg',
      image_url_process: 'image/resize,w_1920/format,jpeg/interlace,1',
      video_thumbnail_process: 'video/snapshot,t_1000,f_jpg,ar_auto,w_256',
      order_by: 'name',
      order_direction: 'DESC',      
    }
    if (next_marker && next_marker.length > 0){
      body.marker = next_marker;
    }

    const rbody = JSON.stringify(body);

    next_marker = null;

    try {
      const response = await fetch('https://api.aliyundrive.com/adrive/v2/file/list_by_share', {
        method: 'POST',
        headers,
        body: rbody,
      });

      if (response.ok) {
        const rjson = await response.json();
        next_marker = rjson.next_marker;

        if (next_marker.length === 0) {
          next_marker = null;
        }
        console.log(`next_marker: ${next_marker}`)
        //console.log(JSON.stringify(rjson, null, 3).encode().decode('unicode_escape'));

        for (const item of rjson.items) {
          if (item.type === 'folder') {
            //item.childs = await listByShare(shareToken, share_id, item.file_id);
            item.childs = [];
          }
          childs.items.push(item);
        }
      } else {
        childs.error = `${response.status} ${response.statusText}`;
        childs.items = [];
        //console.error(response.statusText);
        //console.error(response.status);
      }
    } catch (error) {
      console.error(error);
      childs.error = `999 ${error}`
      childs.items = [];
    }
  }

  return childs;
}

export async function AliGetShareByAnonymous(link: string) {
  const url_pattern = /https:\/\/www\.aliyundrive\.com\/s\/([0-9a-zA-Z]+)/;
  const matches = link.match(url_pattern);
  let share_id: string | null = null;

  if (matches) {
    share_id = matches[1];
  } else {
    return {};
  }

  const headers: HeadersInit = {};
  const rbody = JSON.stringify({
    share_id,
  });

  try {
    const response = await fetch(`https://api.aliyundrive.com/adrive/v3/share_link/get_share_by_anonymous?share_id=${share_id}`, {
      method: 'POST',
      headers,
      body: rbody,
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error(error);
  }

  return {};
}
