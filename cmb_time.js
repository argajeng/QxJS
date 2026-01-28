/**
 * 招行抢购时间修改脚本
 */

let body = $response.body;

if (body) {
    try {
        let obj = JSON.parse(body);
        // 检查路径是否存在：respData -> serverTime
        if (obj.respData && obj.respData.serverTime) {
            let oldTime = obj.respData.serverTime;
            // 逻辑同 Fiddler：截取前10位(日期) + 自定义时间
            let newTime = oldTime.substring(0, 10) + " 11:00:00";
            obj.respData.serverTime = newTime;
            
            body = JSON.stringify(obj);
            console.log("成功修改时间为: " + newTime);
        }
    } catch (e) {
        console.log("解析 JSON 出错或数据结构不匹配");
    }
}

$done({ body });
