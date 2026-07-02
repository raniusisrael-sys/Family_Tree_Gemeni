const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzoMYkCW56MsQv9mUw6xf-JtvzdEHS6CNttA_XIISrfHuNDeU1rMyMmxSYcXVBqX2OVLg/exec";
const SCRIPT_URL_WITH_CALLBACK = `${GAS_API_URL}?callback=renderTreeCallback`;

// ImgBB API Key
const IMGBB_API_KEY = "3fb4f97fc7eb637505877bebe9b6ba0a";

let familyDataArray = [];
let familyMembersCache = {};
let currentEditingMemberId = null;
let currentActiveDirectoryFilterTag = "all";
let globalActiveSelectedMobileNumber = ""; 

function triggerAppHapticBump() {
    if (navigator.vibrate) { navigator.vibrate(12); }
}

function toggleNativeAppDarkMode() {
    triggerAppHapticBump();
    const body = document.body;
    const btn = document.getElementById("dark-mode-toggle-btn");
    body.classList.toggle("dark-theme-mode-active");
    if(body.classList.contains("dark-theme-mode-active")) {
        btn.innerText = "☀️";
        localStorage.setItem("native_app_theme_choice", "dark");
    } else {
        btn.innerText = "🌙";
        localStorage.setItem("native_app_theme_choice", "light");
    }
}

window.previewAndVerifySelectedPhoto = function(input) {
    const statusBadge = document.getElementById("form-photo-status-badge");
    if (input.files && input.files[0]) {
        const file = input.files[0];
        statusBadge.innerText = "✅ Ready (" + (file.size / 1024).toFixed(0) + " KB)";
        statusBadge.style.color = "#00a884";
    }
};

window.executeNativePhoneCallIntent = function() {
    if(!globalActiveSelectedMobileNumber) return;
    triggerAppHapticBump();
    window.open("tel:" + globalActiveSelectedMobileNumber, "_system");
};

window.executeNativeWhatsAppIntent = function() {
    if(!globalActiveSelectedMobileNumber) return;
    triggerAppHapticBump();
    window.open("https://wa.me/" + (globalActiveSelectedMobileNumber.includes('+') ? globalActiveSelectedMobileNumber : '+91' + globalActiveSelectedMobileNumber), "_system");
};

function formatDateString(val) {
    if (!val) return "Not Provided";
    val = val.toString().trim();
    if (val.includes('T') || val.match(/^\d{4}-\d{2}-\d{2}/)) {
        try {
            const pureDatePart = val.split('T')[0]; 
            const parts = pureDatePart.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        } catch (e) { console.error(e); }
    }
    return val; 
}

function convertToInputDate(dateStr) {
    if (!dateStr || dateStr === "Not Provided") return "";
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
}

function reloadLiveFamilyData() {
    const oldScript = document.getElementById("jsonp-data-script");
    if (oldScript) oldScript.remove();

    const script = document.createElement("script");
    script.id = "jsonp-data-script";
    script.src = `${SCRIPT_URL_WITH_CALLBACK}&nocache=${new Date().getTime()}`;
    document.body.appendChild(script);
}

window.renderTreeCallback = function(rawData) {
    if (!rawData) return;
    try {
        localStorage.setItem("cached_family_tree_data", JSON.stringify(rawData));
        processFamilyArrayPacket(rawData);
    } catch (err) { console.error(err); }
};

