require(["jquery", "msg", "layer", "mustache"], function (
    $,
    msg,
    Layer,
    mustache
) {
    var pageNo = "2629038";
    var msgremoved = false;

    var preShowTimeStartTime = 3600 * 1000; // 抢购启动时间前置开启倒计时提醒
    var localStartTime; //标记本地启动时间
    var currentServerTime = getTime(currentTm); //当前系统时间
    var startTime1 = getTime(sessionStartTm1); //第一轮开始时间
    var startTime2 = getTime(sessionStartTm2); //第二轮开始时间

    var syncTimeDuration = 10000;
    //停止刷新同步控制【直通当天开始后可以一直领取，只有抢购才会控制此值。抢购停止检测前置条件：可抢购物品空了】
    var syncTime = 1; //1 2 0；1和2都是倒计时 0 关闭
    var serverTimeSynced = false; //是否已经同步过系统时间
    initPage();
    initListeners();
    function initListeners() {
        //展示权益信息面板
        $("body").on("click", ".title-btn", function () {
            if ($(this).hasClass("none")) {
                return;
            }
            var list = [];
            var listStr = $(this).attr("data-msg");
            var _s = listStr.split("|");
            for (var i = 0; i < _s.length; i++) {
                var line = _s[i].split("#");
                if (+line[1] > 0) {
                    list.push({
                        name: line[0],
                        num: line[1],
                    });
                }
            }
            $(".rights-pop .content").html(
                mustache.render($("#rights-pop-tpl").html(), { list: list })
            );
            $(".rights-pop, .pop-mask").show();
        });
        //权益面板关闭
        $("body").on("click", ".rights-pop .close-btn", function () {
            TDOnEvent("2629038022");
            SRSOnEvent("2629038022");
            $(".rights-pop, .pop-mask").hide();
        });

        //拦截点击
        $(".pop-mask, .loading-mask").on("touchmove", function (e) {
            e.preventDefault();
            e.stopPropagation();
        });

        $("body").on("click", ".tip-btn", function () {
            msg.info("消费统计金额可能延迟</br>直通资格以实际为准");
        });

        $("body").on("click", ".note-btn", function () {
            msg("已享次数可能有延迟</br>以实际为准");
        });

        //领取或者抽奖
        $("body").on("click", ".activity-list .container", getGiftHandler);

        //关闭提示公告
        $(".head-note-msg .clost-btn").on("touchstart", function (e) {
            msgremoved = true;
            $(".head-note-msg").remove();
            TDOnEvent("2629038018");
            SRSOnEvent("2629038018");
            e.preventDefault();
            e.stopPropagation();
        });
        $("body").on("touchstart", ".bottom-links .link", function () {
            var linkNo = pageNo + "0" + ($(this).index() + 28);
            TDOnEvent(linkNo);
            SRSOnEvent(linkNo);
        });
    }

    function initPage() {
        //页面初始化埋点统计
        var statuse = "3";

        var pageInfo = { statuse: statuse };
        TDOnEvent("2629038000", "", pageInfo);
        SRSOnEvent("2629038000", "", pageInfo);
        switchText(); //轮播公告
        if(reachShowFlag){
           if ($(".head-container").hasClass("mode-2") ||
               $(".head-container").hasClass("mode-3")) {
               getProgressData();
           }
        }else{
            //展示正在计算中
            $(".progress-container").addClass("counting");
            $(".progress-container").removeClass("hide");
        }


        if (isFriday) {
            syncServerTime();
            // 立即更新按钮状态，确保显示为可抢购
            updateBtnStatus();
        } else {
            setCurrentPageStatus("not-friday");
            // 非周五也更新按钮状态
            updateBtnStatus();
        }
        if (adShowFlag) {
            if (isMDBApp()) {
                // 定位,仅在mdbapp内使用，非买单吧环境，使用空值
                lbsPluginGPSUtil.getAppCacheCityInfo(function (result) {
                    var cityCode = "";
                    if (result.resultCode >= 1) {
                        cityCode = result.appCityCode || "";
                    }
                    fetchBannerList(cityCode);
                }, "3.0");
            } else {
                fetchBannerList("");
            }
        } else {
            $(".bottom-links").remove();
        }


    }

    var tickTimeTimer = null;
    //启动倒计时
    function tickTime() {
        var pageSpendTime = Date.now() - localStartTime; //启动倒计时后，当前页面的时间
        var targetTime = startTime1;
        if (syncTime === 2) {
            targetTime = startTime2;
        }
        var currentLeftTime = targetTime - currentServerTime - pageSpendTime; //剩余时间：总剩余时间-本地经过的时间
        var _totalSeconds = Math.ceil(currentLeftTime / 1000);

        var showMins = "" + Math.floor(_totalSeconds / 60);
        var showSeconds = "" + (_totalSeconds % 60);
        if (showMins.length == 1) {
            showMins = "0" + showMins;
        }
        if (showSeconds.length == 1) {
            showSeconds = "0" + showSeconds;
        }
        var c_dom = $(".count-down").eq(syncTime - 1);
        var preMin = c_dom.attr("pre-min");
        var preSec = c_dom.attr("pre-sec");
        if (preMin != showMins || preSec != showSeconds) {
            c_dom.attr("pre-min", showMins);
            c_dom.attr("pre-sec", showSeconds)
            c_dom.html(
                '<span class="left">' +
                    showMins +
                    "</span>" +
                    ":" +
                    '<span class="right">' +
                    showSeconds +
                    "</span>"
            );
        }
        clearTimeout(tickTimeTimer);
        if (_totalSeconds <= 0) {

            if (syncTime === 1) {
                syncTime = 2;
            } else {
                syncTime = 0;
            }

            var turn = syncTime === 0 ? "friday" : "count_down_2";
            setCurrentPageStatus(turn);
            timeupChangeBtnStatus(turn);//只有倒计时情况需要切换按钮的状态
        }
        if (syncTime > 0) {
            tickTimeTimer = setTimeout(tickTime, 200);
        }
    }

    var syncTimeTimer = null; //倒计时句柄
    //初始化倒计时功能,leftTime表示剩余毫秒数
    function startTimeCountDown() {

        //抢购用户
        if (currentServerTime > startTime2) {
            //两场都开启
            $(".observe-btn").removeClass("show");
            syncTime = 0;
            setCurrentPageStatus("friday");
        } else if (currentServerTime < startTime1 - preShowTimeStartTime) {
            setCurrentPageStatus("not-ready");
            $(".observe-btn").addClass("show");
            syncTime = 0;
        } else {
            //需要倒计时了
            if (
                currentServerTime < startTime1 &&
                currentServerTime >= startTime1 - preShowTimeStartTime
            ) {
                syncTime = 1;
                setCurrentPageStatus("count_down_1");
            } else if (
                currentServerTime < startTime2 &&
                currentServerTime >= startTime1
            ) {
                syncTime = 2;
                setCurrentPageStatus("count_down_2");
            } else {
                syncTime = 0;
                setCurrentPageStatus("friday");
            }
            //开始前的时间范围内，展示开始倒计时
            tickTime();
            //开启每10秒同步一次服务器时间功能
            clearTimeout(syncTimeTimer);
            if (syncTime > 0) {
                syncTimeTimer = setTimeout(syncServerTime, syncTimeDuration);
            }
        }

    }

    //同步服务器当前时间
    function syncServerTime() {
        $.ajax({
            type: "GET",
            dataType: "json",
            url: base + "/2025red/getNowTime",
            //      url: "/activity/2024/redfriday/getNowTime.json",
            data: {},
            success: function (res) {
                if (syncTime > 0) {
                    currentServerTime = getTime(res.currentTm || "");
                    localStartTime = Date.now();
                    // 响应成功之后调用
                    startTimeCountDown();
                    serverTimeSynced = true
                }
            },
            error: function (e) {
                if (serverTimeSynced) {
                    //同步失败，基于成功过的，延迟同步
                    setTimeout(syncServerTime, syncTimeDuration);
                } else {
                    //同步失败，基于没有成功过的，立即再次同步
                    setTimeout(syncServerTime, 50);
                }
            },
        });
    }

    //
    function getURLParams(key) {
        var keyVals = location.search.replace("?", "").split("&");
        for (var i = 0, len = keyVals.length; i < len; i++) {
            var itemStr = keyVals[i];
            if (itemStr) {
                var keyVal = itemStr.split("=");
                if (keyVal.length == 2 && key === keyVal[0]) {
                    return keyVal[1];
                }
            }
        }
        return "";
    }

    //进度条数据加载
    function getProgressData() {
        $.ajax({
            type: "GET",
            dataType: "json",
            url: base + "/2025red/getReach", //2025red/getReach
            //      url: "/activity/2024/redfriday/progress-2level.json", //2025red/getReach
            data: {
                actId: getURLParams("actId"),
            },
            success: function (res) {
                if (res.returnCode === "000000") {
                    var levels = res.reachTarget.split("|").reverse(); //保证第一位一定是最高level
                    var reachWord = res.reachWord.split("|").reverse(); //提示话术和上方的达标顺序同步
                    var levelType = "t-" + levels.length + "-levels"; //逻辑上来说应该只有1和2两种情况
                    $(".progress-container").addClass(levelType);
                    var renderData = {};
                    for (var i = 0; i < levels.length; i++) {
                        var levelTarget = levels[i];
                        $(".progress-bar .track").attr("data-target-" + i, levelTarget);
                        renderData["target" + i] = levelTarget;
                        renderData["note" + i] = reachWord[i];
                    }
                    //渲染提示话术
                    $(".progress-container .note-msg").html(
                        mustache.render($("#progress-tpl").html(), renderData)
                    );

                    //展示滑块位置
                    var userValue = +res.reachCurrent || 0;
                    $(".progress-bar .slider").attr("data-val", userValue.toFixed(2));
                    if (+userValue >= +levels[0]) {
                        $(".progress-bar .track").addClass("touch-2");
                        $(".progress-bar .slider")
                            .addClass("hide")
                            .attr("style", "width:6.38rem");
                    } else if (levels.length == 2) {
                        if (+userValue > +levels[1]) {
                            $(".progress-bar .track").addClass("touch-1");
                            var w =
                                3.5 +
                                ((userValue - levels[1]) /
                                    (levels[0] - levels[1])) *
                                    2.45;
                            $(".progress-bar .slider").attr(
                                "style",
                                "width:" + Math.min(Math.max(4.9, w), 6.38) + "rem"
                            );
                        } else if (+userValue == +levels[1]) {
                            $(".progress-bar .track").addClass("touch-1");
                            $(".progress-bar .slider")
                                .addClass("hide")
                                .attr("style", "width:3.5rem");
                        } else {
                            var w = (userValue / levels[1]) * 3.15;
                            $(".progress-bar .slider").attr(
                                "style",
                                "width:" + Math.max(1.3, w) + "rem"
                            );
                        }
                    } else if (levels.length == 1) {
                        var w = (userValue / levels[0]) * 5.95;
                        $(".progress-bar .slider").attr(
                            "style",
                            "width:" + Math.min(Math.max(1.3, w), 5.95) + "rem"
                        );
                    }
                    $(".progress-container").removeClass("hide");
                } else {
                    //展示正在计算中
                    $(".progress-container").addClass("counting");
                    $(".progress-container").removeClass("hide");
                }
                dyCalculatePannelPosition();
            },
            error: function (e) {
                //展示正在计算中
                $(".progress-container").addClass("counting");
                $(".progress-container").removeClass("hide");
                dyCalculatePannelPosition();
            },
        });
    }

    //动态计算面板位置
    function dyCalculatePannelPosition() {
        var fontSize = +document.documentElement.style["font-size"].replace(
            "px",
            ""
        );
        var progressEle = $(".progress-container")[0];
        var progressElRect = progressEle.getBoundingClientRect();
        var offset =
            (progressElRect.height + progressEle.offsetTop) / fontSize -
            5.2 +
            0.32;
        $(".activity-main-container").attr("style", "margin-top:" + offset + "rem");
    }

    //处理数据为毫秒值【工具函数】
    function getTime(timestr) {
        var _ = timestr.split(":");
        if (_.length !== 3) {
            //正常的数据格式才能处理【三段式值】
            return 0;
        }
        var totalSeconds = _[0] * 3600 + _[1] * 60 + _[2] * 1;
        return totalSeconds * 1000;
    }

    //基于权限和当前时间，控制
    function setCurrentPageStatus(currentStatus) {
        var container = $(".activity-main-container").removeClass("qiang");
        var title = container
            .find(".title-container")
            .removeClass(
                "qiang-before qiang-friday"
            );
        var listContainer = container
            .find(".activity-list")
            .removeClass("count on before friday zhi-friday-not-ready");
        container.addClass("qiang");
        
        // 移除时间限制，始终显示为可用状态
        title.addClass("qiang-friday");
        listContainer.addClass("on");
        
        // 原有的时间控制逻辑已注释
        /*
        if (currentStatus === "friday") {
            //完全开启状态
            title.addClass("qiang-friday");
            listContainer.addClass("on");
        } else if (currentStatus === "not-ready") {
            //周五当天未开始，又不展示倒计时的时间段
            title.addClass("qiang-friday");
            listContainer.addClass("friday");
            //    } else if (currentStatus == "quiet_count_down") {
            //      //直通静默倒计时
            //      title.addClass("zhi-friday-not-ready");
            //      listContainer.addClass("before");
        } else if (currentStatus == "count_down_1") {
            title.addClass("qiang-friday");
            listContainer.eq(0).addClass("count");
            listContainer.eq(1).addClass("friday");
        } else if (currentStatus == "count_down_2") {
            title.addClass("qiang-friday");
            listContainer.eq(0).addClass("on");
            listContainer.eq(1).addClass("count");
        } else if (currentStatus == "not-friday") {
            title.addClass("qiang-before");
            listContainer.addClass("before");
        }
        */
    }

    //  var returnCodeMessageMapping = {
    //    RY1001: "请求参数异常",
    //    RY1014: "抢购中，请稍后再试",
    //    RE1011: "操作redis缓存异常",
    //    RY1015: "当前日期非周五",
    //    RY1016: "已参与抢兑",
    //    RY1022: "未查询到活动信息",
    //    RY1023: "前时间不在活动周期内",
    //    RE1010: "查询活动信息异常",
    //    RY1024: "奖品信息不存在",
    //    RY1017: "抢兑未开始",
    //    RE1035: "活动时间校验异常",
    //    // RY1020: "已抢完",【弹窗】
    //    // RY1025: "场景已使用",【弹窗】
    //    ZH9999: "手太快...",
    //    // RY1026: "非最红注册用户",[弹窗]
    //  };

    //展示领取结果
    function showResultHandler(res, isRetry) {
        var returnCode = res.returnCode;
        var returnMsg = "抱歉，请再试一次";
        
        // 如果是重试模式且失败，直接重试而不显示弹窗
        if (isRetry && returnCode !== "000000" && returnCode !== "RY1016") {
            if (retryCount < maxRetries) {
                console.log("重试第" + (retryCount + 1) + "次");
                setTimeout(function() {
                    retryGift();
                }, 500); // 延迟500ms后重试
                return;
            } else {
                console.log("重试次数已达上限");
                retryCount = 0;
                currentPrizeId = null;
            }
        }
        
        if (returnCode === "ZH9999") {
            // 手太快，自动重试
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(function() {
                    retryGift();
                }, 300);
                return;
            } else {
                msg(returnMsg);
                retryCount = 0;
                currentPrizeId = null;
                return;
            }
        }
        if (returnCode === "RY1014") {
            // 抢购中，自动重试
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(function() {
                    retryGift();
                }, 800);
                return;
            } else {
                msg("请勿频繁点击");
                retryCount = 0;
                currentPrizeId = null;
                return;
            }
        }

        // 成功情况
        if (returnCode === "RY1016" || returnCode === "000000") {
            retryCount = 0;
            currentPrizeId = null;
            var succssMessage = {
                "01": "红包票券", //红包
                "02": "代金券", // 代金券
                "03": "刷卡金", //刷卡金
                "04": "红包票券", //支付宝红包
                "07": "红包票券", // 支付宝红包海豚版
            }[res.prizeTp];
            var _layer = new Layer({
                className: "success-popup",
                contentHTML: mustache.render($("#success-tpl").html(), {
                    name: succssMessage,
                }),
                scroll: false,
                height: 325,
                afterBuild: function () {
                    $(".success-popup .ok-btn").on("click", function () {
                        TDOnEvent("2629038025");
                        SRSOnEvent("2629038025");
                        _layer.close();
                    });
                },
            });
            _layer.open();
            return;
        } else if (returnCode === "RY1020") {
            // 已抢完，自动重试
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(function() {
                    retryGift();
                }, 500);
                return;
            } else {
                retryCount = 0;
                currentPrizeId = null;
                //领取失败
                var failMessage = {
                    "01": "红包", //红包
                    "02": "代金券", // 代金券
                    "03": "刷卡金", //刷卡金
                    "04": "支付宝红包", //支付宝红包
                    "07": "支付宝红包", //支付宝红包海豚版
                }[res.prizeTp];
                var _layer = new Layer({
                    className: "fail-popup",
                    contentHTML: mustache.render($("#fail-tpl").html(), {
                        prdName: failMessage,
                    }),
                    scroll: false,
                    height: 281,
                    afterBuild: function () {
                        $(".fail-popup .ok-btn").on("click", function () {
                            TDOnEvent("2629038026");
                            SRSOnEvent("2629038026");
                            _layer.close();
                        });
                    },
                });
                _layer.open();
                return;
            }
        } else {
            // 其他错误，自动重试
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(function() {
                    retryGift();
                }, 500);
                return;
            } else {
                retryCount = 0;
                currentPrizeId = null;
                msg(returnMsg);
            }
        }
    }

    //展示loading蒙版
    function showLoading() {
        $(".loading-mask").show();
    }

    //隐藏loading蒙版
    function hideLoading() {
        $(".loading-mask").hide();
    }

    //重试抢购
    function retryGift() {
        if (!currentPrizeId) {
            return;
        }
        
        $.ajax({
            type: "GET",
            dataType: "json",
            url: base + "/2025red/red25Purchase",
            data: {
                prizeId: currentPrizeId,
                actId: getURLParams("actId"),
            },
            success: function (res) {
                showResultHandler(res, true); //标记为重试模式
                if (["000000", "RY1016", "RY1020", "RY1025"].includes(res.returnCode)) {
                    updateBtnStatus();
                }
            },
            error: function (e) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(function() {
                        retryGift();
                    }, 500);
                } else {
                    hideLoading();
                    msg("抱歉，请再试一次");
                    loading = false;
                    retryCount = 0;
                    currentPrizeId = null;
                }
            },
        });
    }

    var loading = false; //控制领取的节奏
    var retryCount = 0; //重试计数器
    var maxRetries = 5; //最大重试次数
    var currentPrizeId = null; //当前抢购的商品ID
    //领取
    function getGiftHandler() {
        var activeContainer = this;
        //添加埋点统计
        var TDStartNum = 13;
        $(".activity-list .container").each(function (index, ele) {
            if (ele === activeContainer) {
                var eleNum = TDStartNum + index + "";
                if (eleNum.length == 1) {
                    eleNum = pageNo + "00" + eleNum;
                } else if (eleNum.length == 2) {
                    eleNum = pageNo + "0" + eleNum;
                }
                SRSOnEvent(eleNum);
                TDOnEvent(eleNum);
            }
        });

        var giftEle = $(activeContainer);
        if (giftEle.closest(".li-item").hasClass("used")) {
            return;
        }
        var prdUrl = giftEle.attr("data-url");
        if (!isFriday || giftEle.attr("data-tp") === "02") {
            window.location.href = prdUrl; //非周五默认亮起的,或者周五代金券产品都去跳去看看
            return;
        }
        // 移除未开始和已售罄的限制
        // if (!giftEle.closest(".activity-list").hasClass("on") || giftEle.hasClass("disabled")) {
        //     return;
        // }
        if (loading) {
            //控制快速重复点击
            msg("请勿频繁点击");
            return;
        }
        showLoading(); //显示loading浮层
        loading = true;
        var pId = giftEle.attr("data-id");
        currentPrizeId = pId; //保存当前商品ID用于重试
        retryCount = 0; //重置重试计数器
        var startFetchingTime = Date.now();
        $.ajax({
            type: "GET",
            dataType: "json",
            url: base + "/2025red/red25Purchase", //抢 链接///2025red/red25Purchase
            data: {
                prizeId: pId,
                actId: getURLParams("actId"),
            },
            success: function (res) {
                hideLoading();
                var nowTime = Date.now();
                setTimeout(function () {
                loading = false;
                }, 3000 - (nowTime - startFetchingTime));
                showResultHandler(res, false); //标记为非重试模式
                if (["000000", "RY1016", "RY1020", "RY1025"].includes(res.returnCode)) {
                    //某几个返回码，要更新按钮状态
                    updateBtnStatus();
                }
            },
            error: function (e) {
                // 网络错误也进行重试
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(function() {
                        retryGift();
                    }, 500);
                } else {
                    hideLoading();
                    msg("抱歉，请再试一次");
                    loading = false;
                    retryCount = 0;
                    currentPrizeId = null;
                }
            },
        });
    }

    //基于请求结果更新按钮状态
    function updateBtnStatus() {
        $.ajax({
            type: "GET",
            dataType: "json",
            url: base + "/2025red/inventory", ///2025red/inventory
            data: {
                actId: getURLParams("actId"),
                isDirect: "00",
            },
            success: function (res) {
                if (res.returnCode === "000000") {
                    //正确的返回值，对页面按钮状态更新
                    //更新标题
                    var noteMsg = $(".activity-main-container .note-msg");
                    noteMsg.empty();
                    if (res.monthTimes === '0' && res.weekNum === '0') {
                        noteMsg.text('本月直通和抢购合计次数已用完');
                    } else if (res.monthTimes === '0' && res.weekTimes === '0') {
                        noteMsg.text('本周次数已用完，本月直通和抢购合计次数已用完');
                    } else if (res.weekTimes === '0') {
                        noteMsg.append('本周次数已用完，本月直通和抢购合计已享<span class="num">' + res.month + '</span>次');
                    } else {
                        noteMsg.append('本周可享<span class="num">' + res.weekTimes + '</span>次，本月直通和抢购合计已享<span class="num">' + res.month + '</span>次');
                    }
                    noteMsg.append('<div class="note-btn" td-event="2629038006"></div>');
                    noteMsg.show();
                    //更新奖品状态
                    $(".activity-list .li-item")
                        .removeClass("used")
                        .find(".container")
                        .removeClass(
                            "active disabled not-ready received purchased out-of-chance empty to-receive to-buy to-grab not-now to-view"
                        );
                    //更新礼品按钮状态
                    for (var i = 0; i < res.prizeList.length; i++) {
                        var prod = res.prizeList[i];
                        if (prod.prizeSts === "05") {
                            //本月已享
                            $(".activity-list .container[data-id=" + prod.prizeId + "]")
                                .closest(".li-item")
                                .addClass("used");
                        } else {
                            $(
                                ".activity-list .container[data-id=" + prod.prizeId + "]"
                            ).addClass(getBtnStatus(prod));
                        }
                    }
                }
            },
            error: function (e) {
            },
        });
    }

    //根据当前条件获取按钮class name
    function getBtnStatus(prod) {
        var prizeTp = prod.prizeTp;
        var prizeSts = prod.prizeSts;

        if (prizeSts == "00") {
            if (isFriday) {
                if (prizeTp == "02") {
                    //去看看 - 改为立即抢购
                    return ["active", "to-grab"];
                } else {
                    //未开始 - 改为立即领取
                    return ["active", "to-receive"];
                }
            } else {
                //周五开抢 - 改为立即抢购
                return ["active", "to-grab"];
            }
        } else if (prizeSts == "01") {
            if (prizeTp == "02") {

                //立即抢购
                return ["active", "to-grab"];

            } else {
                //立即领取
                return ["active", "to-receive"];
            }
        } else if (prizeSts == "02") {
            if (prizeTp == "02") {
                //已购买
                return ["disabled", "purchased"];
            } else {
                //已领取
                return ["disabled", "received"];
            }
        } else if (prizeSts == "03") {
            //次数已用完
            return ["disabled", "out-of-chance"];
        } else if (prizeSts == "04") {
            //已售罄 - 改为立即抢购
            return ["active", "to-grab"];
        }
    }

    //获取底部导航信息
    function fetchBannerList(cityCode) {
        $.ajax({
            type: "GET",
            dataType: "json",
            url: base + "/2025red/getAvdt", ///2025red/getAvdt
            data: {
                city: cityCode,
            },
            success: function (res) {
                if (res.adtsList && res.adtsList.length > 0) {
                    $(".bottom-links").html(
                        mustache.render($("#banner-tpl").html(), { list: res.adtsList })
                    );
                } else {
                    $(".bottom-links").remove();
                }
            },
            error: function (e) {
                $(".bottom-links").remove();
            },
        });
    }

    //倒计时结束，转换按钮的状态值
    function timeupChangeBtnStatus(turn) {
        var buttons1;
        var buttons2;
        if (turn === "friday") {
            buttons1 = $(".active.to-view");
            buttons2 = $(".not-ready.not-now");
        } else if (turn === "count_down_2") {
            //抢购1轮启动
            var part = $(".activity-list").eq(0);
            buttons1 = part.find(".active.to-view");
            buttons2 = part.find(".not-ready.not-now");
        }
        $(buttons1).each(function (i, item) {
            $(item).removeClass("active to-view");

            //立即抢购
            $(item).addClass("active to-grab");

        });
        $(buttons2).each(function (i, item) {
            $(item).removeClass("not-ready not-now").addClass("active to-receive");
        });
    }

    //头部公告轮播
    function switchText() {
        var messageContainer = document.querySelector(".msg-container");
        if (!messageContainer) {
            return;
        }
        var fontSize = +document.documentElement.style["font-size"].replace(
            "px",
            ""
        );
        var needSwip = messageContainer.scrollWidth > 6.25 * fontSize;
        if (needSwip) {
            var distance = 1.3; //每次移动距离
            var gap = 20; //两轮间距
            $(messageContainer).addClass("swip");
            var node1 = $(messageContainer).find(".inner");
            var node2 = $("<span>" + node1.text() + "</span>");
            var nodeW = node1.width(); //节点宽度值
            var node1Left = 15;
            var node2Left = node1Left + nodeW + gap;
            node2.attr("data-left", "0");
            $(messageContainer).append(node2);
            //无缝切换函数
            (function loop() {
                if (msgremoved) {
                    return;
                }
                node1Left -= distance;
                if (node1Left < -nodeW - gap) {
                    node1Left = nodeW + gap;
                }
                node1.attr("style", "left:" + node1Left + "px");

                node2Left -= distance;
                if (node2Left < -nodeW - gap) {
                    node2Left = nodeW + gap;
                }
                node2.attr("style", "left:" + node2Left + "px");
                setTimeout(loop, 16.6);
            })();
        }
    }

    //check is mdb
    function isMDBApp() {
        var ua = navigator.userAgent.toLowerCase();
        return /com\.bankcomm\.maidanba/i.test(ua);
    }


    //埋点调用
    function SRSOnEvent(eventId, eventLabel, eventParams) {
        if (typeof SRSAPP != "undefined" && SRSAPP.onEvent) {
            if (eventParams) {
                SRSAPP.onEvent(eventId, eventLabel, eventParams);
            } else if (eventLabel) {
                SRSAPP.onEvent(eventId, eventLabel);
            } else {
                SRSAPP.onEvent(eventId);
            }
        } else {
            console.log(eventId, eventLabel, eventParams);
        }
    }
    function TDOnEvent(eventId, eventLabel, eventParams) {
        if (typeof TDAPP != "undefined" && TDAPP.onEvent) {
            if (eventParams) {
                TDAPP.onEvent(eventId, eventLabel, eventParams);
            } else if (eventLabel) {
                TDAPP.onEvent(eventId, eventLabel);
            } else {
                TDAPP.onEvent(eventId);
            }
        } else {
            console.log(eventId, eventLabel, eventParams);
        }
    }
});