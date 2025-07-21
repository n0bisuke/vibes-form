const socket = io();

let nickname = '';
let answered = false;

// ニックネーム入力
const nicknameModal = document.getElementById('nickname-modal');
const nicknameInput = document.getElementById('nickname-input');
const nicknameBtn = document.getElementById('nickname-btn');
const mainContent = document.getElementById('main-content');
const userNickname = document.getElementById('user-nickname');

nicknameBtn.onclick = () => {
  const value = nicknameInput.value.trim();
  if (value) {
    nickname = value;
    nicknameModal.style.display = 'none';
    mainContent.style.display = '';
    userNickname.textContent = `ニックネーム: ${nickname}`;
  }
};
nicknameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') nicknameBtn.click();
});

// チャット
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

chatForm.onsubmit = (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text && nickname) {
    const msg = { nickname, text, time: new Date().toLocaleTimeString() };
    socket.emit('postMessage', msg);
    chatInput.value = '';
  }
};

function addMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = `<strong>${escapeHTML(msg.nickname)}</strong> <span style="color:#888;font-size:0.9em;">[${msg.time}]</span>: ${escapeHTML(msg.text)}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// アンケート
const surveyQuestion = document.getElementById('survey-question');
const surveyForm = document.getElementById('survey-form');
const surveyResults = document.getElementById('survey-results');
let surveyData = null;

function renderSurvey() {
  if (!surveyData) return;
  surveyQuestion.textContent = surveyData.question;
  surveyForm.innerHTML = '';
  surveyResults.innerHTML = '';
  if (answered) {
    renderResults(surveyData.results, surveyData.options);
    return;
  }
  surveyData.options.forEach((opt, idx) => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="survey" value="${idx}"> ${escapeHTML(opt)}`;
    surveyForm.appendChild(label);
  });
  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.textContent = '回答する';
  surveyForm.appendChild(btn);
}

surveyForm.onsubmit = (e) => {
  e.preventDefault();
  if (answered) return;
  const selected = surveyForm.querySelector('input[name="survey"]:checked');
  if (selected) {
    socket.emit('answerSurvey', Number(selected.value));
    // answeredはサーバーからのレスポンスで更新
  }
};

function renderResults(results, options) {
  const max = Math.max(...results, 1);
  surveyResults.innerHTML = '<b>集計結果:</b><div class="bar-graph">' +
    options.map((opt, i) => {
      const percent = (results[i] / max) * 100;
      return `
        <div class="bar-label">${escapeHTML(opt)}: ${results[i]}票</div>
        <div class="bar-bg">
          <div class="bar" style="width:${percent}%;"></div>
        </div>
      `;
    }).join('') +
    '</div>';
}

/* --- カーソル共有 --- */
const cursorLayer = document.createElement('div');
cursorLayer.id = 'cursor-layer';
cursorLayer.style.position = 'fixed';
cursorLayer.style.left = '0';
cursorLayer.style.top = '0';
cursorLayer.style.width = '100vw';
cursorLayer.style.height = '100vh';
cursorLayer.style.pointerEvents = 'none';
cursorLayer.style.zIndex = '9999';
document.body.appendChild(cursorLayer);

let myCursorSent = false;
document.addEventListener('mousemove', (e) => {
  // mainContentが表示状態かつnicknameが設定済みなら送信
  if (!nickname || mainContent.style.display === 'none') return;
  if (myCursorSent) return;
  myCursorSent = true;
  setTimeout(() => { myCursorSent = false; }, 20);
  socket.emit('cursorMove', {
    x: e.clientX / window.innerWidth,
    y: e.clientY / window.innerHeight,
    nickname
  });
});

// ウィンドウリサイズ時も他ユーザーのカーソルを再配置
window.addEventListener('resize', () => {
  Object.entries(cursorElems).forEach(([id, el]) => {
    if (el.dataset.x && el.dataset.y) {
      el.style.left = (parseFloat(el.dataset.x) * window.innerWidth) + 'px';
      el.style.top = (parseFloat(el.dataset.y) * window.innerHeight) + 'px';
    }
  });
});

let cursorElems = {};
socket.on('cursors', (cursors) => {
  // 自分以外のカーソルを描画
  Object.keys(cursorElems).forEach(id => {
    if (!cursors[id]) {
      cursorLayer.removeChild(cursorElems[id]);
      delete cursorElems[id];
    }
  });
  Object.entries(cursors).forEach(([id, cur]) => {
    if (id === socket.id) return;
    let el = cursorElems[id];
    if (!el) {
      el = document.createElement('div');
      el.className = 'remote-cursor';
      el.innerHTML = `<div class="cursor-dot"></div><div class="cursor-name"></div>`;
      cursorLayer.appendChild(el);
      cursorElems[id] = el;
    }
    el.dataset.x = cur.x;
    el.dataset.y = cur.y;
    el.style.left = (cur.x * window.innerWidth) + 'px';
    el.style.top = (cur.y * window.innerHeight) + 'px';
    el.querySelector('.cursor-name').textContent = cur.nickname || '';
  });
});

// サニタイズ
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, s => ({
    '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;'
  }[s]));
}

// Socket.IO通信
socket.on('init', ({ messages, survey, answered: ans }) => {
  chatMessages.innerHTML = '';
  messages.forEach(addMessage);
  surveyData = survey;
  answered = !!ans;
  renderSurvey();
});

socket.on('newMessage', (msg) => {
  addMessage(msg);
});

socket.on('surveyResults', ({ results, answered: ans }) => {
  if (surveyData) {
    surveyData.results = results;
    answered = !!ans;
    renderSurvey();
  }
});
