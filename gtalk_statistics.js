var word_cloud_filter = [];
var word_cloud_filter_id = {};
var user_id = {};
var user_replace = {};
var user_color = {};

$('#submit').on('click', function () {
    $('#submit').hide();
    $('#user_replace').hide();
    var file_reader = new FileReader();

    file_reader.addEventListener('load', function (e) {
        var text = e.target.result;
        // ファイルのチェック
        if (text.substr(0, 6) != '[LINE]') {
            alert('このファイルはLINEのトーク履歴ではありません。');
            $('#submit').show();
            return;
        }
        // ユーザー名の置換の設定
        user_replace = {};
        for(let user of Object.keys(user_id)) {
            var name = $('#' + user_id[user]).val();
            if(name != undefined && name != '') {
                user_replace[user] = name;
            }
        }
        // Web Workerの設定
        const worker = new Worker('worker.js');
        // トーク履歴の解析開始
        worker.postMessage({message: 'parse', data: text, user_replace: user_replace, do_user_replace_message: $('#edit_user_replace_message').is(':checked')});
        worker.onmessage = function (response) {
            var data = response.data;
            if(data.indexOf && data.indexOf('status ') != -1) {
                $('#main').html('<p>' + data.substr(7) + '</p>');
            }else {
                // ワードクラウドのフィルターの設定
                word_cloud_filter = data.filter;
                for(let filter of word_cloud_filter) {
                    word_cloud_filter_id[filter] = generateUuid();
                }
                // ユーザーの色
                var sender_color = {all: '#d2275b80'};
                for(let sender of data.original_senders) {
                    var u = sender;
                    if(user_color[sender] == undefined) {
                        var r = nextInt(255).toString(16);
                        var g = nextInt(255).toString(16);
                        var b = nextInt(255).toString(16);
                        if(r.length == 1) r = '0' + r;
                        if(g.length == 1) g = '0' + g;
                        if(b.length == 1) b = '0' + b;
                        user_color[sender] = '#' + r + g + b;
                    }
                    if(user_replace[sender] != undefined) {
                        u = user_replace[sender];
                    }
                    sender_color[u] = user_color[sender] + '80';
                }
                var main_div = document.getElementById('main');
                var main_jq = $('#main');
                main_jq.html('');
                // ユーザー名の置換
                $('#user_replace').show();
                $('#edit_user_replace').on('click', function() {
                    $('#user_replace_dialog').show();
                });
                $('#user_replace_dialog div .close').on('click', function() {
                    $('#user_replace_dialog').hide();
                });
                for(let sender of data.original_senders) {
                    if(user_id[sender] == undefined) {
                        var id = generateUuid();
                        user_id[sender] = id;
                    }
                    if(user_replace[sender] == undefined) {
                        user_replace[sender] = '';
                    }
                }
                for(let user of Object.keys(user_id)) {
                    let id = user_id[user];
                    $('tr.' + id).remove();
                    $('#user_replace_table').append('<tr class="' + id + '"><td>' + user + '</td><td><input type="input" id="' + id + '" placeholder="' + user + '" value="' + user_replace[user] + '"><input type="color" id="' + id + '_color" value="' + user_color[user] + '"></td></tr>')
                    $('#' + id +'_color').change(function() {
                        user_color[user] = $('#' + id + '_color').val();
                    });
                }
                main_jq.append('<h1>解析したデータの詳細</h1>');
                main_jq.append('<p>メッセージ数:' + data.messages.all.length + '</p>');
                for (let sender of data.senders) {
                    main_jq.append('<p>' + sender + 'のメッセージ数:' + data.messages[sender].length + '</p>');
                }
                for (let sender of data.senders) {
                    main_jq.append('<p>' + sender + 'が送信したスタンプの数:' + data.statistics[sender].stamp_count + '</p>');
                }
                for (let sender of data.senders) {
                    main_jq.append('<p>' + sender + 'が送信した写真の数:' + data.statistics[sender].image_count + '</p>');
                }
                for (let sender of data.senders) {
                    main_jq.append('<p>' + sender + 'が送信した動画の数:' + data.statistics[sender].video_count + '</p>');
                }
                var first_message_date = new Date(data.messages.all[0].date);
                var last_message_date = new Date(data.messages.all[data.messages.all.length - 1].date);
                main_jq.append('<p>最初のメッセージ:' + first_message_date.getFullYear() + '年' + (first_message_date.getMonth() + 1) + '月' + first_message_date.getDate() + '日' + '</p>');
                main_jq.append('<p>最後のメッセージ:' + last_message_date.getFullYear() + '年' + (last_message_date.getMonth() + 1) + '月' + last_message_date.getDate() + '日' + '</p>');
                // 棒グラフ表示関数
                function addBarGraph(title, labels, datasets, options = {}) {
                    var canvas = document.createElement('canvas');
                    main_jq.append('<h1>' + title + '</h1>');
                    main_div.appendChild(canvas);
                    var chart = new Chart(canvas, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: datasets
                        },
                        options: Object.assign({
                            plugins: {
                                title: {
                                    display: true,
                                    text: title
                                }
                            },
                        }, options)
                    });
                }
                main_jq.append('<h1>操作方法</h1>');
                main_jq.append('<p>軸の上にマウスや指を持っていくと細かい数値が読み取れます。上にある軸の名前をクリックやタップすると非表示にできます。</p>');
                var time_datasets = [
                    {
                        label: '全員',
                        data: Object.values(data.statistics.all.time),
                        backgroundColor: sender_color.all
                    }
                ];
                var month_datasets = [
                    {
                        label: '全員',
                        data: Object.values(data.statistics.all.month),
                        backgroundColor: sender_color.all
                    }
                ];
                var day_datasets = [
                    {
                        label: '全員',
                        data: Object.values(data.statistics.all.day),
                        backgroundColor: sender_color.all
                    }
                ];
                var year_month_datasets = [
                    {
                        label: '全員',
                        data: Object.values(data.statistics.all.year_month),
                        backgroundColor: sender_color.all
                    }
                ];
                for (let sender of data.senders) {
                    time_datasets.push({
                        label: sender,
                        data: Object.values(data.statistics[sender].time),
                        backgroundColor: sender_color[sender]
                    });
                    month_datasets.push({
                        label: sender,
                        data: Object.values(data.statistics[sender].month),
                        backgroundColor: sender_color[sender]
                    });
                    day_datasets.push({
                        label: sender,
                        data: Object.values(data.statistics[sender].day),
                        backgroundColor: sender_color[sender]
                    });
                    year_month_datasets.push({
                        label: sender,
                        data: Object.values(data.statistics[sender].year_month),
                        backgroundColor: sender_color[sender]
                    });
                }
                var aspectRatio = window.innerWidth / (window.innerHeight * 0.7);
                addBarGraph(
                    '時間帯別　メッセージ数',
                    ['0時', '1時', '2時', '3時', '4時', '5時', '6時', '7時', '8時', '9時', '10時', '11時', '12時',
                        '13時', '14時', '15時', '16時', '17時', '18時', '19時', '20時', '21時', '22時', '23時'],
                    time_datasets,
                    {aspectRatio: aspectRatio,
                        maintainAspectRatio: false,
                        onResize: function(chart) {
                            chart.resize(chart.width, chart.width / (window.innerWidth / (window.innerHeight * 0.7)));
                        }});
                addBarGraph(
                    '月別　メッセージ数',
                    ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
                    month_datasets,
                    {aspectRatio: aspectRatio,
                        maintainAspectRatio: false,
                        onResize: function(chart) {
                            chart.resize(chart.width, chart.width / (window.innerWidth / (window.innerHeight * 0.7)));
                        }});
                addBarGraph(
                    '日別　メッセージ数',
                    ['1日', '2日', '3日', '4日', '5日', '6日', '7日', '8日', '9日', '10日',
                        '11日', '12日', '13日', '14日', '15日', '16日', '17日', '18日', '19日', '20日',
                        '21日', '22日', '23日', '24日', '25日', '26日', '27日', '28日', '29日', '30日', '31日'],
                    day_datasets,
                    {aspectRatio: aspectRatio,
                        maintainAspectRatio: false,
                        onResize: function(chart) {
                            chart.resize(chart.width, chart.width / (window.innerWidth / (window.innerHeight * 0.7)));
                        }});
                addBarGraph(
                    '年月別　メッセージ数',
                    Object.keys(data.statistics.all.year_month),
                    year_month_datasets,
                    {aspectRatio: aspectRatio,
                        maintainAspectRatio: false,
                        onResize: function(chart) {
                            chart.resize(chart.width, chart.width / (window.innerWidth / (window.innerHeight * 0.7)));
                        }});
                main_jq.append('<h1>ワードクラウド</h1>');
                main_jq.append('<p>発言が多かった単語が大きく表示されます。小さいと数回程度しか発言していません。</p>');
                main_jq.append('<p>大きい単語ばかりだと普段使う単語に偏りがあります。小さい単語ばかりだと普段いろいろな単語を使用しています。</p>');
                main_jq.append('<p>自動で単語を判別している都合上、意味のわからない単語がたくさんあるかもしれませんがご了承ください。</p>');
                main_jq.append('<p>スマホの方は長押し、PCの方は右クリックで画像が保存できます。</p>');
                main_jq.append('<p class="bold">※ワードアートには個人情報が含まれる可能性があります。扱いに十分お気をつけください。</p>');
                main_jq.append('<p class="bold">※ワードアートはその人そのものです。他人に見せるときは許可を取りましょう。</p>');
                main_jq.append('<p class="bold">※デフォルトで個人情報だと思われる単語は省かれています。もしそういった単語もワードクラウドに追加したい場合はフィルターから削除してください。</p>');
                main_jq.append('<p>フィルターを追加するボタンを押したあと、人名、地名を自動で検出してフィルターに追加する機能があります。ぜひ活用してください。</p>');
                // ワードクラウド用のフィルター
                main_jq.append('<p><input id="edit_cloud_filter" type="button" value="ワードクラウド用のフィルターを編集する"></p>');
                main_jq.append(`
                    <div id="cloud_filter" class="dialog" style="display: none;">
                        <div class="dialog_box">
                            <p class="close">×</p>
                            <p><input id="word_filter_auto_open" type="button" value="自動で追加(個人情報を自動で追加する)"></p>
                            <p>除外するものを列挙してください。完全一致のみ適用されます。</p>
                            <p><input id="word_filter_input" type="text" style="width: 90%" placeholder="フィルターを入力">
                                <input id="add_filter" type="button" value="追加"></p>
                            <p><input id="clear_filter" type="button" value="全て消去"></p>
                            <p><input id="word_filter_search" type="text" style="width: 90%" placeholder="検索"></p>
                            <div class="table">
                                <table id="word_filter_table">
                                    <tr><td>フィルター</td><td>操作</td></tr>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div id="cloud_filter_auto" class="dialog" style="display: none;">
                        <div class="dialog_box">
                            <p class="close">×</p>
                            <p><input id="word_add_auto_name" type="checkbox" checked><label for="word_add_auto_name">人名</label></p>
                            <p><input id="word_add_auto_place_name" type="checkbox" checked><label for="word_add_auto_place_name">地名</label></p>
                            <p><input id="word_add_auto_run" type="button" value="実行"></p>
                            <p id="word_add_auto_status"></p>
                        </div>
                    </div>`);
                $('#edit_cloud_filter').on('click', function() {
                    $('#cloud_filter').show();
                });
                $('#cloud_filter div .close').on('click', function() {
                    $('#cloud_filter').hide();
                });
                // フィルターを追加する
                function add_word_filter(filter) {
                    // フィルターに追加できないものを除外
                    if(filter.length == 1) {
                        return;
                    }
                    if(!word_cloud_filter_id[filter]) {
                        var id = generateUuid();
                        word_cloud_filter.push(filter);
                        word_cloud_filter_id[filter] = id;
                        append_word_filter(filter);
                    }
                }
                function append_word_filter(filter) {
                    // フィルターに追加できないものを除外
                    let id = word_cloud_filter_id[filter];
                    $('#word_filter_table').append('<tr class="' + id + '"><td id="' + id + '">' + filter + '</td><td><p style="cursor: pointer;color: #176dec;margin: 0;" class="' + id + '">削除</a></td></tr>');
                    // 削除クリック時
                    $('p.' + id).on('click', function() {
                        $('tr.' + id).remove();
                        word_cloud_filter = word_cloud_filter.filter(n => n != filter);
                        delete word_cloud_filter_id[filter];
                    });
                }
                // 初期状態のフィルターを追加
                for(let key in word_cloud_filter_id) {
                    append_word_filter(key);
                }
                $('#add_filter').on('click', function() {
                    $('#word_filter_search').val('');
                    $('#word_filter_search').keyup();
                    var filter = $('#word_filter_input').val();
                    if(filter.length == 1) {
                        alert('1文字はワードクラウドに表示されないのでフィルターに追加する必要はありません。');
                        return;
                    }
                    $('#word_filter_input').val('');
                    add_word_filter(filter);
                });
                $('#clear_filter').on('click', function() {
                    $('#word_filter_search').val('');
                    $('#word_filter_search').keyup();
                    if(confirm('本当に全て消去してよろしいですか？')) {
                        for(let key in word_cloud_filter_id) {
                            $('tr.' + word_cloud_filter_id[key]).remove();
                        }
                        word_cloud_filter = [];
                        word_cloud_filter_id = {};
                    }
                });
                // 検索
                $('#word_filter_search').keyup(function() {
                    var search = $('#word_filter_search').val();
                    for(let key in word_cloud_filter_id) {
                        $('tr.' + word_cloud_filter_id[key]).remove();
                    }
                    if(search.length == 0) {
                        for(let key in word_cloud_filter_id) {
                            append_word_filter(key);
                        }
                    }else {
                        for(let key in word_cloud_filter_id) {
                            if(key.indexOf(search) != -1) {
                                append_word_filter(key);
                            }
                        }
                    }
                });
                $('#cloud_filter_auto div .close').on('click', function() {
                    $('#cloud_filter_auto').hide();
                    $('#cloud_filter').show();
                });
                $('#word_filter_auto_open').on('click', function() {
                    $('#cloud_filter').hide();
                    $('#cloud_filter_auto').show();
                    $('#word_add_auto_name').prop('checked', true);
                    $('#word_add_auto_place_name').prop('checked', true);
                });
                // フィルターの自動検索開始
                $('#word_add_auto_run').on('click', function() {
                    var check = [];
                    if($('#word_add_auto_name').is(':checked')) {
                        check.push('人名');
                    }
                    if($('#word_add_auto_place_name').is(':checked')) {
                        check.push('地域');
                    }
                    $('#word_add_auto_run').hide();
                    const worker = new Worker('js/get_names_and_place_names.js');
                    worker.postMessage({messages: data.messages.all, check: check});
                    worker.onmessage = function(response) {
                        var auto_data = response.data;
                        if(auto_data.indexOf && auto_data.indexOf('status ') == 0) {
                            $('#word_add_auto_status').html(auto_data.substr(7));
                        }else {
                            // 自動検索完了
                            for(let key of auto_data) {
                                add_word_filter(key);
                            }
                            $('#word_add_auto_run').show();
                            $('#word_add_auto_status').html('');
                            $('#cloud_filter_auto div .close').click();
                        }
                    };
                });
                main_jq.append('<p><input id="regenerate_word_cloud" type="button" value="ワードクラウドを再生成"></p>');
                main_jq.append('<p><input id="agree_personal_information" type="checkbox"><label for="agree_personal_information">個人情報の扱いを十分理解したのでワードクラウドを見る</label></p>');
                main_jq.append('<div id="word_cloud" style="display: none;"></div>');
                $('#regenerate_word_cloud').on('click', function() {
                    genWordCloud(data);
                    genRemarks();
                });
                genWordCloud(data);
                $('#agree_personal_information').change(function() {
                    if($('#agree_personal_information').is(':checked')) {
                        $('#word_cloud').css('display', 'block');
                    }else {
                        $('#word_cloud').css('display', 'none');
                    }
                });
                $('#submit').show();
                // 発言回数ランキング
                main_jq.append('<h1>発言回数ランキング</h1>');
                main_jq.append('<p>それぞれ発言回数の多かった単語上位100個を表示しています。</p>');
                main_jq.append('<div id="remarks"></div>');
                function genRemarks() {
                    var parent = $('#remarks');
                    parent.html('');
                    parent.append('<h2>このトーク</h2>');
                    {
                        var words = [];
                        for (let word in data.statistics.all.words) {
                            if(word.length == 1) continue;
                            // wwwは複数種類検知されやすい文字なのでブロック
                            if(word.match(/^[wｗ]*$/)) continue;
                            // フィルターに入っている文字はブロック
                            if(word_cloud_filter.includes(word)) continue;
                            words.push({text: word, count: data.statistics.all.words[word]});
                        }
                        words.sort(function(a, b) {
                            return b.count - a.count;
                        });
                        if(words.length > 100) {
                            words = words.slice(0, 100);
                        }
                        parent.append('<div class="remarks"><table id="remarks_all"><tr><td>単語</td><td>回数</td></tr></table></div>');
                        var p = $('#remarks_all');
                        for(let word of words) {
                            p.append('<tr><td>' + word.text + '</td><td>' + word.count + '</td></tr>');
                        }
                    }
                    for(let sender of data.senders) {
                        parent.append('<h2>' + sender + '</h2>');
                        var words = [];
                        for (let word in data.statistics[sender].words) {
                            if(word.length == 1) continue;
                            // wwwは複数種類検知されやすい文字なのでブロック
                            if(word.match(/^[wｗ]*$/)) continue;
                            // フィルターに入っている文字はブロック
                            if(word_cloud_filter.includes(word)) continue;
                            words.push({text: word, count: data.statistics[sender].words[word]});
                        }
                        words.sort(function(a, b) {
                            return b.count - a.count;
                        });
                        if(words.length > 100) {
                            words = words.slice(0, 100);
                        }
                        var id = generateUuid();
                        parent.append('<div class="remarks"><table id="remarks_' + id + '"><tr><td>単語</td><td>回数</td></tr></table></div>');
                        var p = $('#remarks_' + id);
                        for(let word of words) {
                            p.append('<tr><td>' + word.text + '</td><td>' + word.count + '</td></tr>');
                        }
                    }
                }
                genRemarks();
            }
        }
    });

    file_reader.readAsText(document.getElementById('file').files[0]);
});

