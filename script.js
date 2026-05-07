// ================= UTILITIES & ZERO-LAG OPTIMIZATIONS =================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ================= GLOBAL SETUP & DB =================
let isLightMode = localStorage.getItem('ace_workspace_theme') === 'light';
if (isLightMode) document.body.classList.add('light-mode');

const DB_NAME = 'AceWorkspaceDB';
const STORE_NAME = 'imageHistory';
let db;

// IndexedDB Initialization
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => { db = e.target.result; resolve(); };
        request.onerror = (e) => { console.error("IndexedDB Error", e); reject(); };
    });
}

function updateLordiconColors() {
    const icons = document.querySelectorAll('.themed-icon');
    const colorStr = isLightMode ? 'primary:#121212,secondary:#5539CC' : 'primary:#ffffff,secondary:#7A5FFF';
    icons.forEach(icon => icon.setAttribute('colors', colorStr));
    
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) { themeIcon.textContent = isLightMode ? "dark_mode" : "light_mode"; }
}

function initParticles() {
    if(typeof particlesJS === 'undefined') return;
    particlesJS("particles-js", {
        particles: { number: { value: window.innerWidth > 800 ? 30 : 10, density: { enable: true, value_area: 800 } }, color: { value: isLightMode ? "#5539CC" : "#0DF8FF" }, shape: { type: "circle" }, opacity: { value: 0.3, random: true }, size: { value: 3, random: true }, line_linked: { enable: true, distance: 150, color: isLightMode ? "#5539CC" : "#5539CC", opacity: 0.15, width: 1 }, move: { enable: true, speed: 1.2, direction: "none", random: true, out_mode: "out" } },
        interactivity: { detect_on: "canvas", events: { onhover: { enable: false }, onclick: { enable: false }, resize: true } }, retina_detect: true
    });
}

