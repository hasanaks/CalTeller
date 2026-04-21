// ── API Key ─────────────────────────────────────
// Senin yeni API anahtarın buraya eklendi:
const API_KEY = '!ANAHTAR BURAYA YAZILIR!'; 

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

let currentBase64 = null;
let currentMimeType = null;

// ── Upload Handlers ──────────────────────────────
pickBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', () => { if (!currentBase64) fileInput.click(); });
fileInput.addEventListener('change', () => { if (fileInput.files && fileInput.files[0]) loadFile(fileInput.files[0]); });

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadFile(file);
});

removeBtn.addEventListener('click', (e) => { e.stopPropagation(); resetUpload(); });

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
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
  currentBase64 = null; currentMimeType = null; fileInput.value = '';
  previewImg.src = ''; previewWrap.style.display = 'none';
  dropContent.style.display = 'flex'; analyzeBtn.disabled = true;
}

// ── Analyze (HATA DÜZELTİLMİŞ YENİ VERSİYON) ───────
analyzeBtn.addEventListener('click', analyze);

async function analyze() {
  if (!currentBase64) return;
  setLoading(true); hideError(); resultCard.style.display = 'none';

  const promptText = `Sen bir beslenme uzmanısın. Bu yemek fotoğrafını analiz et ve SADECE aşağıdaki JSON formatında yanıt ver. 
  JSON dışında hiçbir açıklama ekleme.
  {
    "foodName": "Yemeğin adı",
    "totalCalories": 500,
    "multipleDishes": false,
    "dishes": [],
    "activities": {"walking": 30, "running": 15, "cycling": 20, "swimming": 10},
    "funFact": "Kısa bilgi",
    "healthNote": "Kısa not"
  }`;

  try {
    // BURASI ÇOK ÖNEMLİ: Senin hesabındaki modele uygun olan yeni URL yapısı:
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { 
              inline_data: { 
                mime_type: currentMimeType, 
                data: currentBase64 
              } 
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API Hatası');

    let rawText = data.candidates[0].content.parts[0].text;
    // Markdown (```json) bloklarını temizle
    const cleanJSON = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJSON);
    renderResult(parsed);

  } catch (err) {
    console.error(err);
    showError('Analiz hatası: ' + err.message);
  } finally { setLoading(false); }
}

// ── UI Helpers (Sonuçları ekrana basma) ────────────
function renderResult(data) {
  foodName.textContent = data.foodName || 'Bilinmeyen';
  calorieNumber.textContent = data.totalCalories ?? '—';
  
  if (data.multipleDishes && data.dishes && data.dishes.length > 0) {
    dishesUl.innerHTML = '';
    data.dishes.forEach(dish => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="dish-name-text">${dish.name}</span><span class="dish-cal">${dish.calories} kcal</span>`;
      dishesUl.appendChild(li);
    });
    dishesList.style.display = 'block';
  } else {
    dishesList.style.display = 'none';
  }

  const act = data.activities || {};
  actWalk.textContent = formatMin(act.walking);
  actRun.textContent = formatMin(act.running);
  actCycle.textContent = formatMin(act.cycling);
  actSwim.textContent = formatMin(act.swimming);
  funFact.textContent = data.funFact || '';
  healthNote.textContent = data.healthNote || '';
  resultCard.style.display = 'block';
  resultCard.scrollIntoView({ behavior: 'smooth' });
}

function formatMin(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? '—' : (n >= 60 ? `${Math.floor(n/60)}s ${n%60}dk` : `${n} dk`);
}

resetBtn.addEventListener('click', () => { resetUpload(); resultCard.style.display = 'none'; hideError(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
function setLoading(l) { analyzeBtn.disabled = l; analyzeBtnText.style.display = l ? 'none' : 'inline'; spinner.style.display = l ? 'block' : 'none'; }
function showError(m) { errorMsg.textContent = m; errorBox.style.display = 'block'; }
function hideError() { errorBox.style.display = 'none'; }