function nextInt(max, min = 0) {
    return Math.floor(Math.random() * (max - min) + min);
}

function genWordCloud(data) {
    var body = $('#word_cloud');
    body.html('');
    var body_div = document.getElementById('word_cloud');
    {
        body.append('<div id="cloud" style="display: none"></div>');
        drawWordCloud('#cloud', data.statistics.all.words);
        var canvas = document.createElement('canvas');
        canvas.id = 'cloud_canvas';
        canvas.style.display = 'inline-block';
        canvas.style.width = '100%';
        canvas.style.maxWidth = '600px';
        body_div.appendChild(canvas);
        svg2canvas(document.getElementById('cloud').children[0], canvas, data.senders.join('と'));
    }
    for(let sender of data.senders) {
        var id = generateUuid();
        body.append('<div id="cloud_' + id + '" style="display: none"></div>');
        drawWordCloud('#cloud_' + id, data.statistics[sender].words);
        var canvas = document.createElement('canvas');
        canvas.id = 'cloud_' + id + '_canvas';
        canvas.style.display = 'inline-block';
        canvas.style.width = '100%';
        canvas.style.maxWidth = '600px';
        body_div.appendChild(canvas);
        svg2canvas(document.getElementById('cloud_' + id).children[0], canvas, sender);
    }
}

