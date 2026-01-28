// ============================================================
// --- 1. KHỞI TẠO BIẾN & SỰ KIỆN CHÍNH ---
// ============================================================
const chat = document.getElementById('chat');
const content = chat.querySelector('.content');
const label = chat.querySelector('span');

let isChatLoaded = false;
let isDeleting = false;

// Sự kiện Click Chat
chat.addEventListener('click', (e) => {
    e.stopPropagation();

    if (!chat.classList.contains('active')) {
        chat.classList.add('active');
        if (content) content.style.display = 'block';
        if (label) label.style.display = 'none';
    }

    if (!isChatLoaded) {
        isChatLoaded = true;
        loadChatData();
    }
});

async function loadChatData() {
    toggleLoading(true, "Đang kết nối...");
    try {
        setupRealtimeSubscription();
        await fetchMessages();
    } catch (error) {
        console.error("Lỗi tải chat:", error);
        showToast("Không thể kết nối server!");
    } finally {
        toggleLoading(false);
    }
}

document.addEventListener('click', () => {
    if (chat.classList.contains('active')) {
        chat.classList.remove('active');
        if (content) content.style.display = 'none';
        if (label) label.style.display = 'block';
    }
});


// ============================================================
// --- 2. UI HELPERS ---
// ============================================================
function createBoxShadows(count, maxX, maxY) {
    let shadows = [];
    for (let i = 0; i < count; i++) {
        const x = Math.floor(Math.random() * maxX);
        const y = Math.floor(Math.random() * maxY);
        shadows.push(`${x}px ${y}px #FFF`);
    }
    return shadows.join(', ');
}


const toastEl = document.getElementById('toast-container');
const loadEl = document.getElementById('loading-overlay');
const loadTextEl = document.getElementById('loading-text');
const cancelBtn = document.getElementById('cancel-btn');

function showToast(msg) {
    if (toastEl) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 2000);
    }
}

function toggleLoading(show, message = "Loading...") {
    if (!loadEl) return;
    if (show) {
        if (loadTextEl) loadTextEl.textContent = message;
        loadEl.classList.add('active');
    } else {
        loadEl.classList.remove('active');
        currentAbortController = null;
    }
}

// ============================================================
// --- 3. CONFIG & SUPABASE ---
// ============================================================
const SUPABASE_URL = 'https://hnvyjvscusmypuhmjthv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudnlqdnNjdXNteXB1aG1qdGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDI5OTYsImV4cCI6MjA4MTIxODk5Nn0.EVJGD4WwWGdQJ5adYSOG7Tx5pAP3zOTXzSZdrXwBCGk';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CHUNK_SIZE = 48 * 1024 * 1024;
let currentAbortController = null;
let isUploadCancelled = false;

function getFileIconSVG(fileName) {
    const ext = fileName ? fileName.split('.').pop().toLowerCase() : '';
    let iconName = 'default';
    const iconMap = {
        'html': 'html', 'css': 'css', 'js': 'js', 'json': 'json', 'xml': 'xml',
        'doc': 'doc', 'docx': 'doc', 'txt': 'txt', 'pdf': 'pdf',
        'xls': 'xlsx', 'xlsx': 'xlsx', 'csv': 'csv',
        'ppt': 'pptx', 'pptx': 'pptx',
        'zip': 'zip', 'rar': 'rar', '7z': '7z', 'apk': 'apk', 'exe': 'exe',
        'jpg': 'jpg', 'jpeg': 'jpeg', 'heic': 'heic', 'png': 'png', 'gif': 'gif',
        'webp': 'webp', 'avif': 'avif', 'svg': 'svg', 'mp4': 'mp4', 'mov': 'mov',
        'mp3': 'mp3', 'wav': 'wav', 'm4a': 'm4a'
    };
    if (iconMap.hasOwnProperty(ext)) iconName = iconMap[ext];
    return `<img src="assets/svg/${iconName}.svg" class="svg-icon" alt="${ext}" loading="lazy">`;
}

function isJsonString(str) {
    try {
        const o = JSON.parse(str);
        if (o && typeof o === "object" && Array.isArray(o)) return o;
    } catch (e) { }
    return false;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateFileName(name, maxLength = 20) {
    if (!name) return '';
    if (name.length <= maxLength) return name;
    const ext = name.slice(-4);
    const namePart = name.slice(0, maxLength);
    return `${namePart}...${ext}`;
}

function escapeHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""; }


// ============================================================
// --- 4. CORE: FETCH, RENDER & SCROLL ---
// ============================================================

