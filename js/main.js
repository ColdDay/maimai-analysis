
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
        max: 0
    }
}
initMaiMaiPlugin()
function initMaiMaiPlugin() {
    var html = `
        <span class="ma-switch" onclick="showMaimai()"></span>
    `
    document.body.insertAdjacentHTML('beforeend', html);
}
function showMaimai() {
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
                        <span class="ma-label">ID</span><input type="text" class="ma-input ma-mid" id="ma-mid" placeholder="In4u2Ir]a6AY">
                    </div>
                    <div class="ma-actions">
                        <div class="ma-btn" onclick="queryWord()">搜索</div>
                    </div>
                </div>
                <div class="ma-content">
                    <table class="ma-table" border="1" cellspacing="0">
                        <thead>
                            <tr>
                                <th width="10%">序号</th>
                                <th width="25%">昵称</th>
                                <th width="15%">ID</th>
                                <th>发布职言</th>
                                <th>发布评论数</th>
                            </tr>
                        </thead>
                        <tbody class="ma-tbody">
                            
                        </tbody>
                    </table>
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
function queryWord(word, limit=20) {
    var word = document.querySelector('#ma-keyword').value;
    var mmid = document.querySelector('#ma-mid').value;
    globalData = {
        users: {
        },
        userArr: [],
        progress: {
            ok: 0,
            max: 0
        }
    }
    var queryParams = {
        query: word,
        limit: limit,
        offset: 0,
        searchTokens: "["+word+"]",
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
                globalData.progress.max = gossips.length - 1;
                var auth_info = rep.auth_info;
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
                    getGodMid(encode_id, function(mmid, time) {
                        if (!globalData.users[mmid]) {
                            globalData.users[mmid] = {
                                name: nickName,
                                uid: uid,
                                mmid,
                                comments: [      
                                ],
                                gossips: [
                                    {
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
                                url,
                                text,
                                nickName,
                                crtime,
                                likes,
                                total_cnt
                            })
                        }
                    })
                    getComments(gid, egid, encode_id, auth_info)
                }
                
            } else {
                alert('数据异常')
            }
            
        }
    })
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
            console.log(globalData.progress.ok)
            if (rep.result === 'ok') {
                var comments = rep.comments;
                pushData(comments, encode_id);
            } else {
                alert('数据异常')
            }
            if (globalData.progress.ok == globalData.progress.max) {
                console.log('查询完毕');
                for (let i in globalData.users) {
                    globalData.userArr.push(globalData.users[i]);
                }
                maSort(globalData.userArr, 'gossips', 'down');
                initTable();
            }
            
        }
    })
}
function getGodMid(encode_id, callback) {
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
function pushData(comments, encode_id) {
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



function maSort(arr, filed, type) {
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
function initTable() {
    var tempHtml = `<tbody class="ma-tbody">`;
    for (let index = 0; index < globalData.userArr.length; index++) {
        const user = globalData.userArr[index];
        tempHtml+= `
        <tr id="${user.mmid}">
            <td>${index}</td>
            <td>${user.nickName}</td>
            <td>${user.mmid}</td>
            <td onclick="showDetail('${user.mmid}','gossips')">${user.gossips.length}</td>
            <td onclick="showDetail('${user.mmid}','comments')">${user.comments.length}</td>
        </tr>
        `
        
    }
    tempHtml+="</tbody>";
    var table = document.querySelector('.ma-table');
    var tbody = document.querySelector('.ma-tbody');
    tbody.remove();
    table.innerHTML += tempHtml
}
function showDetail(mmid, type) {
    var tempHtml = `<td colspan="5" class="ma-table-detail">`;
    var user = globalData.users[mmid];
    for (let index = 0; index < user.gossips.length; index++) {
        const god = user.gossips[index];
        if (type == 'gossips') {
            tempHtml+= `
                <div class="ma-detail-row">
                    <p class="ma-detail-p">
                        <span>${god.nickName}</span>
                        <span>发布时间：${god.crtime}</span>
                        <span>评论：${god.total_cnt}</span>
                        <span>点赞：${god.likes}</span>
                    </p>
                    <p><a href="${god.url}">${god.text}</a></p>
                </div>
            `
        } else {
            tempHtml+= `
                <div class="ma-detail-row">
                    <p class="ma-detail-p">
                        <span>${god.nickName}</span>
                        <span>点赞：${god.likes}</span>
                    </p>
                    <p><a href="${god.url}">${god.text}</a></p>
                </div>
            `
        }   
    }
    tempHtml+="</td>";
    var row = document.querySelector('#' + mmid);
    if (!row.nextElementSibling.id) {
        // 若存在详情，先清空
        row.nextElementSibling.remove()
    }
    row.insertAdjacentHTML('afterend', tempHtml);
}