function drawWordCloud(selector, wordsData) {
    // 描画しきれない分は捨てる
    var words = [];
    for (let word in wordsData) {
        if(word.length == 1) continue;
        // wwwは複数種類検知されやすい文字なのでブロック
        if(word.match(/^[wｗ]*$/)) continue;
        // フィルターに入っている文字はブロック
        if(word_cloud_filter.includes(word)) continue;
        words.push({text: word, count: wordsData[word]});
    }
    words.sort(function(a, b) {
        return b.count - a.count;
    });
    if(words.length > 400) {
        words = words.slice(0, 400);
    }

    var h = 500;
    var w = 500;

    var countMax = words[0].count;
    var sizeScale = d3.scaleLinear().domain([0, countMax]).range([2, 150]);
    for(let word of words) {
        word.size = sizeScale(word.count);
    }

    d3.layout.cloud().size([w, h])
        .words(words)
        .rotate(function () { return Math.random() < 0.7 ? 0 : Math.random() > 0.5 ? 90 : 270; })
        .font('system-ui')
        .fontSize(function (d) { return d.size; })
        .on('end', draw)
        .start();

    // ワードクラウド描画
    function draw(words) {
        d3.select(selector)
            .append('svg')
            .attr('class', 'ui fluid image')
            .attr('viewBox', '0 0 ' + w + ' ' + h)
            .attr('width', '100%')
            .attr('height', '100%')
            .append('g')
            .attr('transform', 'translate(' + w / 2 + ',' + h / 2 + ')')
            .selectAll('text')
            .data(words)
            .enter().append('text')
            .style('font-size', function (d) { return d.size + 'px'; })
            .style('font-family', 'system-ui')
            .style('fill', function (d, i) { return d3.schemeCategory10[i % 10]; })
            .attr('text-anchor', 'middle')
            .attr('transform', function (d) {
                return 'translate(' + [d.x, d.y] + ') rotate(' + d.rotate + ')';
            })
            .text(function (d) { return d.text; });
    }
}

function generateUuid() {
    // https://github.com/GoogleChrome/chrome-platform-analytics/blob/master/src/internal/identifier.js
    // const FORMAT: string = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    let chars = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.split('');
    for (let i = 0, len = chars.length; i < len; i++) {
        switch (chars[i]) {
            case 'x':
                chars[i] = Math.floor(Math.random() * 16).toString(16);
                break;
            case 'y':
                chars[i] = (Math.floor(Math.random() * 4) + 8).toString(16);
                break;
        }
    }
    return chars.join('');
}

function svg2canvas(svgElement, canvas, user) {
    canvas.width = 2000;
    canvas.height = 2220;
    var ctx = canvas.getContext('2d');
    var image = new Image;
    var svgData = new XMLSerializer().serializeToString(svgElement);
    image.src = 'data:image/svg+xml;charset=utf-8;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    
    image.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';
        ctx.font = '100px system-ui';
        ctx.fillText(user, (canvas.width - ctx.measureText(user).width) / 2, 100);
        ctx.fillText('のワードクラウド', (canvas.width - ctx.measureText('のワードクラウド').width) / 2, 200);
        ctx.drawImage(image, 0, canvas.height - canvas.width, canvas.width, canvas.width);
    };
  }