function processFamilyArrayPacket(rawData) {
    familyDataArray = rawData.map((item, index) => {
        const keys = Object.keys(item);
        const idKey = keys.find(k => k.toLowerCase() === 'id') || keys[0];
        const nameKey = keys.find(k => k.toLowerCase().includes('name')) || keys[1];
        const genderKey = keys.find(k => k.toLowerCase().includes('gender')) || keys[2];
        const dobKey = keys.find(k => k.toLowerCase().includes('dob') || k.toLowerCase().includes('birth')) || keys[3];
        const fatherKey = keys.find(k => k.toLowerCase().includes('father')) || keys[4];
        const spouseKey = keys.find(k => k.toLowerCase().includes('spouse')) || keys[6];
        const mobileKey = keys.find(k => k.toLowerCase().includes('mobile') || k.toLowerCase().includes('phone')) || keys[7];
        const bloodKey = keys.find(k => k.toLowerCase().includes('blood')) || keys[8];
        const occupationKey = keys.find(k => k.toLowerCase().includes('occupation') || k.toLowerCase().includes('title')) || keys[9];
        const addressKey = keys.find(k => k.toLowerCase().includes('address')) || keys[10];
        const photoKey = keys.find(k => k.toLowerCase().includes('photo') || k.toLowerCase().includes('image') || k.toLowerCase().includes('url')) || keys[11];

        const clean = (val) => (val !== undefined && val !== null) ? val.toString().trim() : "";

        let rawPhoto = clean(item[photoKey]);
        if (rawPhoto.includes("drive.google.com") && !rawPhoto.includes("thumbnail")) {
            let fileId = "";
            if (rawPhoto.includes("id=")) { fileId = rawPhoto.split("id=")[1].split("&")[0]; }
            else if (rawPhoto.includes("/file/d/")) { fileId = rawPhoto.split("/file/d/")[1].split("/")[0]; }
            if (fileId) rawPhoto = `https://drive.google.com/thumbnail?sz=w500&id=${fileId}`;
        }

        return {
            id: clean(item[idKey]) || (index + 1).toString(),
            name: clean(item[nameKey]) || "Unknown Name",
            gender: clean(item[genderKey]),
            dob: formatDateString(item[dobKey]),
            fatherId: clean(item[fatherId]),
            spouseId: clean(item[spouseKey]),
            mobile: clean(item[mobileKey]) || "Not Provided",
            blood: clean(item[bloodKey]) || "Not Provided",
            title: clean(item[occupationKey]) || "Family Member",
            address: clean(item[addressKey]) || "Not Provided",
            photo: rawPhoto 
        };
    });

    familyMembersCache = {};
    familyDataArray.forEach(item => familyMembersCache[item.id] = item);

    buildTreeChartUI();
    executeDirectoryFilterUIRenderLines();
    updateFormDropdowns();
    calculateWowFamilyAnalytics();
    checkUpcomingBirthdaysEngine();
}

function calculateWowFamilyAnalytics() {
    document.getElementById("stat-total-count").innerText = familyDataArray.length;
    let males = familyDataArray.filter(m => m.gender === 'ஆண்' || m.gender.toLowerCase() === 'male').length;
    let females = familyDataArray.filter(m => m.gender === 'பெண்' || m.gender.toLowerCase() === 'female').length;
    document.getElementById("stat-male-count").innerText = males;
    document.getElementById("stat-female-count").innerText = females;

    let bloodCounts = {};
    familyDataArray.forEach(m => {
        if(m.blood && m.blood !== "Not Provided") { bloodCounts[m.blood] = (bloodCounts[m.blood] || 0) + 1; }
    });
    let topBlood = "O+";
    let max = 0;
    for(let b in bloodCounts) { if(bloodCounts[b] > max) { max = bloodCounts[b]; topBlood = b; } }
    document.getElementById("stat-top-blood").innerText = topBlood;
}

function checkUpcomingBirthdaysEngine() {
    const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');
    let bdayList = [];
    familyDataArray.forEach(m => {
        if (m.dob && m.dob.includes('/')) {
            let parts = m.dob.split('/');
            if (parts[1] === currentMonthStr) { bdayList.push(m.name); }
        }
    });
    const widget = document.getElementById("birthday-reminder-widget");
    const listElement = document.getElementById("birthday-names-list");
    if (bdayList.length > 0) {
        widget.style.display = "block";
        listElement.innerHTML = bdayList.map(name => `<div class="birthday-user-tag">🎂 ${name}</div>`).join('');
    } else { widget.style.display = "none"; }
}

