// Embedding Similarity Analyzer - JavaScript Module

const modelCheckboxesContainer = document.getElementById('modelCheckboxes');
const sentenceInputsContainer = document.getElementById('sentenceInputs');
const addSentenceBtn = document.getElementById('addSentenceBtn');
const executeBtn = document.getElementById('executeBtn');
const resultsSection = document.getElementById('resultsSection');
const resultsContainer = document.getElementById('resultsContainer');
const errorToast = document.getElementById('errorToast');
const errorMessage = document.getElementById('errorMessage');

let models = [];
let sentenceCount = 0;

// 초기화
async function initialize() {
    await loadModels();
    addSentenceInput();
    addSentenceInput();
    setupEventListeners();
}

// 모델 목록 로드
async function loadModels() {
    try {
        const response = await fetch('/api/embedding/models');
        const data = await response.json();
        models = data.models;
        renderModelCheckboxes();
    } catch (error) {
        showError('모델 목록을 불러오는데 실패했습니다.');
        console.error('Error loading models:', error);
    }
}

// 모델 체크박스 렌더링
function renderModelCheckboxes() {
    modelCheckboxesContainer.innerHTML = models.map((model, index) => `
        <label class="model-checkbox selected" data-model="${model.name}">
            <input type="checkbox" name="model" value="${model.name}" checked>
            <span class="checkbox-custom">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d0d0d" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </span>
            <span class="model-info">
                <span class="model-name">${model.name}</span>
                <span class="model-dimension">Dimension: ${model.dimension}</span>
            </span>
        </label>
    `).join('');

    // 체크박스 이벤트 리스너 추가
    document.querySelectorAll('.model-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', (e) => {
            const input = checkbox.querySelector('input');
            input.checked = !input.checked;
            checkbox.classList.toggle('selected', input.checked);
        });
    });
}

