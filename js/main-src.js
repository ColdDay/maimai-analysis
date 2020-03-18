
(function() {
    var globalData = {
        gossips: [],
        users: {
        },
        userArr: [],
        progress: {
            ok: 0,
            max: 0,
            midOk: 0
        },
        isLoading: false
    }
    initMaiMaiPlugin()
    function initMaiMaiPlugin() {
        var html = `
            <span class="ma-switch"></span>
        `
        document.body.insertAdjacentHTML('beforeend', html);
        $('body').on('click', '.ma-switch', function() {
            ma_showMaimai()
        })
        $('body').on('click', '.ma-close', function() {
            closeMaimai()
        })
        $('body').on('click', '.ma-query-btn', function() {
            ma_queryWord()
        })
        $('body').on('click', '.ma-sort-radio', function() {
            ma_changeSort()
        })
        $('body').on('click', '.zip-detail', function() {
            var mmid = $(this).data('mmid');
            ma_zipDetail(mmid)
        })
        $('body').on('click', '.ma-num', function() {
            var mmid = $(this).data('mmid');
            var type = $(this).data('type');
            ma_showDetail(mmid, type)
        })
        $('body').on('click', '.lookComment', function() {
            var $commentDetailBox = $(this).next('.commentDetailBox')
            if ($(this).hasClass('active')) {
                $(this).removeClass('active').text('查看评论>>');
                $commentDetailBox.empty()
            } else {
                $(this).addClass('active').text('收起评论');
                var encode_id = $(this).data('encode_id');
                var mmid = $(this).data('mid');
                ma_showGidDetail(mmid, encode_id, $commentDetailBox);
            }
            
        })
        
    }
    function ma_showMaimai() {
        var maimaiBox = document.querySelector('.maimai-analysis');
        if (maimaiBox) {
            maimaiBox.style.display = 'block';
            return;
        }
        var html = `
            <div class="maimai-analysis">
                <div class="ma-flex-box">
                    <div class="ma-header">
                        <h2 class="ma-title">脉脉职言快速查找</h2>
                    </div>
                    <div class="ma-form">
                        <div class="ma-actions">
                            <span class="ma-label">关键词</span><input type="text" class="ma-input ma-keyword" id="ma-keyword" placeholder="阿里/腾讯/百度/头条">
                        </div>
                        <div class="ma-actions" title="搜索范围变大，内容变多，搜索速度会慢一些，频繁查询可能被限制，短时间内无法正常使用">
                            <label><span class="ma-label">海量<i class="ma-help">?</i> </span><input type="checkbox" id="masterQuery"/></label>
                        </div>
                        <div class="ma-actions" title="优先查找热门的职言">
                            <label><span class="ma-label">热门<i class="ma-help">?</i> </span><input type="checkbox" id="hotQuery"/></label>
                        </div>
                        <div class="ma-actions">
                            <div class="ma-btn ma-query-btn">搜索</div>
                        </div>
                        <div class="ma-actions ma-sort">
                            <span class="ma-label">排序：</span>
                            <label>发布职言数 <input name="masort" type="radio" value="1" checked="checked" class="ma-sort-radio"></label>
                            <label>发布评论数 <input name="masort" type="radio" value="2"  class="ma-sort-radio"></label>
                            <label>参与职言数 <input name="masort" type="radio" value="3" class="ma-sort-radio"></label>
                        </div>
                    </div>
                    <div class="ma-content">
                        <table class="ma-table" border="1" cellspacing="0">
                            <thead>
                                <tr>
                                    <th width="10%">序号</th>
                                    <th width="25%">昵称</th>
                                    <th width="30%">ID</th>
                                    <th>发布职言</th>
                                    <th>参与职言</th>
                                    <th>发布评论</th>
                                </tr>
                            </thead>
                            <tbody class="ma-tbody">
                                
                            </tbody>
                        </table>
                        <span class="ma-loading">查询中</span>
                    </div>
                    <span class="ma-close"></span>
                </div>
            </div>
        `
        document.body.insertAdjacentHTML('beforeend', html);
    }
    function closeMaimai(){
        var maimai = document.querySelector('.maimai-analysis');
        maimai.style.display = 'none';
    }
    function ma_queryWord() {
        var limit = 100;
        var sortType = 'time';
        var word = document.querySelector('#ma-keyword').value;
        if (!word) {
            alert('输入关键字才可以精确查找！');
            return;
        }
        var isMaster = document.getElementById('masterQuery').checked;
        if (isMaster) {
            // 深度搜索
            limit = 500
        }
        var isHot = document.getElementById('hotQuery').checked;
        if (isHot) {
            // 热度搜索
            sortType = 'heat';
        }
        globalData.isLoading = true;
        var tbody = document.querySelector('.ma-tbody');
        tbody && tbody.remove();
        var loadingEle = document.querySelector('.ma-loading');
        loadingEle.innerText = '查询中';
        loadingEle.style.display = 'block';
        
        globalData = {
            gossips: [],
            users: {
            },
            userArr: [],
            progress: {
                ok: 0,
                max: 0,
                midOk: 0
            }
        }
        var queryParams = {
            query: word,
            limit: limit,
            offset: 0,
            sortby: sortType,
            highlight: false,
            jsononly: 1
        }
        
        $.ajax({
            url: 'https://maimai.cn/search/gossips',
            method: 'GET',
            data: queryParams,
            success: function(rep) {
                if (rep.result === 'ok') {
                    var gossips = rep.data.gossips;
                    globalData.gossips = [];
                    globalData.progress.max = gossips.length;
                    var auth_info = rep.auth_info;
                    if (!gossips.length) {
                        document.querySelector('.ma-loading').innerText = '暂无数据，换个关键词搜索吧～';
                        return
                    }
                    for (let index = 0; index < gossips.length; index++) {
                        const item = gossips[index];
                        const gid = item.gid;
                        const egid = item.gossip.egid;
                        const encode_id = item.gossip.encode_id;
                        const likes = item.gossip.likes;
                        const url = 'https://maimai.cn/web/gossip_detail?encode_id=' + encode_id;
                        const text = item.gossip.text;
                        const nickName = item.gossip.username;
                        const uid = item.gossip.id;
                        const crtime = item.gossip.crtime;  // 创建时间
                        const total_cnt = item.gossip.total_cnt;
                        ma_getGodMid(encode_id, function(mmid, time) {
                            globalData.progress.midOk+=1;
                            if (!mmid) mmid=new Date().getTime();
                            item.gossip.mmid = mmid;
                            item.gossip.gid = gid;
                            globalData.gossips.push(item.gossip)
                            if (!globalData.users[mmid]) {
                                globalData.users[mmid] = {
                                    name: nickName,
                                    uid: uid,
                                    mmid: mmid,
                                    auth_info: auth_info,
                                    comments: [      
                                    ],
                                    gossips: [
                                        {
                                            gid: gid,
                                            egid: egid,
                                            encode_id: encode_id,
                                            url: url,
                                            text: text,
                                            nickName: nickName,
                                            crtime: crtime,
                                            likes: likes,
                                            total_cnt: total_cnt
                                        } 
                                    ],
                                    joinGos: []
                                }
                                globalData.users[mmid].joinGos.push(gid)
                            } else {
                                globalData.users[mmid].gossips.push({
                                    gid: gid,
                                    egid: egid,
                                    encode_id: encode_id,
                                    url: url,
                                    text: text,
                                    nickName: nickName,
                                    crtime: crtime,
                                    likes: likes,
                                    total_cnt: total_cnt
                                })
                                if (globalData.users[mmid].joinGos.indexOf(gid) == -1) {
                                    globalData.users[mmid].joinGos.push(gid) 
                                }
                            }
                            if (globalData.progress.midOk == gossips.length) {
                                // mid查询结束，开始查询评论
                                forQueryComment()
                            }
                        })
                        
                        
                    }
                    
                } else {
                    alert('数据异常')
                }
                
            }
        })
    }
    function forQueryComment() {
        for (const key in globalData.users) {
            if (globalData.users.hasOwnProperty(key)) {
                const user = globalData.users[key];
                for (let index = 0; index < user.gossips.length; index++) {
                    const gossip = user.gossips[index];
                    getComments(gossip.gid, gossip.egid, gossip.encode_id, user.auth_info)
                }
                
            }
        }
    }
    function getComments(gid, egid, encode_id, auth_info) {
        var queryParams = {
            gid: gid,
            egid: egid,
            page: 0,
            count: 1000,
            hotcmts_limit_count: 1
        }
        const params = Object.assign(queryParams, auth_info)
    
        $.ajax({
            url: 'https://maimai.cn/sdk/web/gossip/getcmts',
            method: 'GET',
            data: params,
            success: function(rep) {
                globalData.progress.ok++;
                var loadingEle = document.querySelector('.ma-loading');
                loadingEle && (loadingEle.innerText = parseInt(globalData.progress.ok/globalData.progress.max * 100) + ' %');
                if (rep.result === 'ok') {
                    var comments = rep.comments;
                    ma_pushData(comments, encode_id, gid);
                } else {
                    console.error('数据异常')
                }
                if (globalData.progress.ok == globalData.progress.max - 1) {
                    loadingEle.style.display = 'none';
                    loadingEle.innerText = '查询中';
                    for (let i in globalData.users) {
                        globalData.userArr.push(globalData.users[i]);
                    }
                    var sort = $("[name='masort']").filter(":checked").val();
                    ma_sort(globalData.userArr, sort == '1' ? 'gossips' : 'comments', 'down');
                    ma_initTable();
                }
                
            }
        })
    }
    function ma_getGodMid(encode_id, callback) {
        var url = 'https://maimai.cn/web/gossip_detail?encode_id=' + encode_id;
        $.ajax({
            url: url,
            method: 'GET',
            success: function(rep) {
    
                var jsonStr = JSON.parse(rep.split('JSON.parse(')[1].split(');</script>')[0]);
                const jsonData = JSON.parse(jsonStr);
                const mmid = jsonData.data.gossip.mmid;
                const time = jsonData.data.gossip.time;
                callback(mmid, time)
                
            }
        })
    }
    function ma_pushData(comments, encode_id, gid) {
        for (let index = 0; index < comments.length; index++) {
            const com = comments[index];
            const mmid = com.mmid;
            const text = com.text;
            const uid = com.id;
            const nickName = com.name;
            const likes = com.likes
            const url = 'https://maimai.cn/web/gossip_detail?encode_id=' + encode_id;
            if (!globalData.users[mmid]) {
                globalData.users[mmid] = {
                    name: nickName,
                    uid: uid,
                    mmid: mmid,
                    comments: [
                        {
                            url: url,
                            text: text,
                            nickName: nickName,
                            likes: likes,
                            gid: gid,
                            mmid: mmid,
                            encode_id: encode_id
                        }        
                    ],
                    gossips: [
        
                    ],
                    joinGos: []
                }
                globalData.users[mmid].joinGos.push(gid)
            } else {
                globalData.users[mmid].comments.push({
                    url: url,
                    text: text,
                    nickName: nickName,
                    likes: likes,
                    gid: gid,
                    mmid: mmid,
                    encode_id: encode_id
                })
                if (globalData.users[mmid].joinGos.indexOf(gid) == -1) {
                    globalData.users[mmid].joinGos.push(gid) 
                }
            }
        }
        
    }
    function getCommentByEncodeId(comments, encode_id) {
        var result = [];
        for (let index = 0; index < comments.length; index++) {
            const element = comments[index];
            if (element.encode_id == encode_id) {
                result.push(element)
            }
        }
        return result;
    }
    function getGidByGids(Gids) {
        var goss = [];
        for (let index = 0; index < globalData.gossips.length; index++) {
            const element = globalData.gossips[index];
            if (Gids.indexOf(element.gid) != -1) {
                goss.push(element)
            }
        }
        return goss;
    }
    function ma_sort(arr, filed, type) {
        var len = arr.length;
        for (var i = 0; i < len-1; i++) {
          for (var j = 0; j < len - 1 - i; j++) {
               // 相邻元素两两对比，元素交换，大的元素交换到后面
               if (type == 'up') {
                if (arr[j][filed].length > arr[j + 1][filed].length) {
                    var temp = arr[j];
                    arr[j] = arr[j+1];
                    arr[j+1] = temp;
                }
               } else {
                if (arr[j][filed].length < arr[j + 1][filed].length) {
                    var temp = arr[j];
                    arr[j] = arr[j+1];
                    arr[j+1] = temp;
                }
               }
          }
        }
        return arr;
    }
    function ma_initTable() {
        var tempHtml = `<tbody class="ma-tbody">`;
        for (let index = 0; index < globalData.userArr.length; index++) {
            const user = globalData.userArr[index];
            tempHtml+= `
            <tr id="${user.mmid}">
                <td>${index}</td>
                <td>${user.name}</td>
                <td>${user.mmid}</td>
                <td><span class="ma-num" data-mmid="${user.mmid}" data-type="gossips">${user.gossips.length}</span></td>
                <td><span class="ma-num" data-mmid="${user.mmid}" data-type="join-gossips">${user.joinGos.length}</span></td>
                <td><span class="ma-num" data-mmid="${user.mmid}" data-type="comments">${user.comments.length}</span></td>
            </tr>
            `
        }
        tempHtml+="</tbody>";
        var table = document.querySelector('.ma-table');
        var tbody = document.querySelector('.ma-tbody');
        tbody && tbody.remove();
        table.innerHTML += tempHtml
    }
    function ma_showDetail(mmid, type) {
        var tempHtml = `<td colspan="6" class="ma-table-detail"><span class="zip-detail" data-mmid="${mmid}">收起</span>`;
        var user = globalData.users[mmid];
        var dataKey =  'gossips';
        if (type === 'gossips') {
            tempHtml+='<h5>发布职言统计</h5>';
        }
        if (type === 'comments') {
            dataKey = 'comments';
            tempHtml+='<h5>全部评论统计</h5>';
        }
        if (type === 'join-gossips') {
            dataKey = 'joinGos';
            tempHtml+='<h5>参与职言统计</h5>';
            if (!user.haveTransfor) {
                user.joinGos = getGidByGids(user.joinGos);
                user.haveTransfor = true
            }
        }
        
        for (let index = 0; index < user[dataKey].length; index++) {
            const item = user[dataKey][index];
            if (type == 'gossips') {
                tempHtml+= `
                    <div class="ma-detail-row">
                        <p class="ma-detail-p">
                            <span>${index}. <b>发布者：</b>${item.nickName}</span> | 
                            <span><b>发布时间：</b>${item.crtime}</span> | 
                            <span><b>评论：</b>${item.total_cnt}</span> | 
                            <span><b>点赞：</b>${item.likes}</span>
                        </p>
                        <p class="ma-detail-text"><a href="${item.url}" target="_blank">${item.text}</a></p>
                    </div>
                `
            } else if (type == 'comments') {
                tempHtml+= `
                    <div class="ma-detail-row">
                        <p class="ma-detail-p">
                            <span>${index}. <b>发布者：${item.nickName}</b></span> | 
                            <span><b>点赞：${item.likes}</b></span>
                        </p>
                        <p class="ma-detail-text"><a href="${item.url}" target="_blank">${item.text}</a></p>
                    </div>
                `
            } else {
                tempHtml+= `
                    <div class="ma-detail-row">
                        <p class="ma-detail-p">
                        <span>${index}. <b>发布者：</b>${item.username}（${item.mmid}）</span> | 
                        <span><b>发布时间：</b>${item.crtime}</span> | 
                        <span><b>评论：</b>${item.total_cnt}</span> | 
                        <span><b>点赞：</b>${item.likes}</span>
                        </p>
                        <p class="ma-detail-text"><a href="${'https://maimai.cn/web/gossip_detail?encode_id=' + item.encode_id}" target="_blank">${item.text}</a></p>
                        <div>
                            <span class="lookComment" data-encode_id="${item.encode_id}" data-mid="${mmid}">查看他的评论>></span>
                            <div class="commentDetailBox"></div>
                        </div>
                    </div>
                `
            }
        }
        tempHtml+="</td>";
        var row = document.getElementById( mmid);
        if (row && !row.nextElementSibling.id) {
            // 若存在详情，先清空
            row.nextElementSibling.remove()
        }
        row.insertAdjacentHTML('afterend', tempHtml);
    }
    function ma_showGidDetail(mmid, encode_id, $box) {
        var allComments = globalData.users[mmid].comments;
        var comments = getCommentByEncodeId(allComments, encode_id);
        var tempHtml = '';
        for (let index = 0; index < comments.length; index++) {
            const item = comments[index];
            tempHtml+= `
                <div class="ma-detail-row">
                    <p class="ma-gid-detail-p">
                        ${item.nickName}（${item.mmid}）回复： <span class="ma-detail-text">${item.text}</span>
                    </p>
                </div>
            `
        }
        $box.empty().append(tempHtml)
    }
    function ma_zipDetail(mmid) {
        var row = document.getElementById(mmid);
        row && row.nextElementSibling.remove()
    }
    function ma_changeSort() {
        if (globalData.isLoading) {
            return;
        }
        var sort = $("[name='masort']").filter(":checked").val();
        if (sort == 1) {
            ma_sort(globalData.userArr, 'gossips', 'down');
        } else if (sort == 2) {
            ma_sort(globalData.userArr, 'comments', 'down');
        } else {
            ma_sort(globalData.userArr, 'joinGos', 'down');
        }
        ma_initTable(); 
    }
})()
