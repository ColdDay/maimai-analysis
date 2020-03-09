

var globalData = {
    users: {
        '0a4AHr79Awk' :{
            name: '张三',
            id: '',
            comments: [             // 评论了多少次
                {
                    url: '',        // 言论地址
                    text: '',     //言论内容
                    nickName: '',   //评论时的昵称
                }        
            ],
            gossips: [],    //发布了多少言论
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
                    const gosip = gossips[index];
                    const gid = gosip.gid;
                    const egid = gosip.egid;
                    const encode_id = gosip.encode_id;
                    const likes = gosip.likes;
                    getComments(gid, egid, auth_info)
                }
                
            } else {
                alert('数据异常')
            }
            
        }
    })
}

function getComments(gid, egid, auth_info) {
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
                pushData(comments);
                console.log(rep)
            } else {
                alert('数据异常')
            }
            
        }
    })
}

function pushData(comments) {
    for (let index = 0; index < comments.length; index++) {
        const com = comments[index];
        const mmid = com.mmid;
        const text = com.text;
        
    }
    var comments = {
        real: 0
        major: 255
        likes: 0
        mmid: "S4+ttN+KgHU"
        career: ""
        text: "什么岗"
        reply_text: ""
        profession: 255
        is_top: 0
        mylike: 0
        rich_text: "<dref t=-1 f=13.5 cs=#191919>什么岗</dref>"
        prefix: ""
        name_color: "#ffefa932"
        avatar: "https://i9.taou.com/maimai/c/offlogo/81983fd1d9d64ebebd8989e758a8906c.png"
        judge: 1
        lz: 0
        id: 42144564
        gossip_uid: "S4+ttN+KgHU"
        name: "滴滴出行员工"
    }
}