function toggleTheme() {
    isLightMode = !isLightMode;
    if(isLightMode) { document.body.classList.add('light-mode'); localStorage.setItem('ace_workspace_theme', 'light'); } 
    else { document.body.classList.remove('light-mode'); localStorage.setItem('ace_workspace_theme', 'dark'); }
    updateLordiconColors(); initParticles();
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`content-${tabName}`).classList.add('active');
    sessionStorage.setItem('ace_active_tab', tabName);
}

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div"); toast.className = "toast";
    let iconName = "check_circle"; let iconColor = "var(--success)";
    if(type === "error") { iconName = "error"; iconColor = "var(--danger)"; }
    if(type === "trash") { iconName = "delete"; iconColor = "var(--danger)"; }
    toast.innerHTML = `<span class="material-symbols-rounded" style="color:${iconColor}">${iconName}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add("fade-out"); toast.addEventListener("animationend", () => toast.remove()); }, 3000);
}

function copyToClipboard(textOrId, isId = false) {
    let textToCopy = textOrId; let elem = null;
    if (isId) {
        elem = document.getElementById(textOrId); textToCopy = elem.value;
        if(textOrId.startsWith('md-')) elem.type = 'text'; 
        elem.select(); elem.setSelectionRange(0, 99999);
    }
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast("Copied to clipboard!", "success");
        if (isId && textOrId.startsWith('md-')) elem.type = 'hidden';
    });
}

function closeModal(id) {
    const modal = document.getElementById(id); modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
    if(id === 'editLinkModal') editingLinkId = null;
    if(id === 'editorModal') currentEditingItem = null;
}

function openModal(id) {
    const modal = document.getElementById(id); modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

window.onload = async () => { 
    updateLordiconColors(); initParticles(); 
    const savedTab = sessionStorage.getItem('ace_active_tab') || 'links';
    switchTab(savedTab);
    renderLinkHistory(); 
    await initDB();
    renderImageHistory(); 
};

// ================= PRO MARKDOWN EDITOR (SYNC SCROLL) =================
const mdInput = document.getElementById('mdNote');
const mdPreview = document.getElementById('mdPreviewContent');
const paneInput = document.querySelector('.md-pane.input-pane');
const panePreview = document.querySelector('.md-pane.preview-pane');

let isSyncingLeft = false; let isSyncingRight = false;

function syncScroll(source) {
    if (source === 'input') {
        if (!isSyncingLeft) {
            isSyncingRight = true;
            const percentage = paneInput.scrollTop / (paneInput.scrollHeight - paneInput.clientHeight);
            panePreview.scrollTop = percentage * (panePreview.scrollHeight - panePreview.clientHeight);
        }
        isSyncingLeft = false;
    } else {
        if (!isSyncingRight) {
            isSyncingLeft = true;
            const percentage = panePreview.scrollTop / (panePreview.scrollHeight - panePreview.clientHeight);
            paneInput.scrollTop = percentage * (paneInput.scrollHeight - paneInput.clientHeight);
        }
        isSyncingRight = false;
    }
}

const updateMDPreview = debounce(() => {
    const rawMarkdown = mdInput.value;
    if(!rawMarkdown.trim()) {
        mdPreview.innerHTML = '<div style="opacity: 0.5; font-style: italic; padding-top: 1rem;">Live preview will appear here...</div>';
        return;
    }
    mdPreview.innerHTML = DOMPurify.sanitize(marked.parse(rawMarkdown));
}, 100);

if(mdInput) {
    mdInput.addEventListener('input', updateMDPreview);
}
window.syncScroll = syncScroll;

// ================= URL SHORTENER LOGIC =================
const LINK_STORAGE = "acelink_history";
let linkHistory = JSON.parse(localStorage.getItem(LINK_STORAGE)) || [];
let currentQRUrlLink = ""; let qrInstanceLink = null; let editingLinkId = null;

function saveLinkHistory() { localStorage.setItem(LINK_STORAGE, JSON.stringify(linkHistory)); }

// Live Social Preview Fetcher (OG Tags)
const fetchLivePreview = debounce(async (url) => {
    const previewBox = document.getElementById('livePreviewContainer');
    if (!url || !/^https?:\/\//i.test(url)) { previewBox.style.display = 'none'; return; }
    
    previewBox.style.display = 'flex';
    previewBox.innerHTML = '<span class="material-symbols-rounded" style="animation: spin 1s linear infinite; color: var(--blurple-light);">sync</span> <span style="font-size: 0.9rem; color: var(--text-muted);">Fetching live preview...</span>';
    try {
        const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if(data.status === 'success' && data.data) {
            const { title, description, image } = data.data;
            previewBox.innerHTML = `
                ${image?.url ? `<img src="${image.url}" class="preview-img" decoding="async" loading="lazy">` : '<div class="preview-img" style="display:flex;align-items:center;justify-content:center;"><span class="material-symbols-rounded" style="color:#555;">link</span></div>'}
                <div class="preview-text">
                    <strong>${title || 'No Title Found'}</strong>
                    <p>${description || 'No description available.'}</p>
                </div>
            `;
        } else { previewBox.style.display = 'none'; }
    } catch (err) { previewBox.style.display = 'none'; }
}, 800);

document.getElementById('longUrl').addEventListener('input', (e) => fetchLivePreview(e.target.value.trim()));

async function shortenLink() {
    const urlInput = document.getElementById('longUrl');
    const mdInputField = document.getElementById('mdNote');
    const expireVal = document.getElementById('expireSelect').value;
    const aliasInput = document.getElementById('customAlias').value.trim();

    let originalUrl = urlInput.value.trim();
    if (!originalUrl) return showToast("Please enter a valid URL.", "error");
    if (!/^https?:\/\//i.test(originalUrl)) { originalUrl = 'https://' + originalUrl; }

    let expiresAt = null;
    if (expireVal !== 'never') {
        const date = new Date();
        if (expireVal === '24h') date.setHours(date.getHours() + 24);
        if (expireVal === '7d') date.setDate(date.getDate() + 7);
        if (expireVal === '30d') date.setDate(date.getDate() + 30);
        expiresAt = date.toISOString();
    }

    try {
        const res = await fetch('/api/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: originalUrl, note: mdInputField.value.trim(), expiresAt: expiresAt, alias: aliasInput })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        const shortUrl = data.shortUrl;
        const rawMarkdown = mdInputField.value.trim() || "*No description provided.*";
        const safeHtml = DOMPurify.sanitize(marked.parse(rawMarkdown));

        linkHistory.unshift({
            id: 'lnk_' + Date.now(),
            originalUrl, shortUrl,
            markdownRaw: rawMarkdown, htmlSafe: safeHtml,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt,
            pinned: false 
        });

        saveLinkHistory(); renderLinkHistory();
        showToast("Link shortened successfully!");
        document.getElementById('customAlias').value = '';
        document.getElementById('livePreviewContainer').style.display = 'none';
        mdInputField.value = ''; updateMDPreview(); // Clear Editor
    } catch (err) { showToast(err.message || "Failed to shorten link.", "error"); }
}

function togglePin(id) {
    const link = linkHistory.find(l => l.id === id);
    if(link) { link.pinned = !link.pinned; saveLinkHistory(); renderLinkHistory(); }
}

function deleteLink(id) {
    linkHistory = linkHistory.filter(link => link.id !== id);
    saveLinkHistory(); renderLinkHistory(); showToast("Link removed permanently.", "trash");
}

function openEditLinkModal(id) {
    const link = linkHistory.find(l => l.id === id); if(!link) return;
    editingLinkId = id;
    document.getElementById('editOriginalUrl').value = link.originalUrl;
    document.getElementById('editMdNote').value = link.markdownRaw;
    openModal('editLinkModal');
}

function saveLinkEdit() {
    if(!editingLinkId) return;
    const link = linkHistory.find(l => l.id === editingLinkId);
    if(link) {
        let newUrl = document.getElementById('editOriginalUrl').value.trim();
        if (!newUrl) return showToast("URL cannot be empty.", "error");
        if (!/^https?:\/\//i.test(newUrl)) newUrl = 'https://' + newUrl;
        
        link.originalUrl = newUrl;
        link.markdownRaw = document.getElementById('editMdNote').value.trim() || "*No description provided.*";
        saveLinkHistory(); renderLinkHistory(); showToast("Link updated successfully!", "success");
        closeModal('editLinkModal');
    }
}

function openQRLinkModal(url) { currentQRUrlLink = url; openModal('qrLinkModal'); updateQRSync(); }
function updateQRSync() {
    const size = parseInt(document.getElementById('qrSizeLink').value) || 200; const color = document.getElementById('qrColorLink').value || '#5539CC';
    if (!qrInstanceLink) qrInstanceLink = new QRious({ element: document.getElementById('qrCodeCanvasLink'), value: currentQRUrlLink, size: size, foreground: color, level: 'H' });
    else qrInstanceLink.set({ value: currentQRUrlLink, size: size, foreground: color });
}

function downloadQRLink() {
    const link = document.createElement('a'); link.download = 'AceLink-QR.png';
    link.href = document.getElementById('qrCodeCanvasLink').toDataURL('image/png'); link.click();
    showToast("QR Code downloaded!", "success"); closeModal('qrLinkModal');
}

// Zero-Lag Rendering using DocumentFragment
function renderLinkHistory() {
    const container = document.getElementById("linkHistoryList");
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;
    const searchQuery = searchInput.value.toLowerCase();

    let filteredLinks = linkHistory.filter(link => {
        return link.originalUrl.toLowerCase().includes(searchQuery) || 
               link.shortUrl.toLowerCase().includes(searchQuery) || 
               link.markdownRaw.toLowerCase().includes(searchQuery);
    });

    filteredLinks.sort((a, b) => {
        if (a.pinned === b.pinned) return new Date(b.createdAt) - new Date(a.createdAt);
        return a.pinned ? -1 : 1;
    });

    container.innerHTML = "";

    if (filteredLinks.length === 0) {
        container.innerHTML = `<div class="empty-state liquid-glass"><lord-icon src="https://cdn.lordicon.com/msoeawqm.json" trigger="loop" delay="2000" class="themed-icon" style="width:60px;height:60px;margin-bottom:15px;"></lord-icon><br>No links found.</div>`;
        updateLordiconColors(); return;
    }

    const fragment = document.createDocumentFragment();

    filteredLinks.forEach(link => {
        const card = document.createElement("div");
        card.className = `history-card liquid-glass ${link.pinned ? 'is-pinned' : ''}`;
        
        let badgeHTML = '';
        if (link.expiresAt) {
            const isExpired = new Date() > new Date(link.expiresAt);
            badgeHTML = isExpired ? `<span class="badge expired" title="Expired on ${new Date(link.expiresAt).toLocaleDateString()}">Expired</span>` 
                                  : `<span class="badge active" title="Expires on ${new Date(link.expiresAt).toLocaleDateString()}">Active</span>`;
        } else { badgeHTML = `<span class="badge active">Permanent</span>`; }

        const thumbnailUrl = `https://image.thum.io/get/width/600/crop/800/${link.originalUrl}`;
        const safeMarkdownHTML = DOMPurify.sanitize(marked.parse(link.markdownRaw));

        card.innerHTML = `
            <div class="link-thumbnail">
                ${badgeHTML}
                <img src="${thumbnailUrl}" alt="Thumbnail preview" decoding="async" loading="lazy" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100%\\' height=\\'100%\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'rgba(255,255,255,0.05)\\'/></svg>'">
            </div>
            <div class="history-content">
                <a href="${link.originalUrl}" target="_blank" rel="noopener noreferrer" class="short-url">${link.shortUrl}</a>
                <div class="original-url">${link.originalUrl}</div>
                <div class="card-actions">
                    <button class="btn-action" onclick="copyToClipboard('${link.shortUrl}')"><span class="material-symbols-rounded">content_copy</span> Copy</button>
                    <button class="btn-action" onclick="openEditLinkModal('${link.id}')"><span class="material-symbols-rounded">edit</span> Edit</button>
                    <button class="btn-action" onclick="openQRLinkModal('${link.shortUrl}')"><span class="material-symbols-rounded">qr_code_2</span> QR Code</button>
                    <button class="btn-action" onclick="togglePin('${link.id}')" title="${link.pinned ? 'Unpin' : 'Pin to top'}"><span class="material-symbols-rounded" style="color: ${link.pinned ? 'var(--blurple-light)' : 'inherit'}">${link.pinned ? 'star' : 'star_border'}</span> ${link.pinned ? 'Pinned' : 'Pin'}</button>
                    <button class="btn-action btn-delete" onclick="deleteLink('${link.id}')"><span class="material-symbols-rounded">delete</span> Delete</button>
                </div>
                <div class="markdown-content">${safeMarkdownHTML}</div>
            </div>
        `;
        fragment.appendChild(card);
    });
    
    container.appendChild(fragment); 
    updateLordiconColors(); 
}

