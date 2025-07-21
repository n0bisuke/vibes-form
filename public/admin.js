const socket = io();

const surveyForm = document.getElementById('survey-form');
const questionInput = document.getElementById('question-input');
const optionsList = document.getElementById('options-list');
const addOptionBtn = document.getElementById('add-option-btn');
const resultMsg = document.getElementById('result-msg');

// 選択肢追加
addOptionBtn.onclick = () => {
  const row = document.createElement('div');
  row.className = 'option-row';
  row.innerHTML = `
    <input type="text" class="option-input" required placeholder="選択肢">
    <button type="button" class="remove-option-btn" tabindex="-1">削除</button>
  `;
  optionsList.appendChild(row);
  row.querySelector('.remove-option-btn').onclick = () => row.remove();
};

// 既存の削除ボタンにもイベント付与
Array.from(document.getElementsByClassName('remove-option-btn')).forEach(btn => {
  btn.onclick = (e) => e.target.parentElement.remove();
});

// 送信
surveyForm.onsubmit = (e) => {
  e.preventDefault();
  const question = questionInput.value.trim();
  const options = Array.from(document.getElementsByClassName('option-input'))
    .map(input => input.value.trim())
    .filter(opt => opt);
  if (!question || options.length < 2) {
    resultMsg.textContent = '質問文と2つ以上の選択肢が必要です。';
    return;
  }
  socket.emit('addSurvey', { question, options });
  resultMsg.textContent = 'アンケートを追加しました。';
  surveyForm.reset();
  // 選択肢2つだけ残す
  while (optionsList.children.length > 2) optionsList.lastChild.remove();
};

const clearChatBtn = document.getElementById('clear-chat-btn');
const clearSurveyBtn = document.getElementById('clear-survey-btn');
const downloadCsvBtn = document.getElementById('download-csv-btn');

// チャット履歴クリア
clearChatBtn.onclick = () => {
  if (confirm('本当にチャット履歴をクリアしますか？')) {
    socket.emit('clearChat');
  }
};
// アンケート集計クリア
clearSurveyBtn.onclick = () => {
  if (confirm('本当にアンケート集計をクリアしますか？')) {
    socket.emit('clearSurvey');
  }
};
// CSVダウンロード
downloadCsvBtn.onclick = () => {
  socket.emit('downloadCSV');
};

socket.on('addSurveyError', (msg) => {
  resultMsg.textContent = msg;
});

// サーバーからの完了メッセージ
socket.on('adminResult', (msg) => {
  resultMsg.textContent = msg;
});

// サーバーからCSVデータ受信
socket.on('csvData', (csv) => {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'survey_results.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
});