// 문장 입력 필드 추가
function addSentenceInput() {
    sentenceCount++;
    const wrapper = document.createElement('div');
    wrapper.className = 'sentence-input-wrapper';
    wrapper.dataset.index = sentenceCount;
    
    wrapper.innerHTML = `
        <span class="sentence-label">문장 ${sentenceCount}</span>
        <input 
            type="text" 
            class="sentence-input" 
            placeholder="비교할 문장을 입력하세요..."
            data-index="${sentenceCount}"
        >
        <button type="button" class="btn-remove" title="삭제">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    
    sentenceInputsContainer.appendChild(wrapper);
    
    // 삭제 버튼 이벤트
    wrapper.querySelector('.btn-remove').addEventListener('click', () => {
        removeSentenceInput(wrapper);
    });
    
    // 새로 추가된 입력 필드에 포커스
    wrapper.querySelector('.sentence-input').focus();
}

// 문장 입력 필드 삭제
function removeSentenceInput(wrapper) {
    const inputs = sentenceInputsContainer.querySelectorAll('.sentence-input-wrapper');
    
    if (inputs.length <= 2) {
        showError('최소 2개의 문장이 필요합니다.');
        return;
    }
    
    wrapper.remove();
    updateSentenceLabels();
}

// 문장 라벨 업데이트
function updateSentenceLabels() {
    const wrappers = sentenceInputsContainer.querySelectorAll('.sentence-input-wrapper');
    wrappers.forEach((wrapper, index) => {
        const label = wrapper.querySelector('.sentence-label');
        const input = wrapper.querySelector('.sentence-input');
        label.textContent = `문장 ${index + 1}`;
        input.dataset.index = index + 1;
    });
    sentenceCount = wrappers.length;
}

// 이벤트 리스너 설정
function setupEventListeners() {
    addSentenceBtn.addEventListener('click', addSentenceInput);
    executeBtn.addEventListener('click', executeComparison);
}

// 유사도 비교 실행
async function executeComparison() {
    // 선택된 모델 수집
    const selectedModels = Array.from(document.querySelectorAll('.model-checkbox.selected input'))
        .map(input => input.value);
    
    // 입력된 문장 수집
    const sentences = Array.from(document.querySelectorAll('.sentence-input'))
        .map(input => input.value.trim());
    
    // Validation
    if (selectedModels.length === 0) {
        showError('최소 1개 이상의 모델을 선택해주세요.');
        return;
    }
    
    if (sentences.length < 2) {
        showError('최소 2개 이상의 문장이 필요합니다.');
        return;
    }
    
    const emptyIndex = sentences.findIndex(s => !s);
    if (emptyIndex !== -1) {
        showError(`문장 ${emptyIndex + 1}이(가) 비어있습니다.`);
        document.querySelectorAll('.sentence-input')[emptyIndex].focus();
        return;
    }
    
    // 로딩 상태
    setLoading(true);
    
    try {
        const response = await fetch('/api/embedding/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sentences: sentences,
                models: selectedModels
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || '분석 중 오류가 발생했습니다.');
        }
        
        const data = await response.json();
        renderResults(data);
        
    } catch (error) {
        showError(error.message);
        console.error('Error:', error);
    } finally {
        setLoading(false);
    }
}

// 결과 렌더링
function renderResults(data) {
    resultsSection.style.display = 'block';
    
    resultsContainer.innerHTML = data.results.map(result => `
        <div class="result-card">
            <div class="result-header">
                <span class="result-model-name">${result.model_name}</span>
                <span class="result-dimension">Dimension: ${result.dimension}</span>
            </div>
            
            <div class="similarity-table-wrapper">
                <h3 style="font-size: 0.95rem; color: var(--color-text-primary); margin-bottom: 0.75rem; font-weight: 500;">코사인 유사도 (Cosine Similarity)</h3>
                ${renderSimilarityTable(result.cosine_similarity, data.sentences, 'cosine')}
            </div>
            
            <div class="similarity-table-wrapper" style="margin-top: 1.5rem;">
                <h3 style="font-size: 0.95rem; color: var(--color-text-primary); margin-bottom: 0.75rem; font-weight: 500;">유클리디언 거리 (Euclidean Distance)</h3>
                ${renderSimilarityTable(result.normalized_euclidean_distance, data.sentences, 'normalized_euclidean')}
            </div>
        </div>
    `).join('');
    
    // 결과 섹션으로 스크롤
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 유사도 테이블 렌더링
function renderSimilarityTable(matrix, sentences, metricType) {
    const truncate = (str, maxLen = 30) => {
        return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    };
    
    const getSimilarityClass = (value, i, j, metricType) => {
        if (i === j) return 'diagonal';
        
        if (metricType === 'cosine') {
            // 코사인 유사도: 높을수록 유사 (0~1)
            if (value >= 0.8) return 'high-similarity';
            if (value >= 0.5) return 'medium-similarity';
            return 'low-similarity';
        } else {
            // 유클리디언 거리: 낮을수록 유사 (정규화된 경우 0~2 범위)
            if (value <= 0.5) return 'high-similarity';
            if (value <= 1.0) return 'medium-similarity';
            return 'low-similarity';
        }
    };
    
    let html = '<table class="similarity-table">';
    
    // 헤더
    html += '<thead><tr><th></th>';
    sentences.forEach((s, i) => {
        html += `<th class="sentence-header" title="${escapeHtml(s)}">문장 ${i + 1}</th>`;
    });
    html += '</tr></thead>';
    
    // 바디
    html += '<tbody>';
    matrix.forEach((row, i) => {
        html += `<tr><th class="sentence-header" title="${escapeHtml(sentences[i])}">문장 ${i + 1}</th>`;
        row.forEach((value, j) => {
            const similarityClass = getSimilarityClass(value, i, j, metricType);
            html += `<td class="${similarityClass}">${value.toFixed(4)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody>';
    
    html += '</table>';
    
    // 문장 목록은 첫 번째 테이블에만 추가
    if (metricType === 'cosine') {
        html += '<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border);">';
        html += '<div style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 0.5rem;">입력 문장:</div>';
        sentences.forEach((s, i) => {
            html += `<div style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">
                <span style="color: var(--color-accent);">문장 ${i + 1}:</span> ${escapeHtml(s)}
            </div>`;
        });
        html += '</div>';
    }
    
    return html;
}

// 로딩 상태 설정
function setLoading(loading) {
    executeBtn.disabled = loading;
    const btnText = executeBtn.querySelector('.btn-text');
    const btnLoading = executeBtn.querySelector('.btn-loading');
    
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
    } else {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// 에러 토스트 표시
function showError(message) {
    errorMessage.textContent = message;
    errorToast.style.display = 'block';
    
    setTimeout(() => {
        errorToast.style.display = 'none';
    }, 4000);
}

// HTML 이스케이프
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initialize);