const searchInputElem = document.getElementById("searchInput");
if(searchInputElem) { searchInputElem.addEventListener('input', debounce(renderLinkHistory, 250)); }

// ================= IMAGE HOST & EDITOR LOGIC =================
const CLOUD_NAME = 'dvzzebkww'; const UPLOAD_PRESET = 'linkshare_unsigned';
const dropzone = document.getElementById('dropzone'); const fileInput = document.getElementById('fileInput'); const imageQueueContainer = document.getElementById('imageQueueContainer');

let currentEditingItem = null; let originalImageObj = new Image(); let currentImageObj = new Image(); 
let isDrawingCrop = false, cropModeActive = false; let cropStart = {x: 0, y: 0}, cropRect = {x: 0, y: 0, w: 0, h: 0};
const canvas = document.getElementById('editCanvas'); const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvasContainer'); const cropBox = document.getElementById('cropBox');

if (dropzone) {
    dropzone.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropzone.addEventListener(e, prev, false));
    function prev(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover'].forEach(e => dropzone.addEventListener(e, () => dropzone.classList.add('dragover'), false));
    ['dragleave', 'drop'].forEach(e => dropzone.addEventListener(e, () => dropzone.classList.remove('dragover'), false));
    dropzone.addEventListener('drop', e => processImageFiles(e.dataTransfer.files), false);
    fileInput.addEventListener('change', e => processImageFiles(e.target.files), false);
}

