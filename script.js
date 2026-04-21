// ── API Key ─────────────────────────────────────
// Anthropic Console'dan aldığın key'i buraya yapıştır:
const API_KEY = '';

// ── DOM References ───────────────────────────────
const dropZone     = document.getElementById('dropZone');
const fileInput    = document.getElementById('fileInput');
const pickBtn      = document.getElementById('pickBtn');
const dropContent  = document.getElementById('dropContent');
const previewWrap  = document.getElementById('previewWrap');
const previewImg   = document.getElementById('previewImg');
const removeBtn    = document.getElementById('removeBtn');
const analyzeBtn   = document.getElementById('analyzeBtn');
const analyzeBtnText = document.getElementById('analyzeBtnText');
const spinner      = document.getElementById('spinner');
const resultCard   = document.getElementById('resultCard');
const errorBox     = document.getElementById('errorBox');
const errorMsg     = document.getElementById('errorMsg');

// Result fields
const foodName     = document.getElementById('foodName');
const calorieNumber = document.getElementById('calorieNumber');
const dishesList   = document.getElementById('dishesList');
const dishesUl     = document.getElementById('dishesUl');
const actWalk      = document.getElementById('actWalk');
const actRun       = document.getElementById('actRun');
const actCycle     = document.getElementById('actCycle');
const actSwim      = document.getElementById('actSwim');
const funFact      = document.getElementById('funFact');
const healthNote   = document.getElementById('healthNote');
const resetBtn     = document.getElementById('resetBtn');

// ── State ────────────────────────────────────────
let currentBase64 = null;
let currentMimeType = null;

// ── Upload Handlers ──────────────────────────────
pickBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropZone.addEventListener('click', () => {
  if (!currentBase64) fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    loadFile(fileInput.files[0]);
  }
});

// Drag & drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    loadFile(file);
  }
});

removeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  resetUpload();
});

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    // Extract base64 and mime type
    const [header, base64] = dataUrl.split(',');
    currentBase64 = base64;
    currentMimeType = file.type || 'image/jpeg';

    previewImg.src = dataUrl;
    dropContent.style.display = 'none';
    previewWrap.style.display = 'block';
    analyzeBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

function resetUpload() {
  currentBase64 = null;
  currentMimeType = null;
  fileInput.value = '';
  previewImg.src = '';
  previewWrap.style.display = 'none';
  dropContent.style.display = 'flex';
  analyzeBtn.disabled = true;
}

// ── Analyze ──────────────────────────────────────
analyzeBtn.addEventListener('click', analyze);

async function analyze() {
  if (!currentBase64) return;
  if (!API_KEY) {
    showError('API key eksik. script.js dosyasındaki API_KEY değişkenine Anthropic key\'ini ekle.');
    return;
  }

  setLoading(true);
  hideError();
  resultCard.style.display = 'none';

  const prompt = `Sen bir beslenme uzmanısın. Bu yemek fotoğrafını analiz et ve aşağıdaki JSON formatında yanıt ver. Başka hiçbir şey yazma, sadece JSON.

{
  "foodName": "Yemeğin adı (birden fazlaysa virgülle ayır)",
  "totalCalories": 000,
  "multipleDishes": true veya false,
  "dishes": [
    { "name": "Yemek adı", "calories": 000 }
  ],
  "activities": {
    "walking": 00,
    "running": 00,
    "cycling": 00,
    "swimming": 00
  },
  "funFact": "İlginç bir kalori karşılaştırması veya gerçeği (örn. Bu kalori X parça çikolata bara eşit)",
  "healthNote": "Kısa, samimi ve yargılamayan bir sağlık notu (1 cümle)"
}

Kurallar:
- Eğer görüntüde birden fazla yemek varsa multipleDishes true yap ve her birini dishes dizisine ekle
- activities içindeki değerler dakika cinsindendir
- totalCalories dishes toplamına eşit olmalı (birden fazla yemek varsa)
- Yanıtın SADECE geçerli JSON olsun, markdown veya açıklama ekleme`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: currentMimeType,
                  data: currentBase64
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content[0]?.text || '';

    // Parse JSON — strip any markdown fences just in case
    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    renderResult(parsed);

  } catch (err) {
    console.error(err);
    showError('Analiz sırasında hata oluştu: ' + err.message);
  } finally {
    setLoading(false);
  }
}

// ── Render Result ────────────────────────────────
function renderResult(data) {
  // Food name
  foodName.textContent = data.foodName || 'Bilinmeyen yemek';

  // Calories
  calorieNumber.textContent = data.totalCalories ?? '—';

  // Multiple dishes
  if (data.multipleDishes && data.dishes && data.dishes.length > 1) {
    dishesUl.innerHTML = '';
    data.dishes.forEach(dish => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="dish-name-text">${dish.name}</span>
        <span class="dish-cal">${dish.calories} kcal</span>
      `;
      dishesUl.appendChild(li);
    });
    dishesList.style.display = 'block';
  } else {
    dishesList.style.display = 'none';
  }

  // Activities
  const act = data.activities || {};
  actWalk.textContent  = formatMin(act.walking);
  actRun.textContent   = formatMin(act.running);
  actCycle.textContent = formatMin(act.cycling);
  actSwim.textContent  = formatMin(act.swimming);

  // Fun fact & health note
  funFact.textContent   = data.funFact || '';
  healthNote.textContent = data.healthNote || '';

  // Show card
  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatMin(val) {
  if (val == null) return '—';
  const n = parseInt(val, 10);
  if (isNaN(n)) return '—';
  if (n >= 60) {
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m > 0 ? `${h}s ${m}dk` : `${h}s`;
  }
  return `${n} dk`;
}

// ── Reset ────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  resetUpload();
  resultCard.style.display = 'none';
  hideError();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── UI Helpers ───────────────────────────────────
function setLoading(loading) {
  analyzeBtn.disabled = loading;
  if (loading) {
    analyzeBtnText.style.display = 'none';
    spinner.style.display = 'block';
  } else {
    analyzeBtnText.style.display = 'inline';
    spinner.style.display = 'none';
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.style.display = 'block';
}

function hideError() {
  errorBox.style.display = 'none';
}