window.applyDirectoryGenerationFilter = function(filterMode, element) {
    triggerAppHapticBump();
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    if(element) element.classList.add("active");
    currentActiveDirectoryFilterTag = filterMode;
    executeDirectoryFilterUIRenderLines();
};

function executeDirectoryFilterUIRenderLines() {
    const query = document.getElementById("member-search-input") ? document.getElementById("member-search-input").value.toLowerCase().trim() : "";
    let dataset = [...familyDataArray];
    if(currentActiveDirectoryFilterTag === 'ancestors') {
        dataset = dataset.filter(m => !m.fatherId || m.fatherId === "");
    } else if(currentActiveDirectoryFilterTag === 'descendants') {
        dataset = dataset.filter(m => m.fatherId && m.fatherId !== "");
    }
    if(query) {
        dataset = dataset.filter(m => m.name.toLowerCase().includes(query) || m.title.toLowerCase().includes(query));
    }
    buildDirectoryUI(dataset);
}

function updateFormDropdowns() {
    const fatherSelect = document.getElementById("form-father");
    const spouseSelect = document.getElementById("form-spouse");
    if (!fatherSelect || !spouseSelect) return;

    let fatherOptions = `<option value="">None (Top Ancestor Layer)</option>`;
    let spouseOptions = `<option value="">None (No Partner linked)</option>`;

    const sortedMembers = [...familyDataArray].sort((a, b) => a.name.localeCompare(b.name));
    sortedMembers.forEach(m => {
        fatherOptions += `<option value="${m.id}">${m.name} (ID: ${m.id})</option>`;
        spouseOptions += `<option value="${m.id}">${m.name} (ID: ${m.id})</option>`;
    });

    fatherSelect.innerHTML = fatherOptions;
    spouseSelect.innerHTML = spouseOptions;
}

function buildTreeChartUI() {
    const container = document.getElementById("html-tree-container");
    if (!container) return;

    const processedSpouseIds = new Set();
    const nodeMap = {};
    familyDataArray.forEach(item => { nodeMap[item.id] = { ...item, spouses: [], children: [] }; });
    
    familyDataArray.forEach(item => {
        if (item.spouseId && nodeMap[item.spouseId]) {
            if (!processedSpouseIds.has(item.id) && !processedSpouseIds.has(item.spouseId)) {
                nodeMap[item.id].spouses.push(nodeMap[item.spouseId]);
                processedSpouseIds.add(item.spouseId);
            }
        }
    });

    const roots = [];
    familyDataArray.forEach(item => {
        const node = nodeMap[item.id];
        if (processedSpouseIds.has(item.id) && !item.fatherId) return;
        
        if (item.fatherId && nodeMap[item.fatherId]) {
            nodeMap[item.fatherId].children.push(node);
        } else if (item.spouseId && nodeMap[item.spouseId] && nodeMap[item.spouseId].fatherId && nodeMap[nodeMap[item.spouseId].fatherId]) {
            nodeMap[nodeMap[item.spouseId].fatherId].children.push(node);
        } else { roots.push(node); }
    });

    function renderNodeBlock(node) {
        const getCardHTML = (m) => {
            const isFemale = (m.gender === 'பெண்' || m.gender.toLowerCase() === 'female');
            const avatar = m.photo || (isFemale ? 'https://cdn-icons-png.flaticon.com/512/6997/6997662.png' : 'https://cdn-icons-png.flaticon.com/512/4140/4140037.png');
            return `
                <div class="node-card ${isFemale ? 'female' : ''}" data-node-id="${m.id}" data-search-name="${m.name.toLowerCase()}" onclick="openProfileModal('${m.id}')">
                    <img src="${avatar}" alt="avatar" class="node-avatar">
                    <div class="node-info">
                        <div class="node-name">${m.name}</div>
                        <div class="node-title">${m.title}</div>
                    </div>
                </div>`;
        };

        let rowHTML = `<div class="node-couple-row">${getCardHTML(node)}`;
        node.spouses.forEach(s => rowHTML += getCardHTML(s));
        rowHTML += `</div>`;

        let html = `<li>${rowHTML}`;
        if (node.children && node.children.length > 0) {
            html += '<ul>' + node.children.map(renderNodeBlock).join('') + '</ul>';
        }
        html += '</li>';
        return html;
    }

    if (roots.length > 0) {
        container.innerHTML = `<ul>${roots.map(renderNodeBlock).join('')}</ul>`;
        setTimeout(centerTree, 150);
    }
}

