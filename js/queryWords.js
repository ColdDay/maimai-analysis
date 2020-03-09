

var globalData = {
    users: {
        'demo' :{
            name: '张三',
            uid: '',
            comments: [             // 评论了多少次
                // {
                //     url: '',        // 言论地址
                //     text: '',     //言论内容
                //     nickName: '',   //评论时的昵称
                // }        
            ],
            gossips: [

            ],    //发布了多少言论
            likes: 0,       // 被点赞了多少次
        },
    }
}

function queryWord(word, limit=20) {
    var queryParams = {
        query: word,
        limit: limit,
        offset: 0,
        searchTokens: [word],
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
                var auth_info = rep.auth_info;
                console.log(rep)

                for (let index = 0; index < gossips.length; index++) {
                    const item = gossips[index];
                    const gid = item.gid;
                    const egid = item.gossip.egid;
                    const encode_id = item.gossip.encode_id;
                    const likes = item.gossip.likes;
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
    console.log(params);
    $.ajax({
        url: 'https://maimai.cn/sdk/web/gossip/getcmts',
        method: 'GET',
        data: params,
        success: function(rep) {
            if (rep.result === 'ok') {
                var comments = rep.comments;
                pushData(comments, encode_id);
                console.log(rep)
            } else {
                alert('数据异常')
            }
            
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
        const url = 'https://maimai.cn/web/gossip_detail?encode_id=' + encode_id;
        const lz = com.lz; // 1楼主
        if (!globalData.users[mmid]) {
            globalData.users[mmid] = {
                name: nickName,
                uid: uid,
                comments: [
                    {
                        url,
                        text,
                        nickName
                    }        
                ],
                gossips: [
    
                ],
                likes: 0
            }
        } else {
            globalData.users[mmid].comments.push({
                url,
                text,
                nickName
            })
        }
    }
    
}