function compressImage(file, maxWidth = 1920, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                tempCanvas.width = width; tempCanvas.height = height;
                const tCtx = tempCanvas.getContext('2d');
                tCtx.drawImage(img, 0, 0, width, height);
                const format = file.type === 'image/png' ? 'image/png' : 'image/webp';
                const compQuality = format === 'image/png' ? undefined : quality;
                resolve(tempCanvas.toDataURL(format, compQuality));
            }
        }
    });
}

async function processImageFiles(files) {
    for (let file of [...files]) {
        if(!file.type.startsWith('image/')) { showToast('Only images are allowed.', 'error'); continue; }
        const compressedDataUrl = await compressImage(file);
        createImageQueueItem(file.name, compressedDataUrl, true);
    }
    fileInput.value = '';
}

async function createImageQueueItem(name, b64Data, isNew = false, cloudUrl = null, passedId = null) {
    const itemId = passedId || 'img-' + Math.random().toString(36).substr(2, 9);
    const viewUrl = cloudUrl || b64Data; const safeName = name.replace(/"/g, '&quot;');
    const itemHTML = `
        <div class="queue-item liquid-glass" id="${itemId}">
            <img src="${b64Data}" class="item-preview" id="thumb-${itemId}" decoding="async" loading="lazy">
            <div class="item-header">
                <input type="text" class="name-input" id="name-${itemId}" value="${safeName}" title="Click to rename" onchange="renameImageFile('${itemId}')">
                <span class="item-status" style="color: ${isNew ? 'var(--solid-cyan)' : 'var(--success)'}; font-size: 0.75rem; font-weight:800;">${isNew ? 'UPLOADING...' : 'ONLINE'}</span>
            </div>
            ${isNew ? `<div class="progress-track" id="track-${itemId}"><div class="progress-fill" id="fill-${itemId}"></div></div>` : ''}
            <div class="links-container ${isNew ? '' : 'active'}" id="links-${itemId}">
                <div class="link-group">
                    <input type="text" id="direct-${itemId}" value="${viewUrl}" readonly>
                    <button class="btn-action" onclick="copyToClipboard('direct-${itemId}', true)"><span class="material-symbols-rounded">content_copy</span></button>
                </div>
                <input type="hidden" id="md-${itemId}" value="![${safeName}](${viewUrl})">
                <div class="action-bar">
                    <button class="btn-action" onclick="copyToClipboard('md-${itemId}', true)"><span class="material-symbols-rounded">data_object</span> MD</button>
                    <button class="btn-action" onclick="openImageEditor('${itemId}')"><span class="material-symbols-rounded">palette</span> EDIT</button>
                    <button class="btn-action" onclick="showImageQR('${itemId}')"><span class="material-symbols-rounded">qr_code_2</span> QR</button>
                    <button class="btn-action" onclick="shareImageLink('${itemId}')"><span class="material-symbols-rounded">share</span> SHARE</button>
                </div>
            </div>
        </div>
    `;
    isNew ? imageQueueContainer.insertAdjacentHTML('afterbegin', itemHTML) : imageQueueContainer.insertAdjacentHTML('beforeend', itemHTML);
    document.getElementById(itemId).dataset.filename = name; document.getElementById(itemId).dataset.b64 = b64Data;
    if(cloudUrl) document.getElementById(itemId).dataset.cloud = cloudUrl;
    if(isNew) handleImageUpload(itemId, name, b64Data);
}

function renameImageFile(itemId) {
    const newName = document.getElementById(`name-${itemId}`).value; const item = document.getElementById(itemId);
    item.dataset.filename = newName; const url = document.getElementById(`direct-${itemId}`).value;
    document.getElementById(`md-${itemId}`).value = `![${newName}](${url})`;
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(itemId);
    request.onsuccess = (e) => {
        const record = e.target.result;
        if(record) { record.name = newName; store.put(record); }
    };
    showToast("Renamed successfully.");
}

async function handleImageUpload(itemId, name, b64Data) {
    const track = document.getElementById(`track-${itemId}`); const fill = document.getElementById(`fill-${itemId}`);
    const status = document.querySelector(`#${itemId} .item-status`);
    fill.style.width = '50%'; let finalUrl = null;

    try {
        const blob = await (await fetch(b64Data)).blob();
        const formData = new FormData(); formData.append('file', blob); formData.append('upload_preset', UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok || !data.secure_url) throw new Error(data.error?.message || 'Upload failed');
        
        finalUrl = data.secure_url; fill.style.width = '80%';
        status.textContent = 'SHORTENING...'; status.style.color = 'var(--blurple-light)';

        try {
            const shortRes = await fetch('/api/shorten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: finalUrl, note: `Image Upload: ${name}` }) });
            const shortData = await shortRes.json();
            if (shortRes.ok && shortData.shortUrl) {
                finalUrl = shortData.shortUrl;
                linkHistory.unshift({ id: 'lnk_' + Date.now(), originalUrl: data.secure_url, shortUrl: finalUrl, markdownRaw: `Image Upload: ${name}`, htmlSafe: DOMPurify.sanitize(marked.parse(`Image Upload: ${name}`)), createdAt: new Date().toISOString(), expiresAt: null, pinned: false });
                saveLinkHistory(); renderLinkHistory();
            }
        } catch(shortErr) { console.warn("Auto-shorten fallback to origin URL.", shortErr); }

        status.textContent = 'ONLINE'; status.style.color = 'var(--success)';
        document.getElementById(`direct-${itemId}`).value = finalUrl;
        document.getElementById(`md-${itemId}`).value = `![${name}](${finalUrl})`;
        document.getElementById(itemId).dataset.cloud = finalUrl;
    } catch(err) {
        console.error(err); status.textContent = 'LOCAL ONLY'; status.style.color = 'var(--danger)'; showToast("Cloud upload failed. Saved locally.", "error");
    }
    fill.style.width = '100%';
    setTimeout(() => { track.style.display = 'none'; document.getElementById(`links-${itemId}`).classList.add('active'); saveToImageHistory(itemId, name, b64Data, finalUrl); }, 400);
}

function shareImageLink(itemId) {
    const url = document.getElementById(`direct-${itemId}`).value; const name = document.getElementById(itemId).dataset.filename;
    if (navigator.share) { navigator.share({ title: name, text: 'Check out this image on Ace Workspace', url: url }).catch(console.error); } 
    else { copyToClipboard(`direct-${itemId}`, true); showToast('Link copied! Web Share not supported on this device.'); }
}

let qrImageObj = null;
function showImageQR(itemId) {
    const url = document.getElementById(`direct-${itemId}`).value; document.getElementById('qrcodeImage').innerHTML = ''; 
    qrImageObj = new QRCode(document.getElementById("qrcodeImage"), { text: url, width: 200, height: 200, colorDark : "#5539CC", colorLight : "#ffffff" });
    openModal('qrImageModal');
}

function saveToImageHistory(id, name, b64Data, cloudUrl = null) {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const record = { id, name, b64Data, cloudUrl, date: Date.now() };
    store.put(record);
}

function renderImageHistory() {
    imageQueueContainer.innerHTML = '';
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = (e) => {
        let items = e.target.result;
        items.sort((a, b) => b.date - a.date);
        items.forEach(i => createImageQueueItem(i.name, i.b64Data, false, i.cloudUrl, i.id));
    };
}

function clearImageHistory() { 
    if(confirm('Clear all uploaded images from local cache?')) { 
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        imageQueueContainer.innerHTML = ''; 
        showToast("Image cache cleared.", "trash");
    } 
}

// --- PRO Image Editor ---
const inW = document.getElementById('editW'); const inH = document.getElementById('editH'); const unW = document.getElementById('unitW'); const unH = document.getElementById('unitH'); const lockRatio = document.getElementById('lockRatio'); let originalRatio = 1;

function openImageEditor(itemId) {
    const item = document.getElementById(itemId); currentEditingItem = itemId;
    document.getElementById('editZoom').value = 1; document.getElementById('zoomVal').innerText = '1.0x'; document.getElementById('editFilter').value = 'none'; document.getElementById('editRotate').value = '0'; document.getElementById('editFlip').value = 'none'; resetEditorCrop();
    originalImageObj.onload = () => { currentImageObj.src = originalImageObj.src; originalRatio = originalImageObj.width / originalImageObj.height; inW.value = originalImageObj.width; unW.value = 'px'; inH.value = originalImageObj.height; unH.value = 'px'; drawEditorCanvas(); openModal('editorModal'); };
    originalImageObj.src = item.dataset.b64;
}

function calcDim(val, unit, isWidth) { if(unit === 'px') return parseFloat(val); const base = isWidth ? originalImageObj.width : originalImageObj.height; return base * (parseFloat(val) / 100); }

const syncDimensions = debounce((source) => {
    const wVal = parseFloat(inW.value) || 0; const hVal = parseFloat(inH.value) || 0;
    if(lockRatio.checked) {
        if(source === 'w') { const actualW = calcDim(wVal, unW.value, true); const newH = actualW / originalRatio; inH.value = unH.value === 'px' ? Math.round(newH) : Math.round((newH / originalImageObj.height) * 100); } 
        else { const actualH = calcDim(hVal, unH.value, false); const newW = actualH * originalRatio; inW.value = unW.value === 'px' ? Math.round(newW) : Math.round((newW / originalImageObj.width) * 100); }
    } 
    requestAnimationFrame(drawEditorCanvas);
}, 50);

if(inW) inW.addEventListener('input', () => syncDimensions('w')); if(inH) inH.addEventListener('input', () => syncDimensions('h')); if(unW) unW.addEventListener('change', () => syncDimensions('w')); if(unH) unH.addEventListener('change', () => syncDimensions('h'));
if (document.getElementById('editZoom')) {
    document.getElementById('editZoom').addEventListener('input', (e) => { document.getElementById('zoomVal').innerText = parseFloat(e.target.value).toFixed(1) + 'x'; requestAnimationFrame(drawEditorCanvas); });
    document.getElementById('editFilter').addEventListener('change', () => requestAnimationFrame(drawEditorCanvas)); 
    document.getElementById('editRotate').addEventListener('change', () => requestAnimationFrame(drawEditorCanvas)); 
    document.getElementById('editFlip').addEventListener('change', () => requestAnimationFrame(drawEditorCanvas));
}

function drawEditorCanvas() {
    let w = calcDim(inW.value, unW.value, true); let h = calcDim(inH.value, unH.value, false);
    const zoom = parseFloat(document.getElementById('editZoom').value); const rot = parseInt(document.getElementById('editRotate').value); const flip = document.getElementById('editFlip').value;
    if (rot === 90 || rot === 270) { canvas.width = h * zoom; canvas.height = w * zoom; } else { canvas.width = w * zoom; canvas.height = h * zoom; }
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rot * Math.PI / 180);
    let scaleX = 1, scaleY = 1; if(flip === 'h') scaleX = -1; if(flip === 'v') scaleY = -1; ctx.scale(scaleX, scaleY);
    ctx.filter = document.getElementById('editFilter').value; ctx.drawImage(currentImageObj, -(w * zoom)/2, -(h * zoom)/2, w * zoom, h * zoom); ctx.restore();
}

const btnDrawCrop = document.getElementById('btnDrawCrop'); const btnApplyCrop = document.getElementById('btnApplyCrop');
if(btnDrawCrop) {
    btnDrawCrop.addEventListener('click', () => {
        cropModeActive = !cropModeActive;
        if(cropModeActive) { btnDrawCrop.innerHTML = `<span class="material-symbols-rounded">close</span> Cancel Crop`; btnDrawCrop.style.background = 'var(--danger)'; btnApplyCrop.style.display = 'block'; canvasContainer.style.cursor = 'crosshair'; } 
        else { resetEditorCrop(); }
    });

    canvasContainer.addEventListener('mousedown', (e) => {
        if(!cropModeActive) return;
        const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
        cropStart.x = (e.clientX - rect.left) * scaleX; cropStart.y = (e.clientY - rect.top) * scaleY; isDrawingCrop = true; cropBox.style.display = 'block';
        cropBox.style.left = (e.clientX - rect.left) + 'px'; cropBox.style.top = (e.clientY - rect.top) + 'px'; cropBox.style.width = '0px'; cropBox.style.height = '0px';
    });

    canvasContainer.addEventListener('mousemove', (e) => {
        if(!isDrawingCrop || !cropModeActive) return;
        requestAnimationFrame(() => {
            const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
            const currentX = (e.clientX - rect.left) * scaleX; const currentY = (e.clientY - rect.top) * scaleY;
            cropRect.x = Math.min(cropStart.x, currentX); cropRect.y = Math.min(cropStart.y, currentY); cropRect.w = Math.abs(currentX - cropStart.x); cropRect.h = Math.abs(currentY - cropStart.y);
            const boxX = Math.min((e.clientX - rect.left), cropStart.x / scaleX); const boxY = Math.min((e.clientY - rect.top), cropStart.y / scaleY);
            cropBox.style.left = boxX + 'px'; cropBox.style.top = boxY + 'px'; cropBox.style.width = (cropRect.w / scaleX) + 'px'; cropBox.style.height = (cropRect.h / scaleY) + 'px';
        });
    });

    window.addEventListener('mouseup', () => { isDrawingCrop = false; });

    btnApplyCrop.addEventListener('click', () => {
        if(cropRect.w === 0 || cropRect.h === 0) return showToast('Select an area first.', 'error');
        const tempCanvas = document.createElement('canvas'); tempCanvas.width = cropRect.w; tempCanvas.height = cropRect.h;
        tempCanvas.getContext('2d').drawImage(canvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h);
        currentImageObj.onload = () => { originalRatio = currentImageObj.width / currentImageObj.height; inW.value = currentImageObj.width; unW.value = 'px'; inH.value = currentImageObj.height; unH.value = 'px'; document.getElementById('editZoom').value = 1; document.getElementById('zoomVal').innerText = '1.0x'; document.getElementById('editRotate').value = '0'; document.getElementById('editFlip').value = 'none'; resetEditorCrop(); requestAnimationFrame(drawEditorCanvas); };
        currentImageObj.src = tempCanvas.toDataURL();
    });
}

function resetEditorCrop() { cropModeActive = false; isDrawingCrop = false; cropBox.style.display = 'none'; cropRect = {x:0,y:0,w:0,h:0}; btnDrawCrop.innerHTML = `<span class="material-symbols-rounded">crop</span> Select Crop Area`; btnDrawCrop.style.background = 'var(--blurple)'; btnApplyCrop.style.display = 'none'; canvasContainer.style.cursor = 'crosshair'; }

function downloadEditedImage() { const format = document.getElementById('editFormat').value; const a = document.createElement('a'); a.href = canvas.toDataURL(format); a.download = `AceEdit_${document.getElementById(currentEditingItem).dataset.filename.split('.')[0]}.${format.split('/')[1]}`; document.body.appendChild(a); a.click(); document.body.removeChild(a); }

async function saveImageEdits() {
    const b64Data = canvas.toDataURL(document.getElementById('editFormat').value); const item = document.getElementById(currentEditingItem); const name = item.dataset.filename;
    let finalUrl = b64Data; const statusNode = document.querySelector(`#${currentEditingItem} .item-status`);
    statusNode.textContent = 'UPDATING...'; statusNode.style.color = 'var(--solid-cyan)';

    try {
        const blob = await (await fetch(b64Data)).blob(); const formData = new FormData(); formData.append('file', blob); formData.append('upload_preset', UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: formData }); const data = await res.json();
        if(data.secure_url) {
            finalUrl = data.secure_url;
            try {
                const shortRes = await fetch('/api/shorten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: finalUrl, note: `Edited Image: ${name}` }) });
                const shortData = await shortRes.json();
                if(shortRes.ok && shortData.shortUrl) { finalUrl = shortData.shortUrl; linkHistory.unshift({ id: 'lnk_' + Date.now(), originalUrl: data.secure_url, shortUrl: finalUrl, markdownRaw: `Edited Image: ${name}`, htmlSafe: DOMPurify.sanitize(marked.parse(`Edited Image: ${name}`)), createdAt: new Date().toISOString(), expiresAt: null, pinned: false }); saveLinkHistory(); renderLinkHistory(); }
            } catch(e) {} 
            item.dataset.cloud = finalUrl; statusNode.textContent = 'UPDATED'; statusNode.style.color = 'var(--success)';
        } else throw new Error();
    } catch(e) { console.error(e); statusNode.textContent = 'LOCAL ONLY'; statusNode.style.color = 'var(--danger)'; showToast("Cloud update failed.", "error");}

    item.dataset.b64 = b64Data; document.getElementById(`direct-${currentEditingItem}`).value = finalUrl; document.getElementById(`md-${currentEditingItem}`).value = `![${name}](${finalUrl})`; document.getElementById(`thumb-${currentEditingItem}`).src = b64Data;
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(currentEditingItem);
    request.onsuccess = (e) => {
        const record = e.target.result;
        if(record) { record.b64Data = b64Data; record.cloudUrl = item.dataset.cloud || null; record.date = Date.now(); store.put(record); }
    };
    
    showToast("Image updated successfully!"); closeModal('editorModal');
}

window.toggleTheme = toggleTheme; window.switchTab = switchTab; window.shortenLink = shortenLink; window.deleteLink = deleteLink; window.openEditLinkModal = openEditLinkModal; window.saveLinkEdit = saveLinkEdit; window.openQRLinkModal = openQRLinkModal; window.updateQRSync = updateQRSync; window.downloadQRLink = downloadQRLink; window.renderLinkHistory = renderLinkHistory; window.clearImageHistory = clearImageHistory; window.renameImageFile = renameImageFile; window.shareImageLink = shareImageLink; window.showImageQR = showImageQR; window.openImageEditor = openImageEditor; window.downloadEditedImage = downloadEditedImage; window.saveImageEdits = saveImageEdits; window.copyToClipboard = copyToClipboard; window.closeModal = closeModal; window.togglePin = togglePin;
