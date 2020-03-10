

var globalData = {
    users: {
        'demo' :{
            name: '张三',
            uid: '',
            comments: [             // 评论了多少次
                
            ],
            gossips: [

            ],    //发布了多少言论
            likes: 0,       // 被点赞了多少次
        },
    },
    progress: {
        ok: 0,
        max: 0
    }
}

function queryWord(word, limit=20) {
    var queryParams = {
        query: word,
        limit: limit,
        offset: 0,
        searchTokens: "["+word+"]",
        highlight: false,
        jsononly: 1

    }
    globalData.progress.max = limit;
    $.ajax({
        url: 'https://maimai.cn/search/gossips',
        method: 'GET',
        data: queryParams,
        success: function(rep) {
            if (rep.result === 'ok') {
                var gossips = rep.data.gossips;
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
                    getGodMid(encode_id, function(mmid, time) {
                        if (!globalData.users[mmid]) {
                            globalData.users[mmid] = {
                                name: nickName,
                                uid: uid,
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
                                ],
                                likes: 0
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
queryWord('马蜂窝', 20)