function setupRealtimeSubscription() {
    _supabase.channel('public:messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchMessages())
        .subscribe();
}

async function fetchMessages() {
    const { data, error } = await _supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (!error) {
        renderList(data || []);
    }
}

function renderList(items) {
    const listDiv = document.getElementById('messageList');
    if (!listDiv) return;

    const previousScrollTop = listDiv.scrollTop;
    listDiv.innerHTML = "";

    items.forEach(item => {
        let contentHTML = "";
        const safeFileName = (item.file_name || '').replace(/'/g, "\\'");
        const safeRawData = (item.file_url || '').replace(/'/g, "&apos;").replace(/"/g, "&quot;");
        const displayFileName = truncateFileName(item.file_name);

        if (item.type === 'text') {
            // SỬA: Sử dụng thư viện marked để render Markdown sang HTML
            const renderedMarkdown = typeof marked !== 'undefined' ? marked.parse(item.content) : escapeHtml(item.content);
            contentHTML = `<div class="text-content markdown-body" style="word-break: break-word;">${renderedMarkdown}</div>`;
        } else {
            const ext = item.file_name ? item.file_name.split('.').pop().toLowerCase() : '';
            const isChunked = isJsonString(item.file_url);
            if (!isChunked && ['jpg', 'jpeg', 'heic', 'png', 'gif', 'webp', 'avif'].includes(ext)) {
                contentHTML = `<img src="${item.file_url}" class="chat-image" loading="lazy">`;
            } else if (!isChunked && ['mp4', 'mov'].includes(ext)) {
                contentHTML = `<div class="video-wrapper"><video class="chat-video" controls><source src="${item.file_url}"></video></div>`;
            } else {
                contentHTML = `
                    <div class="chat-file">
                        <div class="file-icon">${getFileIconSVG(item.file_name)}</div>
                        <div class="file-info">
                            <span class="file-name" title="${escapeHtml(item.file_name)}">${escapeHtml(displayFileName)}</span>
                            <span class="file-size">${item.file_size}</span>
                        </div>
                    </div>`;
            }
        }
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message-box';
        msgDiv.innerHTML = `
            <div class="msg-click-area" onclick="handleBoxClick(this.parentElement, '${item.type}', '${safeRawData}', '${safeFileName}')">
                ${contentHTML}
            </div>
            <button class="delete-btn" onclick="deleteItem(${item.id}, '${item.type}', '${safeFileName}', '${safeRawData}')">×</button>
        `;
        listDiv.appendChild(msgDiv);
    });

    if (isDeleting) {
        listDiv.scrollTop = previousScrollTop;
        isDeleting = false;
    } else {
        const images = Array.from(listDiv.querySelectorAll('img.chat-image'));
        const imagePromises = images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        });
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 800));
        Promise.race([Promise.all(imagePromises), timeoutPromise]).then(() => {
            listDiv.scrollTop = listDiv.scrollHeight;
        });
    }
}


// ============================================================
// --- 5. ACTION HANDLERS ---
// ============================================================

// SỬA HÀM COPY: Copy dưới dạng HTML để dán vào Word có định dạng
window.handleCopy = async (element) => {
    const textDiv = element.querySelector('.text-content');
    if (!textDiv) return;

    const htmlContent = textDiv.innerHTML;
    const plainText = textDiv.innerText;

    try {
        // Tạo Blob cho HTML và Plain Text
        const blobHtml = new Blob([htmlContent], { type: "text/html" });
        const blobText = new Blob([plainText], { type: "text/plain" });

        // Sử dụng Clipboard API hiện đại
        const data = [new ClipboardItem({
            "text/html": blobHtml,
            "text/plain": blobText
        })];

        await navigator.clipboard.write(data);
        
        showToast("Đã sao chép định dạng!");
        element.style.backgroundColor = "#d1fae5";
        setTimeout(() => element.style.backgroundColor = "", 300);
    } catch (err) {
        console.error("Lỗi copy định dạng:", err);
        // Fallback về copy text thuần nếu trình duyệt không hỗ trợ ClipboardItem HTML
        navigator.clipboard.writeText(plainText).then(() => {
            showToast("Đã sao chép text!");
        });
    }
}

// Xử lý dán ảnh
const textInputEl = document.getElementById('textInput');
if (textInputEl) {
    textInputEl.addEventListener('paste', (e) => {
        const items = (e.clipboardData || window.clipboardData).items;
        const filesToUpload = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const ext = blob.type.split('/')[1] || 'png';
                    const newFileName = `pasted_image_${Date.now()}.${ext}`;
                    const file = new File([blob], newFileName, { type: blob.type });
                    filesToUpload.push(file);
                }
            }
        }
        if (filesToUpload.length > 0) {
            e.preventDefault();
            processUploadQueue(filesToUpload);
        }
    });
}

