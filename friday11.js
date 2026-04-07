/**
 * Quantumult X 脚本 - 修改 stageStartTime
 */

let body = $response.body;

if (body) {
    let now = new Date();
    // 设置为当天的 11:00:00
    let todayAt11 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0);
    // 获取毫秒时间戳字符串
    let timestamp = todayAt11.getTime().toString();

    // 构造替换逻辑：将匹配到的当天 11 点时间戳替换为 1703815200000
    // 注意：如果服务器返回的时间戳和脚本计算的有一丁点误差，replace 可能匹配失败
    // 建议参考下方的【优化方案】
    let searchStr = `"stageStartTime":"${timestamp}"`;
    let replaceStr = `"stageStartTime":"1703815200000"`;
    
    body = body.replace(searchStr, replaceStr);

    $done({ body });
} else {
    $done({});
}
