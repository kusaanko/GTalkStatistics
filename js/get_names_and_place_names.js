importScripts('kuromoji.js/kuromoji.js');

self.addEventListener('message', (msg) => {
    var messages = msg.data.messages;
    var check = msg.data.check;
    self.postMessage('status 初期化中');
    // kuromoji.jsの初期化
    self.postMessage('status 除外する単語を全メッセージから検索中');
    kuromoji.builder({ dicPath: "kuromoji.js/dict" }).build(function (err, tokenizer) {
        var filter = [];
        for(let message of messages) {
            var path = tokenizer.tokenize(message.text);
            for(var word of path) {
                if(check.includes(word.pos_detail_2)) {
                    if(!filter.includes(word.surface_form)) {
                        filter.push(word.surface_form);
                    }
                }
            }
        }
        self.postMessage(filter);
    });
});