// Download
window.handleDownload = async (urlOrData, fileName) => {
    if (typeof streamSaver === 'undefined') { alert("Thiếu thư viện StreamSaver!"); return; }
    toggleLoading(true, "Starting download...");
    currentAbortController = new AbortController();
    try {
        const chunkUrls = isJsonString(urlOrData);
        const fileStream = streamSaver.createWriteStream(fileName);
        const writer = fileStream.getWriter();
        if (chunkUrls) {
            const total = chunkUrls.length;
            for (let i = 0; i < total; i++) {
                if (currentAbortController.signal.aborted) { writer.abort(); throw new Error('AbortError'); }
                if (loadTextEl) loadTextEl.textContent = `Saving part ${i + 1}/${total}...`;
                const response = await fetch(chunkUrls[i], { signal: currentAbortController.signal });
                if (!response.ok) throw new Error(`Lỗi tải part ${i}`);
                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    await writer.write(value);
                }
            }
        } else {
            const response = await fetch(urlOrData, { signal: currentAbortController.signal });
            if (!response.ok) throw new Error('Network error');
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                await writer.write(value);
            }
        }
        writer.close();
        showToast("Tải xuống hoàn tất!");
    } catch (e) {
        if (e.name !== 'AbortError') showToast("Lỗi tải xuống!");
    } finally { toggleLoading(false); }
}

window.handleBoxClick = (boxElement, type, url, fileName) => {
    if (type === 'text') window.handleCopy(boxElement);
    else window.handleDownload(url, fileName);
}

// Upload & Send
window.handleInputFiles = (inputElement) => {
    if (inputElement.files && inputElement.files.length > 0) processUploadQueue(inputElement.files);
}

async function processUploadQueue(files) {
    isUploadCancelled = false;
    for (let i = 0; i < files.length; i++) {
        if (isUploadCancelled) break;
        const file = files[i];
        toggleLoading(true, `Uploading ${file.name}...`);
        await uploadSingleFile(file);
    }
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = "";
    toggleLoading(false);
}

async function uploadSingleFile(file) {
    try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const timestamp = Date.now();
        let finalUrlData = "";
        if (file.size <= CHUNK_SIZE) {
            const fileName = timestamp + "_" + cleanName;
            const { error: upErr } = await _supabase.storage.from('uploads').upload(fileName, file);
            if (isUploadCancelled) return;
            if (upErr) throw upErr;
            const { data } = _supabase.storage.from('uploads').getPublicUrl(fileName);
            finalUrlData = data.publicUrl;
        } else {
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
            const chunkUrls = [];
            for (let i = 0; i < totalChunks; i++) {
                if (isUploadCancelled) break;
                const chunkBlob = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size));
                const chunkName = `${timestamp}_${cleanName}_part_${i}`;
                const { error: chunkErr } = await _supabase.storage.from('uploads').upload(chunkName, chunkBlob);
                if (chunkErr) throw chunkErr;
                const { data } = _supabase.storage.from('uploads').getPublicUrl(chunkName);
                chunkUrls.push(data.publicUrl);
            }
            finalUrlData = JSON.stringify(chunkUrls);
        }
        if (isUploadCancelled) return;
        await _supabase.from('messages').insert([{
            type: 'file',
            file_name: file.name,
            file_size: formatFileSize(file.size),
            file_url: finalUrlData
        }]);
    } catch (err) {
        if (!isUploadCancelled) showToast("Lỗi upload: " + file.name);
    }
}

async function sendText() {
    const input = document.getElementById('textInput');
    const val = input.value.trim();
    if (!val) return;
    input.value = "";
    await _supabase.from('messages').insert([{ content: val, type: 'text' }]);
    input.style.height = 'auto';
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

function handleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendText();
    }
}

window.deleteItem = async (id, type, fileName, rawUrlData) => {
    isDeleting = true;
    await _supabase.from('messages').delete().eq('id', id);
    if (type === 'file') {
        const chunkList = isJsonString(rawUrlData);
        if (chunkList) {
            await _supabase.storage.from('uploads').remove(chunkList.map(url => url.split('/').pop()));
        } else if (rawUrlData.startsWith('http')) {
            await _supabase.storage.from('uploads').remove([rawUrlData.split('/').pop()]);
        }
    }
}