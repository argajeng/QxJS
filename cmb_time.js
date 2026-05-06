let body = $response.body;

if (body) {
    try {
        let obj = JSON.parse(body);
        // 1. 原有逻辑：修改服务器时间
        if (obj.respData && obj.respData.serverTime) {
            let oldTime = obj.respData.serverTime;
            let newTime = oldTime.substring(0, 10) + " 10:00:00";
            obj.respData.serverTime = newTime;
            console.log("成功修改时间为: " + newTime);
        }

        // 2. 新增逻辑：修改库存数量和库存状态
        if (obj.respData && obj.respData.stockInfoVoList && obj.respData.stockInfoVoList.length > 0) {
            // 遍历库存列表（适配多商品场景，单商品也通用）
            obj.respData.stockInfoVoList.forEach(item => {
                item.stockNum = "1";    // 库存数改为1
                item.stockStatus = "1"; // 库存状态改为1
            });
            console.log("成功修改库存：stockNum=1，stockStatus=1");
        }

        // 重新转为字符串
        body = JSON.stringify(obj);
    } catch (e) {
        console.log("解析 JSON 出错或数据结构不匹配");
    }
}

$done({ body });
