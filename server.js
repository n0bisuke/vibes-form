const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// /n0bisuke で管理画面を返す
app.get('/n0bisuke', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// メモリ上でメッセージとアンケートを管理
let messages = [];
let surveys = [
  {
    question: 'このサービスの使いやすさは？',
    options: ['とても良い', '良い', '普通', '悪い'],
    results: [0, 0, 0, 0], // 各選択肢の回答数
    answers: {} // { socketId: optionIndex }
  }
];
let currentSurveyIndex = 0;

const cursors = {}; // { socketId: { x, y, nickname } }

io.on('connection', (socket) => {
  // 初期データ送信
  const survey = surveys[currentSurveyIndex];
  socket.emit('init', {
    messages,
    survey,
    answered: survey.answers[socket.id] !== undefined
  });

  // メッセージ受信
  socket.on('postMessage', (msg) => {
    messages.push(msg);
    io.emit('newMessage', msg);
  });

  // アンケート回答受信
  socket.on('answerSurvey', (optionIndex) => {
    const survey = surveys[currentSurveyIndex];
    if (typeof optionIndex !== 'number') return;
    // すでに回答済みなら無視
    if (survey.answers[socket.id] !== undefined) return;
    survey.answers[socket.id] = optionIndex;
    survey.results[optionIndex]++;
    // 全員に集計結果を送信、自分にはanswered: trueを含めて送信
    io.sockets.sockets.forEach((s) => {
      s.emit('surveyResults', {
        results: survey.results,
        answered: survey.answers[s.id] !== undefined
      });
    });
  });

  // 管理画面からアンケート追加
  socket.on('addSurvey', ({ question, options }) => {
    if (
      typeof question !== 'string' ||
      !Array.isArray(options) ||
      options.length < 2 ||
      options.some(opt => typeof opt !== 'string' || !opt.trim())
    ) {
      socket.emit('addSurveyError', '質問文と2つ以上の選択肢が必要です。');
      return;
    }
    // 新しいアンケートを追加
    const newSurvey = {
      question: question.trim(),
      options: options.map(opt => opt.trim()),
      results: Array(options.length).fill(0),
      answers: {}
    };
    surveys.push(newSurvey);
    currentSurveyIndex = surveys.length - 1;
    // 全員の回答状況をリセット
    io.sockets.sockets.forEach((s) => {
      s.emit('init', {
        messages,
        survey: newSurvey,
        answered: false
      });
    });
    socket.emit('adminResult', 'アンケートを追加しました。');
  });

  // チャット履歴クリア
  socket.on('clearChat', () => {
    messages = [];
    const survey = surveys[currentSurveyIndex];
    io.sockets.sockets.forEach((s) => {
      s.emit('init', {
        messages,
        survey,
        answered: survey.answers[s.id] !== undefined
      });
    });
    socket.emit('adminResult', 'チャット履歴をクリアしました。');
  });

  // アンケート集計クリア
  socket.on('clearSurvey', () => {
    const survey = surveys[currentSurveyIndex];
    survey.results = Array(survey.options.length).fill(0);
    survey.answers = {};
    io.sockets.sockets.forEach((s) => {
      s.emit('init', {
        messages,
        survey,
        answered: false
      });
    });
    socket.emit('adminResult', 'アンケート集計をクリアしました。');
  });

  // CSVダウンロード
  socket.on('downloadCSV', () => {
    const survey = surveys[currentSurveyIndex];
    let csv = '選択肢,票数\n';
    survey.options.forEach((opt, i) => {
      csv += `"${opt.replace(/"/g, '""')}",${survey.results[i]}\n`;
    });
    socket.emit('csvData', csv);
    socket.emit('adminResult', 'CSVをダウンロードしました。');
  });

  // カーソル移動受信
  socket.on('cursorMove', ({ x, y, nickname }) => {
    cursors[socket.id] = { x, y, nickname };
    io.emit('cursors', cursors);
  });

  // 切断時
  socket.on('disconnect', () => {
    delete cursors[socket.id];
    io.emit('cursors', cursors);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