function buildDirectoryUI(dataset) {
    const listContainer = document.getElementById("members-directory-list");
    if (!listContainer) return;
    listContainer.innerHTML = dataset.map(m => {
        const isFemale = (m.gender === 'பெண்' || m.gender.toLowerCase() === 'female');
        const avatar = m.photo || (isFemale ? 'https://cdn-icons-png.flaticon.com/512/6997/6997662.png' : 'https://cdn-icons-png.flaticon.com/512/4140/4140037.png');
        return `
            <div class="directory-item" onclick="openProfileModal('${m.id}')">
                <img src="${avatar}" alt="photo" class="directory-avatar">
                <div class="directory-details">
                    <div class="directory-name">${m.name}</div>
                    <div class="directory-meta">${m.title} • ID: ${m.id}</div>
                </div>
                <div class="directory-badge ${isFemale ? 'female' : ''}">${m.gender}</div>
            </div>`;
    }).join('');
}

// 🔥 POWERFUL NATIVE HIGH-SPEED UPLOAD CONVERSION ENGINE
window.submitNewMemberLocal = function() {
    triggerAppHapticBump();
    const name = document.getElementById("form-name").value.trim();
    const gender = document.getElementById("form-gender").value;
    let dob = document.getElementById("form-dob").value.trim();
    const fatherId = document.getElementById("form-father").value;
    const spouseId = document.getElementById("form-spouse").value;
    const blood = document.getElementById("form-blood").value;
    const title = document.getElementById("form-title").value.trim();
    const mobile = document.getElementById("form-mobile").value.trim();
    const address = document.getElementById("form-address").value.trim();
    let photoUrl = document.getElementById("form-photo-url-hidden").value.trim();

    if (!name) { alert("Please enter a member name!"); return; }

    const overlay = document.getElementById("loading-overlay");
    const overlayText = document.getElementById("loading-overlay-text");
    if (overlay) overlay.style.display = "flex";

    const filePicker = document.getElementById("form-photo-file-picker");
    
    [span_2](start_span)// 🔥 FIXED: Passes a raw active file blob block into multi-part form payloads[span_2](end_span)
    if (filePicker && filePicker.files && filePicker.files[0]) {
        if (overlayText) overlayText.innerText = "📸 Uploading gallery image...";
        
        let formData = new FormData();
        formData.append("image", filePicker.[span_3](start_span)files[0]); // Feeds raw file blob instantly[span_3](end_span)

        fetch("https://api.imgbb.com/1/upload?key=" + IMGBB_API_KEY, {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(json => {
            if (json && json.data && json.data.url) {
                photoUrl = json.data.[span_4](start_span)url; // Grabs verified cloud image preview string[span_4](end_span)!
            }
            sendFinalDataToGoogleCloud(name, gender, dob, fatherId, spouseId, blood, title, mobile, address, photoUrl);
        })
        .catch(e => {
            console.error("ImgBB Upload Failed:", e);
            sendFinalDataToGoogleCloud(name, gender, dob, fatherId, spouseId, blood, title, mobile, address, photoUrl);
        });
    } else {
        sendFinalDataToGoogleCloud(name, gender, dob, fatherId, spouseId, blood, title, mobile, address, photoUrl);
    }
};

function sendFinalDataToGoogleCloud(name, gender, dob, fatherId, spouseId, blood, title, mobile, address, photoUrl) {
    const overlayText = document.getElementById("loading-overlay-text");
    if (overlayText) overlayText.innerText = "☁️ Syncing lineage with Cloud...";

    if (dob.includes('-')) {
        const parts = dob.split('-');
        if (parts.length === 3) dob = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    let targetId = currentEditingMemberId ? currentEditingMemberId.toString() : "";
    let saveUrl = `${GAS_API_URL}?action=add&id=${encodeURIComponent(targetId)}&name=${encodeURIComponent(name)}&gender=${encodeURIComponent(gender)}&dob=${encodeURIComponent(dob)}&fatherId=${encodeURIComponent(fatherId)}&spouseId=${encodeURIComponent(spouseId)}&blood=${encodeURIComponent(blood)}&title=${encodeURIComponent(title)}&mobile=${encodeURIComponent(mobile)}&address=${encodeURIComponent(address)}&photo=${encodeURIComponent(photoUrl)}&callback=handleSaveConfirmation`;

    const oldSaveScript = document.getElementById("jsonp-save-script");
    if (oldSaveScript) oldSaveScript.remove(); 

    const script = document.createElement("script");
    script.id = "jsonp-save-script";
    script.src = saveUrl;
    document.body.appendChild(script);
}

window.handleSaveConfirmation = function(response) {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.style.display = "none";

    alert("Success! Cloud record synchronized perfectly!");
    clearFormFieldsInputs();

    reloadLiveFamilyData();
    switchTab('tree', document.querySelectorAll(".nav-item")[0]);
    
    const saveScript = document.getElementById("jsonp-save-script");
    if (saveScript) saveScript.remove();
};

function clearFormFieldsInputs() {
    currentEditingMemberId = null;
    const safeClear = (id) => { const el = document.getElementById(id); if (el) el.value = ""; };
    safeClear("form-name");
    safeClear("form-dob");
    safeClear("form-title");
    safeClear("form-mobile");
    safeClear("form-address");
    safeClear("form-photo-url-hidden");
    safeClear("form-father");
    safeClear("form-spouse");
    safeClear("form-photo-file-picker");
    if (document.getElementById("form-blood")) document.getElementById("form-blood").value = "";
    
    const statusBadge = document.getElementById("form-photo-status-badge");
    if (statusBadge) {
        statusBadge.innerText = "No photo selected";
        statusBadge.style.color = "inherit";
    }

    const formHeading = document.querySelector(".form-container h3");
    if (formHeading) formHeading.innerText = "➕ Add New Family Member";
}

window.switchTab = function(tabName, element) {
    triggerAppHapticBump();
    document.querySelectorAll(".app-screen").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    
    const screenEl = document.getElementById(`screen-${tabName}`);
    if (screenEl) screenEl.classList.add("active");
    
    if (element) {
        element.classList.add("active");
    } else {
        const navIdx = tabName === 'tree' ? 0 : 1;
        document.querySelectorAll(".nav-item")[navIdx].classList.add("active");
    }

    const fab = document.getElementById("app-floating-btn");
    if (fab) { fab.style.display = (tabName === 'add') ? "none" : "flex"; }

    if (tabName === 'add' && !currentEditingMemberId) { clearFormFieldsInputs(); }

    const mainContent = document.getElementById("app-main-content");
    if (tabName === 'tree') {
        document.body.style.overflow = "hidden";
        if (mainContent) {
            mainContent.style.overflow = "hidden";
            mainContent.style.height = "calc(100vh - 128px)";
        }
        setTimeout(centerTree, 80);
    } else {
        document.body.style.overflow = "auto";
        if (mainContent) {
            mainContent.style.height = "auto";
            mainContent.style.overflowY = "auto";
        }
    }

    const headerTitle = document.getElementById("header-title");
    const headerSubtitle = document.getElementById("header-subtitle");
    if (!headerTitle || !headerSubtitle) return;

    if (tabName === 'tree') {
        headerTitle.innerText = "Family Heritage";
        headerSubtitle.innerText = "Preserving Our Legacy Forever";
    } else if (tabName === 'list') {
        headerTitle.innerText = "Family Directory";
        headerSubtitle.innerText = "Search & Browse All Members";
    } else if (tabName === 'add') {
        headerTitle.innerText = "Grow Our Tree";
        headerSubtitle.innerText = "Add New Members to Cloud";
    }
};

window.triggerFabAction = function() { switchTab('add'); };

window.openProfileModal = function(id) {
    triggerAppHapticBump();
    const member = familyMembersCache[id];
    if (!member) return;

    const isFemale = (member.gender === 'பெண்' || member.gender.toLowerCase() === 'female');
    const avatar = member.photo || (isFemale ? 'https://cdn-icons-png.flaticon.com/512/6997/6997662.png' : 'https://cdn-icons-png.flaticon.com/512/4140/4140037.png');

    document.getElementById("modal-avatar").src = avatar;
    document.getElementById("modal-name").innerText = member.name;
    document.getElementById("modal-gender").innerText = member.gender;
    document.getElementById("modal-dob").innerText = member.dob;
    document.getElementById("modal-blood").innerText = member.blood;
    document.getElementById("modal-title").innerText = member.title;
    document.getElementById("modal-phone").innerText = member.mobile;
    document.getElementById("modal-address").innerText = member.address;

    globalActiveSelectedMobileNumber = member.mobile.replace(/\s+/g, '');
    
    const callBtn = document.getElementById("quick-action-link-call");
    const waBtn = document.getElementById("quick-action-link-whatsapp");
    
    if(globalActiveSelectedMobileNumber && globalActiveSelectedMobileNumber !== "NotProvided" && globalActiveSelectedMobileNumber !== "Not Provided") {
        if(callBtn) callBtn.style.opacity = "1";
        if(waBtn) waBtn.style.opacity = "1";
    } else {
        if(callBtn) callBtn.style.opacity = "0.3";
        if(waBtn) waBtn.style.opacity = "0.3";
    }

    document.getElementById("profile-modal").setAttribute("data-active-id", id);
    document.getElementById("profile-modal").classList.add("active");
};

window.closeProfileModal = function() {
    document.getElementById("profile-modal").classList.remove("active");
    const isTreeActive = document.getElementById("screen-tree").classList.contains("active");
    const mainContent = document.getElementById("app-main-content");
    if (isTreeActive) {
        document.body.style.overflow = "hidden";
        if (mainContent) mainContent.style.overflow = "hidden";
    } else {
        document.body.style.overflow = "auto";
        if (mainContent) mainContent.style.overflowY = "auto";
    }
};

window.openFullscreenPhotoZoom = function() {
    triggerAppHapticBump();
    const currentSrc = document.getElementById("modal-avatar").src;
    if (!currentSrc) return;
    const viewer = document.getElementById("fullscreen-viewer");
    const targetImg = document.getElementById("fullscreen-target-img");
    targetImg.src = currentSrc;
    viewer.style.display = "flex";
};

window.closeFullscreenPhotoZoom = function() { document.getElementById("fullscreen-viewer").style.display = "none"; };

window.triggerEditFormActionLocal = function() {
    const activeId = document.getElementById("profile-modal").getAttribute("data-active-id");
    const member = familyMembersCache[activeId];
    if (!member) return;

    currentEditingMemberId = activeId.toString(); 

    const safeSetVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || "";
    };

    safeSetVal("form-name", member.name);
    safeSetVal("form-gender", member.gender);
    safeSetVal("form-dob", convertToInputDate(member.dob));
    safeSetVal("form-father", member.fatherId);
    safeSetVal("form-spouse", member.spouseId);
    safeSetVal("form-blood", member.blood);
    safeSetVal("form-title", member.title);
    safeSetVal("form-mobile", member.mobile);
    safeSetVal("form-address", member.address);
    safeSetVal("form-photo-url-hidden", member.photo); 

    const statusBadge = document.getElementById("form-photo-status-badge");
    if (statusBadge && member.photo) {
        statusBadge.innerText = "🔄 Keeping existing profile photo";
        statusBadge.style.color = "#00a884";
    }

    closeProfileModal();
    switchTab('add');
    const formHeading = document.querySelector(".form-container h3");
    if (formHeading) formHeading.innerText = `✏️ Editing Profile: ${member.name} (ID: ${activeId})`;
};

window.triggerDeleteActionLocal = function() {
    const activeId = document.getElementById("profile-modal").getAttribute("data-active-id");
    if(confirm(`Are you sure you want to remove family ID entry reference ${activeId}?`)) {
        familyDataArray = familyDataArray.filter(item => item.id !== activeId);
        buildTreeChartUI();
        executeDirectoryFilterUIRenderLines();
        closeProfileModal();
    }
};

let scale = 0.9, lastScale = 0.9;
let posX = 0, posY = 15;
let startX = 0, startY = 0;
let isDragging = false;
let touchStartDist = 0;
let viewport, canvas;

function updateTransform() { if (canvas) canvas.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`; }
function centerTree() { if (viewport && canvas) { posX = (viewport.clientWidth - canvas.clientWidth * scale) / 2; updateTransform(); } }

window.addEventListener('DOMContentLoaded', () => {
    viewport = document.getElementById('tree-viewport');
    canvas = document.getElementById('zoom-canvas');
    
    const activeSavedThemeCache = localStorage.getItem("native_app_theme_choice");
    if(activeSavedThemeCache === 'dark') {
        document.body.classList.add("dark-theme-mode-active");
        if(document.getElementById("dark-mode-toggle-btn")) document.getElementById("dark-mode-toggle-btn").innerText = "☀️";
    }

    const treeSearchInput = document.getElementById("tree-instant-search-input");
    if (treeSearchInput) {
        treeSearchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            const allCards = document.querySelectorAll(".node-card");
            if (!query) {
                allCards.forEach(card => card.classList.remove("search-dimmed", "search-match-highlight"));
                return;
            }
            allCards.forEach(card => {
                const nameAttr = card.getAttribute("data-search-name") || "";
                if (nameAttr.includes(query)) {
                    card.classList.remove("search-dimmed"); card.classList.add("search-match-highlight");
                } else {
                    card.classList.remove("search-match-highlight"); card.classList.add("search-dimmed");
                }
            });
        });
    }

    const searchInput = document.getElementById("member-search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => { executeDirectoryFilterUIRenderLines(); });
    }

    if (!viewport || !canvas) return;

    const phoneCachedData = localStorage.getItem("cached_family_tree_data");
    if (phoneCachedData) { processFamilyArrayPacket(JSON.parse(phoneCachedData)); }

    viewport.addEventListener('mousedown', (e) => {
        if (!document.getElementById("screen-tree").classList.contains("active")) return;
        if (e.target.closest('.node-card')) return;
        isDragging = true; startX = e.clientX - posX; startY = e.clientY - posY;
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        posX = e.clientX - startX; posY = e.clientY - startY; updateTransform();
    });
    window.addEventListener('mouseup', () => isDragging = false);

    viewport.addEventListener('touchstart', (e) => {
        if (!document.getElementById("screen-tree").classList.contains("active")) return;
        if (e.target.closest('.node-card')) return;
        if (e.touches.length === 1) {
            isDragging = true; startX = e.touches[0].clientX - posX; startY = e.touches[0].clientY - posY;
        } else if (e.touches.length === 2) {
            isDragging = false; touchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); lastScale = scale;
        }
    });
    viewport.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            posX = e.touches[0].clientX - startX; posY = e.touches[0].clientY - startY; updateTransform();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            scale = Math.min(Math.max(lastScale * (dist / touchStartDist), 0.35), 1.8); updateTransform();
        }
    });
    viewport.addEventListener('touchend', () => isDragging = false);

    reloadLiveFamilyData();
});
