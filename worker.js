importScripts('js/kuromoji.js/kuromoji.js');
var user_replace = {};
var do_user_replace_message = false;

self.addEventListener('message', (msg) => {
    var data = msg.data;
    if(data.message == 'user_replace') {
    }
    if(data.message == 'parse') {
        user_replace = data.user_replace;
        do_user_replace_message = data.do_user_replace_message;
        data = data.data;
        var i;
        var pos = 0;
        // 最初の2行を削除
        for (i = 0; i < 2; i++) {
            pos = data.indexOf('\n');
            data = data.substr(pos + 1);
        }
        // テキストのパース
        var stock = '';
        var line = '';
        var date = 0;
        var time = 0;
        var mode = 0;
        var user = '';
        var text = '';
        var messages = [];
        var senders = [];
        var original_senders = [];
        self.postMessage('status トーク履歴を分解中');
        for (i = 0; i < data.length; i++) {
            var char = data.charAt(i);
            if (char == '\r') continue;
            if (char == '\n') {
                // 日付の行
                if (line.length == 13 && getIndexOfs(line, '/').length == 2 && !isNaN(parseInt(line.substr(0, 4))) && !isNaN(parseInt(line.substr(5, 2))) && !isNaN(parseInt(line.substr(8, 2)))) {
                    date = Date.UTC(parseInt(line.substr(0, 4)), parseInt(line.substr(5, 2)) - 1, parseInt(line.substr(8, 2)));
                    mode = 0;
                    stock = '';
                } else {
                    // 新しいメッセージでない
                    if (line.length > 6 && getIndexOfs(line, '\t').length == 1 && !isNaN(parseInt(line.substr(0, 2))) && line.indexOf(':') == 2) {
                        if (stock.indexOf('\n')) {
                            stock = stock.substring(0, stock.lastIndexOf('\n') + 1);
                        } else {
                            stock = '';
                        }
                        line = '';
                        continue;
                    }
                    if (stock.indexOf('\n') != -1) {
                        // メッセージを分割
                        if (line.length > 6 && getIndexOfs(line, '\t').length >= 2 && !isNaN(parseInt(line.substr(0, 2))) && line.indexOf(':') == 2) {
                            var now = stock.substr(0, stock.lastIndexOf('\n'));
                            var tabPositions = getIndexOfs(now, '\t');
                            time = parseInt(now.substr(0, 2)) * 60 + parseInt(now.substr(3, 2));
                            user = now.substring(tabPositions[0] + 1, tabPositions[1]);
                            text = now.substring(tabPositions[1] + 1);
                            if (text.indexOf('\'') == 0 && text.lastIndexOf('\'') == text.length - 1) {
                                text = text.substring(1, text.length - 1);
                            }
                            if (!original_senders.includes(user)) {
                                original_senders.push(user);
                            }
                            if(user_replace[user] != undefined && user_replace[user] != '') {
                                user = user_replace[user];
                            }
                            if (!senders.includes(user)) {
                                senders.push(user);
                            }
                            if(do_user_replace_message) {
                                // メッセージ内のユーザーの置換
                                for(let user of Object.keys(user_replace)) {
                                    text = text.replace(new RegExp(user, 'g'), user_replace[user]);
                                }
                            }else {
                                // @の置換
                                if(text.indexOf('@') != -1) {
                                    for(let user of Object.keys(user_replace)) {
                                        text = text.replace(new RegExp(user, 'g'), user_replace[user]);
                                    }
                                }
                            }
                            messages.push(new Message(date, time, user, text));
                            stock = stock.substr(stock.lastIndexOf('\n') + 1);
                        }
                    }
                    stock += '\n';
                }
                line = '';
            } else {
                stock += char;
                line += char;
            }
        }

        self.postMessage('status 初期化中');
        var filter = [];
        var personal_data = ['人名', '地名'];
        // kuromoji.jsの初期化
        kuromoji.builder({ dicPath: "js/kuromoji.js/dict" }).build(function (err, tokenizer) {
            var statistics = {
                all: newStatistics()
            };
            var all_messages = {};
            for (let sender of senders) {
                statistics[sender] = newStatistics();
                all_messages[sender] = [];
            }
            var preYear = 0;
            var preMonth = 0;
            self.postMessage('status 全てのメッセージを分類中');
            messages.forEach(message => {
                var date = new Date(message.date);
                var date_str = date.getFullYear() + '-' + (date.getMonth() + 1);
                var year = date.getFullYear();
                var month = date.getMonth() + 1;
                var day = date.getDate();
                var time = Math.floor(message.time / 60);
                all_messages[message.sender].push(message);
                if (preYear == 0) preYear = year;
                if (preMonth == 0) preMonth = month;
                while ((year * 12 + month) - (preYear * 12 + preMonth) > 1) {
                    preMonth++;
                    if (preMonth == 13) {
                        preYear++;
                        preMonth = 1;
                    }
                    for (let key in statistics) {
                        if (statistics[key].year_month[preYear + '-' + preMonth] == undefined) {
                            statistics[key].year_month[preYear + '-' + preMonth] = 0;
                        }
                    }
                }
                preYear = year;
                preMonth = month;
                increment(statistics, message.sender, 'time', time, 1);
                increment(statistics, message.sender, 'year_month', date_str, 1);
                increment(statistics, message.sender, 'year', year, 1);
                increment(statistics, message.sender, 'month', month, 1);
                increment(statistics, message.sender, 'day', day, 1);
                var skipWordSegment = false;
                if (message.text == '[スタンプ]') {
                    incrementValue(statistics, message.sender, 'stamp_count', 1);
                    skipWordSegment = true;
                } else if (message.text == '[写真]') {
                    incrementValue(statistics, message.sender, 'image_count', 1);
                    skipWordSegment = true;
                } else if (message.text == '[動画]') {
                    incrementValue(statistics, message.sender, 'video_count', 1);
                    skipWordSegment = true;
                } else if (message.text == '[ボイスメッセージ]') {
                    incrementValue(statistics, message.sender, 'voice_message_count', 1);
                    skipWordSegment = true;
                }
                if (!skipWordSegment) {
                    function incrementWord(sender, word) {
                        if (statistics[sender].words[word] == undefined) {
                            statistics[sender].words[word] = 0;
                        }
                        statistics[sender].words[word]++;
                        if (statistics.all.words[word] == undefined) {
                            statistics.all.words[word] = 0;
                        }
                        statistics.all.words[word]++;
                    }
                    var path = tokenizer.tokenize(message.text);
                    var w = '';
                    for (let word of path) {
                        if(personal_data.includes(word.pos_detail_2)) {
                            if(!filter.includes(word.surface_form)) {
                                filter.push(word.surface_form);
                            }
                        }
                        // 代名詞は無視
                        if (word.pos_detail_1 == '代名詞') {
                            continue;
                        }
                        var surface = word.surface_form;
                        surface = surface.replace(/\n/g, '');
                        // 記号のみは無視
                        if (surface.match(/^[0-9()-+^~|=!"#$%&@.\\/ ?　,:<>`']{1,}$/) != null) {
                            continue;
                        }
                        // 助動詞があれば動詞につなげる
                        if (word.pos == '動詞') {
                            w += surface;
                        }
                        if (word.pos == '助動詞' && w.length > 0) {
                            w += surface;
                        }
                        if (w.length > 0 && word.pos != '動詞' && word.pos != '助動詞') {
                            incrementWord(message.sender, w);
                            w = '';
                        }
                        if (surface.length <= 1) continue;
                        if (word.pos == '名詞' || word.pos == '形容詞' || word.pos == '形容動詞') {
                            incrementWord(message.sender, surface);
                        }
                    }
                    if (w.length > 0) {
                        incrementWord(message.sender, w);
                        w = '';
                    }
                }
                if (statistics[message.sender].longest_message.text.length < message.text.length) {
                    statistics[message.sender].longest_message = message;
                }
                if (statistics.all.longest_message.text.length < message.text.length) {
                    statistics.all.longest_message = message;
                }
            });
            self.postMessage('status 出現した単語を整理中');
            // 単語の出現回数が1回以下は捨てる
            for (let key in statistics) {
                for (let word in statistics[key].words) {
                    if (statistics[key].words[word] <= 1) {
                        delete statistics[key].words[word];
                    }
                }
            }
            var response = {
                messages: Object.assign({ all: messages }, all_messages),
                senders: senders,
                original_senders: original_senders,
                statistics: statistics,
                filter: filter
            };
            self.postMessage(response);
        });
    }
});

function newStatistics() {
    var times = {};
    var months = {};
    var days = {};
    for (i = 0; i < 24; i++) {
        if (times[i] == undefined) {
            times[i] = 0;
        }
    }
    for (i = 1; i <= 12; i++) {
        if (months[i] == undefined) {
            months[i] = 0;
        }
    }
    for (i = 1; i <= 31; i++) {
        if (days[i] == undefined) {
            days[i] = 0;
        }
    }
    return {
        words: {},
        time: times,
        year_month: {},
        year: {},
        month: months,
        day: days,
        longest_message: new Message(0, 0, '', ''),
        stamp_count: 0,
        image_count: 0,
        video_count: 0,
        voice_message_count: 0
    };
}

function increment(statistics, sender, map, key, value) {
    if (statistics.all[map][key] == undefined) {
        statistics.all[map][key] = 0;
    }
    statistics.all[map][key] += value;
    if (statistics[sender][map][key] == undefined) {
        statistics[sender][map][key] = 0;
    }
    statistics[sender][map][key] += value;
}

function incrementValue(statistics, sender, map, value) {
    if (statistics.all[map] == undefined) {
        statistics.all[map] = 0;
    }
    statistics.all[map] += value;
    if (statistics[sender][map] == undefined) {
        statistics[sender][map] = 0;
    }
    statistics[sender][map] += value;
}

function getIndexOfs(str, find) {
    var pos = [];
    var p = 0;
    var i;
    while ((i = str.indexOf(find)) != -1) {
        pos.push(p + i);
        p += i + 1;
        str = str.substr(i + 1);
    }
    return pos;
}

class Message {
    constructor(date, time, sender, text) {
        this.date = date;
        this.time = time;
        this.sender = sender;
        this.text = text;
    }
}