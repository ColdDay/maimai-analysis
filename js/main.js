
var globalData = {
    users: {
        // 'demo' :{
        //     name: '张三',
        //     uid: '',
        //     mmid: '',
        //     comments: [
                
        //     ],
        //     gossips: [

        //     ],
        //     likes: 0,       // 被点赞了多少次
        // },
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
        <span class="ma-switch" onclick="ma_showMaimai()"></span>
    `
    document.body.insertAdjacentHTML('beforeend', html);
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
                    <div class="ma-actions">
                        <div class="ma-btn" onclick="ma_queryWord()">搜索</div>
                    </div>
                    <div class="ma-actions ma-sort">
                        <label>按职言排序 <input name="masort" type="radio" value="1" checked="checked" onclick="ma_changeSort()"></label>
                        <label>按评论排序 <input name="masort" type="radio" value="2" onclick="ma_changeSort()"></label>
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
                                <th>发布评论</th>
                            </tr>
                        </thead>
                        <tbody class="ma-tbody">
                            
                        </tbody>
                    </table>
                    <span class="ma-loading">查询中</span>
                </div>
                <span class="ma-close" onclick="closeMaimai()"></span>
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
    var word = document.querySelector('#ma-keyword').value;
    if (!word) {
        alert('输入关键字才可以精确查找！');
        return;
    }
    var sort = $("[name='masort']").filter(":checked").val(); 
    globalData.isLoading = true;
    var tbody = document.querySelector('.ma-tbody');
    tbody && tbody.remove();
    document.querySelector('.ma-loading').style.display = 'block';
    var limit = 200;
    globalData = {
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
        // searchTokens: "["+word+"]",
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
                        console.log(globalData.progress.midOk)
                        globalData.progress.midOk+=1;
                        if (!mmid) mmid=new Date().getTime();
                        
                        if (!globalData.users[mmid]) {
                            globalData.users[mmid] = {
                                name: nickName,
                                uid: uid,
                                mmid,
                                auth_info,
                                comments: [      
                                ],
                                gossips: [
                                    {
                                        gid,
                                        egid,
                                        encode_id,
                                        url,
                                        text,
                                        nickName,
                                        crtime,
                                        likes,
                                        total_cnt
                                    } 
                                ]
                            }
                        } else {
                            globalData.users[mmid].gossips.push({
                                gid,
                                egid,
                                encode_id,
                                url,
                                text,
                                nickName,
                                crtime,
                                likes,
                                total_cnt
                            })
                        }
                        console.log(globalData.progress.midOk, gossips.length)
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
                ma_pushData(comments, encode_id);
            } else {
                console.error('数据异常')
            }
            if (globalData.progress.ok == globalData.progress.max - 1) {
                console.log('查询完毕');
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
        url,
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
function ma_pushData(comments, encode_id) {
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
                mmid,
                comments: [
                    {
                        url,
                        text,
                        nickName,
                        likes
                    }        
                ],
                gossips: [
    
                ]
            }
        } else {
            globalData.users[mmid].comments.push({
                url,
                text,
                nickName,
                likes
            })
        }
    }
    
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
            <td onclick="ma_showDetail('${user.mmid}','gossips')"><span class="ma-num">${user.gossips.length}</span></td>
            <td onclick="ma_showDetail('${user.mmid}','comments')"><span class="ma-num">${user.comments.length}</span></td>
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
    var tempHtml = `<td colspan="5" class="ma-table-detail"><span class="zip-detail" onclick="ma_zipDetail('${mmid}')">收起</span>`;
    var user = globalData.users[mmid];
    var dataKey =  'gossips';
    if (type === 'comments') {
        dataKey = 'comments'
    }
    for (let index = 0; index < user[dataKey].length; index++) {
        const item = user[dataKey][index];
        if (type == 'gossips') {
            tempHtml+= `
                <div class="ma-detail-row">
                    <p class="ma-detail-p">
                        <span><b>昵称：</b>${item.nickName}</span> | 
                        <span><b>发布时间：</b>${item.crtime}</span> | 
                        <span><b>评论：</b>${item.total_cnt}</span> | 
                        <span><b>点赞：</b>${item.likes}</span>
                    </p>
                    <p><a href="${item.url}" target="_blank">${item.text}</a></p>
                </div>
            `
        } else {
            tempHtml+= `
                <div class="ma-detail-row">
                    <p class="ma-detail-p">
                        <span><b>昵称：${item.nickName}</b></span> | 
                        <span><b>点赞：${item.likes}</b></span>
                    </p>
                    <p><a href="${item.url}" target="_blank">${item.text}</a></p>
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
function ma_zipDetail(mmid) {
    var row = document.getElementById(mmid);
    row && row.nextElementSibling.remove()
}
function ma_changeSort() {
    if (globalData.isLoading) {
        return;
    }
    var sort = $("[name='masort']").filter(":checked").val();
    ma_sort(globalData.userArr, sort == '1' ? 'gossips' : 'comments', 'down');
    ma_initTable(); 
}