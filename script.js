// Global data storage - now using IndexedDB
let items = [];
let bags = [];
let events = [];

// API Configuration (should match index.html)
const USE_API = true;
let isOnline = navigator.onLine || false;

// Performance optimizations (will be initialized after utils load)
let debouncedSearch = null;
let debouncedRender = null;

// Virtual scroll instances
let itemsVirtualScroll = null;
let bagsVirtualScroll = null;
let eventsVirtualScroll = null;

// Form validation rules
const itemFormRules = {
    'item-name': { required: true, min: 2, max: 100 },
    'purchase-date': { required: true },
    'purchase-price': { required: true, pattern: /^\d+(\.\d{1,2})?$/, message: 'กรุณาระบุราคาให้ถูกต้อง' }
};

const bagFormRules = {
    'bag-name': { required: true, min: 2, max: 50 },
    'bag-responsible': { required: true, min: 2, max: 50 }
};

const eventFormRules = {
    'event-name': { required: true, min: 2, max: 100 },
    'event-location': { required: true, min: 2, max: 100 },
    'event-customer': { required: true, min: 2, max: 100 },
    'event-responsible': { required: true, min: 2, max: 50 },
    'event-date': { required: true }
};

// Utility functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Formatters (will be optimized if utils are available)
function formatDate(dateString) {
    try {
        if (typeof DateUtils !== 'undefined') {
            return DateUtils.formatThaiDate(dateString);
        }
        return new Date(dateString).toLocaleDateString('th-TH');
    } catch (error) {
        return dateString;
    }
}

function formatPrice(price) {
    try {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB'
        }).format(price);
    } catch (error) {
        return `${price} ฿`;
    }
}

function getRelativeTime(date) {
    try {
        if (typeof DateUtils !== 'undefined') {
            return DateUtils.getRelativeTime(date);
        }
        const now = new Date();
        const diff = now - new Date(date);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'วันนี้';
        if (days === 1) return 'เมื่อวาน';
        return `${days} วันที่แล้ว`;
    } catch (error) {
        return date;
    }
}

// Image preview with fallback
function createImagePreview(file, container) {
    if (file && file.type.startsWith('image/')) {
        try {
            // Show loading state
            container.innerHTML = '<div class="loading"></div>';
            
            // Use FileReader as fallback
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.onload = () => {
                    container.innerHTML = '';
                    container.appendChild(img);
                    
                    // Add lazy loading if utils are available
                    if (typeof performanceUtils !== 'undefined') {
                        performanceUtils.addLazyImage(img);
                    }
                };
            };
            reader.onerror = () => {
                container.innerHTML = '<div class="error">การโหลดรูปภาพล้มเหลว</div>';
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Image processing failed:', error);
            container.innerHTML = '<div class="error">การโหลดรูปภาพล้มเหลว</div>';
        }
    }
}

// Database operations with fallback
async function loadData() {
    try {
        if (typeof db !== 'undefined') {
            await db.init();
            
            // Try to migrate from localStorage first
            await db.migrateFromLocalStorage();
            
            // Load data from IndexedDB
            items = await db.getAll('items');
            bags = await db.getAll('bags');
            events = await db.getAll('events');
            
            console.log('Data loaded from IndexedDB successfully');
        } else {
            // Fallback to localStorage
            items = JSON.parse(localStorage.getItem('office-items') || '[]');
            bags = JSON.parse(localStorage.getItem('office-bags') || '[]');
            events = JSON.parse(localStorage.getItem('office-events') || '[]');
            
            console.log('Data loaded from localStorage');
        }
    } catch (error) {
        console.error('Failed to load data:', error);
        // Fallback to localStorage
        items = JSON.parse(localStorage.getItem('office-items') || '[]');
        bags = JSON.parse(localStorage.getItem('office-bags') || '[]');
        events = JSON.parse(localStorage.getItem('office-events') || '[]');
        
        console.log('Using localStorage fallback');
    }
}

async function saveItem(item) {
    try {
        if (typeof db !== 'undefined') {
            await db.put('items', item);
        } else {
            // Fallback to localStorage
            items.push(item);
            localStorage.setItem('office-items', JSON.stringify(items));
        }
        
        if (!items.find(i => i.id === item.id)) {
            items.push(item);
        }
        return true;
    } catch (error) {
        console.error('Failed to save item:', error);
        // Fallback to localStorage
        try {
            items.push(item);
            localStorage.setItem('office-items', JSON.stringify(items));
            return true;
        } catch (fallbackError) {
            console.error('Fallback save failed:', fallbackError);
            return false;
        }
    }
}

async function saveBag(bag) {
    try {
        await db.put('bags', bag);
        bags.push(bag);
        return true;
    } catch (error) {
        console.error('Failed to save bag:', error);
        return false;
    }
}

async function saveEvent(event) {
    try {
        await db.put('events', event);
        events.push(event);
        return true;
    } catch (error) {
        console.error('Failed to save event:', error);
        return false;
    }
}

async function updateItem(item) {
    try {
        await db.put('items', item);
        const index = items.findIndex(i => i.id === item.id);
        if (index !== -1) {
            items[index] = item;
        }
        return true;
    } catch (error) {
        console.error('Failed to update item:', error);
        return false;
    }
}

async function deleteItemFromDB(itemId) {
    try {
        await db.delete('items', itemId);
        items = items.filter(item => item.id !== itemId);
        return true;
    } catch (error) {
        console.error('Failed to delete item:', error);
        return false;
    }
}

// Navigation functionality
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetSection = button.dataset.section;
            
            // Update active nav button
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active section
            sections.forEach(section => section.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');
            
            // Refresh the active section
            refreshActiveSection(targetSection);
        });
    });
}

function refreshActiveSection(section) {
    switch(section) {
        case 'items':
            renderItems();
            break;
        case 'bags':
            renderBags();
            break;
        case 'events':
            renderEvents();
            break;
        case 'returns':
            renderReturns();
            break;
    }
}

// Search functionality with fallback
function performSearch(searchTerm, section) {
    if (!searchTerm.trim()) {
        return Promise.resolve({ data: [], total: 0, hasMore: false });
    }
    
    const searchLower = searchTerm.toLowerCase();
    
    try {
        if (typeof db !== 'undefined' && db.isReady) {
            const options = { limit: 50, offset: 0 };
            
            switch(section) {
                case 'items':
                    return db.search('items', searchTerm, { ...options, fields: ['name'] });
                case 'bags':
                    return db.search('bags', searchTerm, { ...options, fields: ['name', 'responsible'] });
                case 'events':
                    return db.search('events', searchTerm, { ...options, fields: ['name', 'location', 'customer'] });
                default:
                    return Promise.resolve({ data: [], total: 0, hasMore: false });
            }
        } else {
            // Fallback search
            let results = [];
            
            switch(section) {
                case 'items':
                    results = items.filter(item => 
                        item.name.toLowerCase().includes(searchLower)
                    );
                    break;
                case 'bags':
                    results = bags.filter(bag => 
                        bag.name.toLowerCase().includes(searchLower) ||
                        bag.responsible.toLowerCase().includes(searchLower)
                    );
                    break;
                case 'events':
                    results = events.filter(event => 
                        event.name.toLowerCase().includes(searchLower) ||
                        event.location.toLowerCase().includes(searchLower) ||
                        event.customer.toLowerCase().includes(searchLower)
                    );
                    break;
                default:
                    results = [];
            }
            
            return Promise.resolve({ 
                data: results.slice(0, 50), 
                total: results.length, 
                hasMore: results.length > 50 
            });
        }
    } catch (error) {
        console.error('Search failed:', error);
        return Promise.resolve({ data: [], total: 0, hasMore: false });
    }
}

// Items management
function initItemManagement() {
    const addItemBtn = document.getElementById('add-item-btn');
    const itemFormContainer = document.getElementById('item-form-container');
    const itemForm = document.getElementById('item-form');
    const cancelItemBtn = document.getElementById('cancel-item-btn');
    const receiptPhoto = document.getElementById('receipt-photo');
    const itemPhoto = document.getElementById('item-photo');
    const receiptPreview = document.getElementById('receipt-preview');
    const itemPreview = document.getElementById('item-preview');

    addItemBtn.addEventListener('click', () => {
        itemFormContainer.style.display = 'block';
        itemForm.reset();
        receiptPreview.innerHTML = '';
        itemPreview.innerHTML = '';
    });

    cancelItemBtn.addEventListener('click', () => {
        itemFormContainer.style.display = 'none';
    });

    receiptPhoto.addEventListener('change', (e) => {
        createImagePreview(e.target.files[0], receiptPreview);
    });

    itemPhoto.addEventListener('change', (e) => {
        createImagePreview(e.target.files[0], itemPreview);
    });

    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Simple form validation
        const itemName = document.getElementById('item-name').value.trim();
        const purchaseDate = document.getElementById('purchase-date').value;
        const purchasePrice = document.getElementById('purchase-price').value;
        
        if (!itemName) {
            alert('กรุณาระบุชื่อสินค้า');
            return;
        }
        
        if (!purchaseDate) {
            alert('กรุณาระบุวันที่ซื้อ');
            return;
        }
        
        if (!purchasePrice || isNaN(purchasePrice) || parseFloat(purchasePrice) <= 0) {
            alert('กรุณาระบุราคาที่ถูกต้อง');
            return;
        }

        // Show loading state
        const submitBtn = itemForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<div class="loading"></div> กำลังบันทึก...';
        submitBtn.disabled = true;

        try {
            const receiptFile = receiptPhoto.files[0];
            const itemFile = itemPhoto.files[0];
            
            const item = {
                id: generateId(),
                name: itemName,
                purchaseDate: purchaseDate,
                price: parseFloat(purchasePrice),
                status: 'available',
                bagId: null,
                bagName: null,
                createdAt: new Date().toISOString()
            };

            // Handle photo uploads
            if (receiptFile) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    item.receiptPhoto = e.target.result;
                    if (itemFile) {
                        const itemReader = new FileReader();
                        itemReader.onload = function(e) {
                            item.itemPhoto = e.target.result;
                            addItem(item);
                        };
                        itemReader.readAsDataURL(itemFile);
                    } else {
                        addItem(item);
                    }
                };
                reader.readAsDataURL(receiptFile);
            } else if (itemFile) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    item.itemPhoto = e.target.result;
                    addItem(item);
                };
                reader.readAsDataURL(itemFile);
            } else {
                addItem(item);
            }

            // Will be handled in the FileReader callbacks above
        } catch (error) {
            console.error('Failed to add item:', error);
            showNotification('ไม่สามารถเพิ่มสินค้าได้', 'error');
        } finally {
            // Reset button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

async function addItem(item) {
    const success = await saveItem(item);
    if (success) {
        if (debouncedRender && typeof debouncedRender === 'function') {
            debouncedRender('items');
        } else {
            renderItems();
        }
        document.getElementById('item-form-container').style.display = 'none';
        document.getElementById('item-form').reset();
        showNotification('เพิ่มสินค้าเรียบร้อยแล้ว', 'success');
    } else {
        showNotification('ไม่สามารถเพิ่มสินค้าได้', 'error');
    }
}

function renderItems() {
    const itemsGrid = document.getElementById('items-grid');
    const searchInput = document.getElementById('items-search');
    
    // Clear search when rendering all items
    if (searchInput && searchInput.value) {
        searchInput.value = '';
    }
    
    if (items.length === 0) {
        itemsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>ยังไม่มีสินค้าในระบบ</h3>
                <p>คลิกปุ่ม "เพิ่มสินค้าใหม่" เพื่อเริ่มต้น</p>
            </div>
        `;
        return;
    }

    renderItemsGrid(items);
}

function getStatusText(status, bagName) {
    switch(status) {
        case 'available':
            return 'พร้อมใช้งาน';
        case 'in-bag':
            return `อยู่ในกระเป๋า ${bagName}`;
        case 'on-event':
            return 'On-Event';
        case 'lost':
            return 'สูญหาย';
        case 'maintenance':
            return 'ซ่อมบำรุง';
        default:
            return status;
    }
}

function viewItemDetails(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('item-modal');
    const content = document.getElementById('item-modal-content');
    
    content.innerHTML = `
        <h3>${item.name}</h3>
        <ul class="info-list">
            <li><strong>วันที่ซื้อ:</strong> <span>${formatDate(item.purchaseDate)}</span></li>
            <li><strong>ราคา:</strong> <span>${formatPrice(item.price)}</span></li>
            <li><strong>สถานะ:</strong> <span class="status-badge status-${item.status}">${getStatusText(item.status, item.bagName)}</span></li>
            ${item.bagName ? `<li><strong>กระเป๋า:</strong> <span>${item.bagName}</span></li>` : ''}
            <li><strong>วันที่เพิ่ม:</strong> <span>${formatDate(item.createdAt)}</span></li>
        </ul>
        
        ${item.status === 'available' || item.status === 'lost' || item.status === 'maintenance' ? `
        <div class="status-change-section">
            <h4>เปลี่ยนสถานะ</h4>
            <div class="form-group">
                <select id="status-select-${item.id}" class="form-control">
                    <option value="available" ${item.status === 'available' ? 'selected' : ''}>พร้อมใช้งาน</option>
                    <option value="lost" ${item.status === 'lost' ? 'selected' : ''}>สูญหาย</option>
                    <option value="maintenance" ${item.status === 'maintenance' ? 'selected' : ''}>ซ่อมบำรุง</option>
                </select>
            </div>
            <button class="btn btn-primary btn-sm" onclick="changeItemStatus('${item.id}')">
                <i class="fas fa-save"></i> บันทึกสถานะ
            </button>
        </div>
        ` : ''}
    `;
    
    modal.style.display = 'block';
}

async function changeItemStatus(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const selectElement = document.getElementById(`status-select-${itemId}`);
    if (!selectElement) return;
    
    const newStatus = selectElement.value;
    const oldStatus = item.status;
    
    // ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
    if (newStatus === oldStatus) {
        showNotification('ไม่มีการเปลี่ยนแปลงสถานะ', 'info');
        return;
    }
    
    // อัปเดตสถานะ
    item.status = newStatus;
    
    // ถ้าเปลี่ยนเป็นสูญหายหรือซ่อมบำรุง ให้นำออกจากกระเป๋า
    if ((newStatus === 'lost' || newStatus === 'maintenance') && item.bagId) {
        item.bagId = null;
        item.bagName = null;
    }
    
    try {
        const success = await updateItem(item);
        if (success) {
            // อัปเดต API ถ้าออนไลน์
            if (USE_API && isOnline) {
                await updateItemAPI(item);
            }
            
            debouncedRender('items');
            showNotification(`เปลี่ยนสถานะเป็น "${getStatusText(newStatus)}" เรียบร้อยแล้ว`, 'success');
            
            // ปิด modal
            document.getElementById('item-modal').style.display = 'none';
        } else {
            showNotification('ไม่สามารถอัปเดตสถานะได้', 'error');
            // คืนค่าสถานะเดิม
            item.status = oldStatus;
        }
    } catch (error) {
        console.error('Failed to change item status:', error);
        showNotification('เกิดข้อผิดพลาดในการอัปเดตสถานะ', 'error');
        // คืนค่าสถานะเดิม
        item.status = oldStatus;
    }
}

async function deleteItem(itemId) {
    if (confirm('คุณต้องการลบสินค้านี้หรือไม่?')) {
        const success = await deleteItemFromDB(itemId);
        if (success) {
            debouncedRender('items');
            showNotification('ลบสินค้าเรียบร้อยแล้ว', 'success');
        } else {
            showNotification('ไม่สามารถลบสินค้าได้', 'error');
        }
    }
}

// Bags management
function initBagManagement() {
    const addBagBtn = document.getElementById('add-bag-btn');
    const bagFormContainer = document.getElementById('bag-form-container');
    const bagForm = document.getElementById('bag-form');
    const cancelBagBtn = document.getElementById('cancel-bag-btn');

    addBagBtn.addEventListener('click', () => {
        bagFormContainer.style.display = 'block';
        bagForm.reset();
    });

    cancelBagBtn.addEventListener('click', () => {
        bagFormContainer.style.display = 'none';
    });

    bagForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const bag = {
            id: generateId(),
            name: document.getElementById('bag-name').value,
            responsible: document.getElementById('bag-responsible').value,
            status: 'available',
            items: [],
            createdAt: new Date().toISOString()
        };

        bags.push(bag);
        saveToLocalStorage();
        renderBags();
        bagFormContainer.style.display = 'none';
        showNotification('สร้างกระเป๋าเรียบร้อยแล้ว', 'success');
    });
}

function renderBags() {
    const bagsGrid = document.getElementById('bags-grid');
    const searchInput = document.getElementById('bags-search');
    
    // Clear search when rendering all bags
    if (searchInput && searchInput.value) {
        searchInput.value = '';
    }
    
    if (bags.length === 0) {
        bagsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-shopping-bag"></i>
                <h3>ยังไม่มีกระเป๋าในระบบ</h3>
                <p>คลิกปุ่ม "สร้างกระเป๋าใหม่" เพื่อเริ่มต้น</p>
            </div>
        `;
        return;
    }

    renderBagsGrid(bags);
}

function getBagStatusText(status) {
    switch(status) {
        case 'available':
            return 'พร้อมใช้งาน';
        case 'on-event':
            return 'On-Event';
        default:
            return status;
    }
}

function viewBagDetails(bagId) {
    const bag = bags.find(b => b.id === bagId);
    if (!bag) return;

    // Force update bag items from current state
    const bagItems = items.filter(item => item.bagId === bagId && item.status === 'in-bag');
    
    // Also update bag.items array to match current state
    bag.items = bagItems.map(item => item.id);
    
    const modal = document.getElementById('bag-modal');
    const content = document.getElementById('bag-modal-content');
    
    content.innerHTML = `
        <h3>${bag.name}</h3>
        <ul class="info-list">
            <li><strong>ผู้รับผิดชอบ:</strong> <span>${bag.responsible}</span></li>
            <li><strong>สถานะ:</strong> <span class="status-badge status-${bag.status}">${getBagStatusText(bag.status)}</span></li>
            <li><strong>จำนวนสินค้า:</strong> <span>${bagItems.length} รายการ</span></li>
            <li><strong>วันที่สร้าง:</strong> <span>${formatDate(bag.createdAt)}</span></li>
        </ul>
        
        <h4 style="margin: 1.5rem 0 1rem 0;">สินค้าในกระเป๋า</h4>
        ${bagItems.length > 0 ? `
            <div style="max-height: 300px; overflow-y: auto;">
                ${bagItems.map(item => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 0.5rem;">
                        <div>
                            <strong>${item.name}</strong><br>
                            <small>${formatPrice(item.price)}</small>
                        </div>
                        ${bag.status === 'available' ? `
                            <button class="btn btn-warning btn-sm" onclick="removeFromBag('${item.id}')">
                                <i class="fas fa-times"></i> นำออก
                            </button>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        ` : '<p style="color: #6c757d; text-align: center; padding: 2rem;">ยังไม่มีสินค้าในกระเป๋า</p>'}
    `;
    
    modal.style.display = 'block';
}

function deleteBag(bagId) {
    if (confirm('คุณต้องการลบกระเป๋านี้หรือไม่?')) {
        bags = bags.filter(bag => bag.id !== bagId);
        saveToLocalStorage();
        renderBags();
        showNotification('ลบกระเป๋าเรียบร้อยแล้ว', 'success');
    }
}

function showAddToBagModal(itemId) {
    const availableBags = bags.filter(bag => bag.status === 'available');
    
    if (availableBags.length === 0) {
        alert('ไม่มีกระเป๋าที่พร้อมใช้งาน กรุณาสร้างกระเป๋าใหม่ก่อน');
        return;
    }

    const modal = document.getElementById('item-modal');
    const content = document.getElementById('item-modal-content');
    
    content.innerHTML = `
        <h3>เลือกกระเป๋า</h3>
        <div style="max-height: 300px; overflow-y: auto;">
            ${availableBags.map(bag => `
                <div class="checkbox-item" onclick="addItemToBag('${itemId}', '${bag.id}')">
                    <div>
                        <strong>${bag.name}</strong><br>
                        <small>ผู้รับผิดชอบ: ${bag.responsible} | สินค้า: ${bag.items.length} รายการ</small>
                    </div>
                    <button class="btn btn-primary btn-sm">เลือก</button>
                </div>
            `).join('')}
        </div>
    `;
    
    modal.style.display = 'block';
}

async function addItemToBag(itemId, bagId) {
    const item = items.find(i => i.id === itemId);
    const bag = bags.find(b => b.id === bagId);
    
    if (!item || !bag) return;

    try {
        // Use API if available
        if (typeof BagsAPI !== 'undefined' && USE_API && isOnline) {
            await BagsAPI.addItem(bagId, itemId);
            showNotification(`ใส่ "${item.name}" ลงในกระเป๋า "${bag.name}" เรียบร้อยแล้ว (ซิงค์กับฐานข้อมูลแล้ว)`, 'success');
        } else {
            // Fallback to localStorage
            showNotification(`ใส่ "${item.name}" ลงในกระเป๋า "${bag.name}" เรียบร้อยแล้ว (บันทึกในเครื่องเท่านั้น)`, 'warning');
        }
        
        // Update local data
        item.status = 'in-bag';
        item.bagId = bagId;
        item.bagName = bag.name;

        // Add item to bag
        bag.items.push(itemId);

        saveToLocalStorage();
        renderItems();
        document.getElementById('item-modal').style.display = 'none';
        
    } catch (error) {
        console.error('Failed to add item to bag:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

async function removeFromBag(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const bag = bags.find(b => b.id === item.bagId);
    if (!bag) return;

    try {
        // Use API if available
        if (typeof BagsAPI !== 'undefined' && USE_API && isOnline) {
            await BagsAPI.removeItem(item.bagId, itemId);
            showNotification(`นำ "${item.name}" ออกจากกระเป๋าเรียบร้อยแล้ว (ซิงค์กับฐานข้อมูลแล้ว)`, 'success');
        } else {
            // Fallback to localStorage
            showNotification(`นำ "${item.name}" ออกจากกระเป๋าเรียบร้อยแล้ว (บันทึกในเครื่องเท่านั้น)`, 'warning');
        }
        
        // Update local data
        bag.items = bag.items.filter(id => id !== itemId);
        item.status = 'available';
        item.bagId = null;
        item.bagName = null;

        saveToLocalStorage();
        renderItems();
        renderBags(); // Refresh bags display to update item count
        viewBagDetails(bag.id); // Refresh modal after rendering
        
    } catch (error) {
        console.error('Failed to remove item from bag:', error);
        showNotification(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    }
}

// Events management
function initEventManagement() {
    const addEventBtn = document.getElementById('add-event-btn');
    const eventFormContainer = document.getElementById('event-form-container');
    const eventForm = document.getElementById('event-form');
    const cancelEventBtn = document.getElementById('cancel-event-btn');

    addEventBtn.addEventListener('click', () => {
        const availableBags = bags.filter(bag => bag.status === 'available' && bag.items.length > 0);
        
        if (availableBags.length === 0) {
            alert('ไม่มีกระเป๋าที่พร้อมใช้งานและมีสินค้า');
            return;
        }

        updateEventBagsList();
        eventFormContainer.style.display = 'block';
        eventForm.reset();
    });

    cancelEventBtn.addEventListener('click', () => {
        eventFormContainer.style.display = 'none';
    });

    eventForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const selectedBags = Array.from(document.querySelectorAll('#event-bags-list input:checked'))
            .map(checkbox => checkbox.value);

        if (selectedBags.length === 0) {
            alert('กรุณาเลือกกระเป๋าอย่างน้อย 1 ใบ');
            return;
        }

        const event = {
            id: generateId(),
            name: document.getElementById('event-name').value,
            location: document.getElementById('event-location').value,
            customer: document.getElementById('event-customer').value,
            responsible: document.getElementById('event-responsible').value,
            date: document.getElementById('event-date').value,
            bags: selectedBags,
            status: 'active',
            createdAt: new Date().toISOString()
        };

        // Update bag statuses
        selectedBags.forEach(bagId => {
            const bag = bags.find(b => b.id === bagId);
            if (bag) {
                bag.status = 'on-event';
                // Update items in the bag
                bag.items.forEach(itemId => {
                    const item = items.find(i => i.id === itemId);
                    if (item) {
                        item.status = 'on-event';
                    }
                });
            }
        });

        events.push(event);
        saveToLocalStorage();
        renderEvents();
        renderBags();
        renderItems();
        eventFormContainer.style.display = 'none';
        showNotification('สร้างอีเวนต์เรียบร้อยแล้ว', 'success');
    });
}

function updateEventBagsList() {
    const bagsList = document.getElementById('event-bags-list');
    const availableBags = bags.filter(bag => bag.status === 'available' && bag.items.length > 0);
    
    bagsList.innerHTML = availableBags.map(bag => `
        <div class="checkbox-item">
            <input type="checkbox" id="bag-${bag.id}" value="${bag.id}">
            <label for="bag-${bag.id}">
                <strong>${bag.name}</strong><br>
                <small>ผู้รับผิดชอบ: ${bag.responsible} | สินค้า: ${bag.items.length} รายการ</small>
            </label>
        </div>
    `).join('');
}

function renderEvents() {
    const eventsGrid = document.getElementById('events-grid');
    const searchInput = document.getElementById('events-search');
    
    // Clear search when rendering all events
    if (searchInput && searchInput.value) {
        searchInput.value = '';
    }
    
    if (events.length === 0) {
        eventsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-alt"></i>
                <h3>ยังไม่มีอีเวนต์ในระบบ</h3>
                <p>คลิกปุ่ม "สร้างอีเวนต์ใหม่" เพื่อเริ่มต้น</p>
            </div>
        `;
        return;
    }

    renderEventsGrid(events);
}

function viewEventDetails(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const eventBags = bags.filter(bag => event.bags.includes(bag.id));
    const totalItems = eventBags.reduce((total, bag) => total + bag.items.length, 0);

    const modal = document.getElementById('item-modal');
    const content = document.getElementById('item-modal-content');
    
    content.innerHTML = `
        <h3>${event.name}</h3>
        <ul class="info-list">
            <li><strong>สถานที่:</strong> <span>${event.location}</span></li>
            <li><strong>ลูกค้า:</strong> <span>${event.customer}</span></li>
            <li><strong>ผู้รับผิดชอบ:</strong> <span>${event.responsible}</span></li>
            <li><strong>วันที่:</strong> <span>${formatDate(event.date)}</span></li>
            <li><strong>สถานะ:</strong> <span class="status-badge status-${event.status === 'active' ? 'on-event' : 'completed'}">${event.status === 'active' ? 'กำลังดำเนินการ' : 'เสร็จสิ้น'}</span></li>
            <li><strong>จำนวนกระเป๋า:</strong> <span>${eventBags.length} ใบ</span></li>
            <li><strong>จำนวนสินค้าทั้งหมด:</strong> <span>${totalItems} รายการ</span></li>
        </ul>
        
        <h4 style="margin: 1.5rem 0 1rem 0;">กระเป๋าในอีเวนต์</h4>
        <div style="max-height: 300px; overflow-y: auto;">
            ${eventBags.map(bag => `
                <div style="padding: 1rem; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 0.5rem;">
                    <strong>${bag.name}</strong> (${bag.items.length} รายการ)<br>
                    <small>ผู้รับผิดชอบ: ${bag.responsible}</small>
                </div>
            `).join('')}
        </div>
    `;
    
    modal.style.display = 'block';
}

function returnFromEvent(eventId) {
    if (!confirm('คุณต้องการคืนสินค้าจากอีเวนต์นี้หรือไม่?')) return;

    const event = events.find(e => e.id === eventId);
    if (!event) return;

    // Update event status
    event.status = 'completed';

    // Reset bag and item statuses
    event.bags.forEach(bagId => {
        const bag = bags.find(b => b.id === bagId);
        if (bag) {
            bag.status = 'available';
            bag.items.forEach(itemId => {
                const item = items.find(i => i.id === itemId);
                if (item) {
                    item.status = 'in-bag';
                }
            });
        }
    });

    saveToLocalStorage();
    renderEvents();
    renderBags();
    renderItems();
    renderReturns();
    showNotification('คืนสินค้าเรียบร้อยแล้ว', 'success');
}

// Returns management
function renderReturns() {
    const returnsGrid = document.getElementById('returns-grid');
    const completedEvents = events.filter(event => event.status === 'completed');
    
    if (completedEvents.length === 0) {
        returnsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-undo"></i>
                <h3>ยังไม่มีอีเวนต์ที่เสร็จสิ้น</h3>
                <p>อีเวนต์ที่คืนสินค้าแล้วจะปรากฏที่นี่</p>
            </div>
        `;
        return;
    }

    returnsGrid.innerHTML = completedEvents.map(event => `
        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">${event.name}</div>
                    <div class="card-subtitle">${event.location}</div>
                </div>
                <span class="status-badge status-completed">เสร็จสิ้น</span>
            </div>
            <div class="card-content">
                <p><strong>ลูกค้า:</strong> ${event.customer}</p>
                <p><strong>ผู้รับผิดชอบ:</strong> ${event.responsible}</p>
                <p><strong>วันที่อีเวนต์:</strong> ${formatDate(event.date)}</p>
                <p><strong>กระเป๋า:</strong> ${event.bags.length} ใบ</p>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-sm" onclick="viewEventDetails('${event.id}')">
                    <i class="fas fa-eye"></i> ดูรายละเอียด
                </button>
            </div>
        </div>
    `).join('');
}

// Modal management
function initModals() {
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');

    closeButtons.forEach(close => {
        close.addEventListener('click', () => {
            modals.forEach(modal => modal.style.display = 'none');
        });
    });

    window.addEventListener('click', (e) => {
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div style="padding: 1rem; background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'}; color: white; border-radius: 8px; margin: 1rem; position: fixed; top: 20px; right: 20px; z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Initialize search functionality
function initSearch() {
    const itemsSearch = document.getElementById('items-search');
    const bagsSearch = document.getElementById('bags-search');
    const eventsSearch = document.getElementById('events-search');

    if (itemsSearch) {
        itemsSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            if (debouncedSearch && typeof debouncedSearch === 'function') {
                const searchPromise = debouncedSearch(searchTerm, 'items');
                if (searchPromise && searchPromise.then) {
                    searchPromise.then(results => {
                        renderFilteredItems(results.data);
                    }).catch(error => {
                        console.error('Search error:', error);
                        renderFilteredItems([]);
                    });
                }
            } else {
                // Simple fallback search
                performSearch(searchTerm, 'items').then(results => {
                    renderFilteredItems(results.data);
                }).catch(error => {
                    console.error('Search error:', error);
                    renderFilteredItems([]);
                });
            }
        });
    }

    if (bagsSearch) {
        bagsSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            performSearch(searchTerm, 'bags').then(results => {
                renderFilteredBags(results.data);
            }).catch(error => {
                console.error('Search error:', error);
                renderFilteredBags([]);
            });
        });
    }

    if (eventsSearch) {
        eventsSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            performSearch(searchTerm, 'events').then(results => {
                renderFilteredEvents(results.data);
            }).catch(error => {
                console.error('Search error:', error);
                renderFilteredEvents([]);
            });
        });
    }
}

// Initialize export functionality
function initExport() {
    const exportItemsBtn = document.getElementById('export-items-btn');
    
    if (exportItemsBtn) {
        exportItemsBtn.addEventListener('click', async () => {
            try {
                let data;
                
                if (typeof db !== 'undefined' && db.exportData) {
                    data = await db.exportData();
                } else {
                    // Fallback export
                    data = {
                        items,
                        bags,
                        events,
                        exportDate: new Date().toISOString(),
                        version: 1
                    };
                }
                
                // Simple export function
                const filename = `office-supply-backup-${new Date().toISOString().split('T')[0]}.json`;
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json'
                });
                
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                
                URL.revokeObjectURL(url);
                showNotification('ส่งออกข้อมูลเรียบร้อยแล้ว', 'success');
            } catch (error) {
                console.error('Export failed:', error);
                showNotification('ไม่สามารถส่งออกข้อมูลได้', 'error');
            }
        });
    }
}

// Filtered render functions
function renderFilteredItems(filteredItems) {
    const itemsGrid = document.getElementById('items-grid');
    
    if (filteredItems.length === 0) {
        itemsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>ไม่พบสินค้าที่ค้นหา</h3>
                <p>ลองใช้คำค้นหาอื่น</p>
            </div>
        `;
        return;
    }

    renderItemsGrid(filteredItems);
}

function renderFilteredBags(filteredBags) {
    const bagsGrid = document.getElementById('bags-grid');
    
    if (filteredBags.length === 0) {
        bagsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>ไม่พบกระเป๋าที่ค้นหา</h3>
                <p>ลองใช้คำค้นหาอื่น</p>
            </div>
        `;
        return;
    }

    renderBagsGrid(filteredBags);
}

function renderFilteredEvents(filteredEvents) {
    const eventsGrid = document.getElementById('events-grid');
    
    if (filteredEvents.length === 0) {
        eventsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>ไม่พบอีเวนต์ที่ค้นหา</h3>
                <p>ลองใช้คำค้นหาอื่น</p>
            </div>
        `;
        return;
    }

    renderEventsGrid(filteredEvents);
}

// Extract grid rendering logic
function renderItemsGrid(itemsList) {
    const itemsGrid = document.getElementById('items-grid');
    
    itemsGrid.innerHTML = itemsList.map(item => `
        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">${item.name}</div>
                    <div class="card-subtitle">ซื้อเมื่อ: ${formatDate(item.purchaseDate)}</div>
                </div>
                <span class="status-badge status-${item.status}">
                    ${getStatusText(item.status, item.bagName)}
                </span>
            </div>
            
            <div class="card-content">
                <p><strong>ราคา:</strong> ${formatPrice(item.price)}</p>
                ${item.bagName ? `<p><strong>กระเป๋า:</strong> ${item.bagName}</p>` : ''}
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-sm" onclick="viewItemDetails('${item.id}')">
                    <i class="fas fa-eye"></i> ดูรายละเอียด
                </button>
                ${item.status === 'available' ? `
                    <button class="btn btn-warning btn-sm" onclick="showAddToBagModal('${item.id}')">
                        <i class="fas fa-shopping-bag"></i> ใส่กระเป๋า
                    </button>
                ` : ''}
                <button class="btn btn-danger btn-sm" onclick="deleteItem('${item.id}')">
                    <i class="fas fa-trash"></i> ลบ
                </button>
            </div>
        </div>
    `).join('');

    // Add lazy loading to images if available
    if (typeof performanceUtils !== 'undefined') {
        itemsGrid.querySelectorAll('.card-image').forEach(img => {
            performanceUtils.addLazyImage(img);
        });
    }
}

function renderBagsGrid(bagsList) {
    const bagsGrid = document.getElementById('bags-grid');
    
    bagsGrid.innerHTML = bagsList.map(bag => `
        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">${bag.name}</div>
                    <div class="card-subtitle">ผู้รับผิดชอบ: ${bag.responsible}</div>
                </div>
                <span class="status-badge status-${bag.status}">
                    ${getBagStatusText(bag.status)}
                </span>
            </div>
            <div class="card-content">
                <p><strong>จำนวนสินค้า:</strong> ${bag.items.length} รายการ</p>
                <p><strong>วันที่สร้าง:</strong> ${formatDate(bag.createdAt)}</p>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-sm" onclick="viewBagDetails('${bag.id}')">
                    <i class="fas fa-eye"></i> ดูรายละเอียด
                </button>
                ${bag.status === 'available' && bag.items.length === 0 ? `
                    <button class="btn btn-danger btn-sm" onclick="deleteBag('${bag.id}')">
                        <i class="fas fa-trash"></i> ลบ
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function renderEventsGrid(eventsList) {
    const eventsGrid = document.getElementById('events-grid');
    
    eventsGrid.innerHTML = eventsList.map(event => `
        <div class="card">
            <div class="card-header">
                <div>
                    <div class="card-title">${event.name}</div>
                    <div class="card-subtitle">${event.location}</div>
                </div>
                <span class="status-badge status-${event.status === 'active' ? 'on-event' : 'completed'}">
                    ${event.status === 'active' ? 'กำลังดำเนินการ' : 'เสร็จสิ้น'}
                </span>
            </div>
            <div class="card-content">
                <p><strong>ลูกค้า:</strong> ${event.customer}</p>
                <p><strong>ผู้รับผิดชอบ:</strong> ${event.responsible}</p>
                <p><strong>วันที่:</strong> ${formatDate(event.date)}</p>
                <p><strong>กระเป๋า:</strong> ${event.bags.length} ใบ</p>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-sm" onclick="viewEventDetails('${event.id}')">
                    <i class="fas fa-eye"></i> ดูรายละเอียด
                </button>
                ${event.status === 'active' ? `
                    <button class="btn btn-success btn-sm" onclick="returnFromEvent('${event.id}')">
                        <i class="fas fa-undo"></i> คืนสินค้า
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Initialize the application
async function init() {
    try {
        console.log('Initializing application...');
        
        // Load data first
        await loadData();
        
        // Initialize performance utilities if available
        if (typeof performanceUtils !== 'undefined') {
            debouncedSearch = performanceUtils.debounce(performSearch, 300);
            debouncedRender = performanceUtils.debounce(renderActiveSection, 100);
        } else {
            // Simple fallback functions
            debouncedSearch = function(searchTerm, section) {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        performSearch(searchTerm, section).then(resolve);
                    }, 300);
                });
            };
            debouncedRender = function(section) {
                setTimeout(() => refreshActiveSection(section), 100);
            };
        }
        
        // Initialize components
        initNavigation();
        initItemManagement();
        initBagManagement();
        initEventManagement();
        initModals();
        initSearch();
        initExport();
        
        // Render initial content
        renderItems();
        renderBags();
        renderEvents();
        renderReturns();
        
        console.log('Application initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showNotification('ไม่สามารถเริ่มต้นระบบได้', 'error');
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');
    
    // Check if required dependencies are loaded
    if (typeof db === 'undefined') {
        console.error('Database module not loaded');
        alert('ข้อผิดพลาด: ไม่สามารถโหลดระบบฐานข้อมูลได้');
        return;
    }
    
    if (typeof performanceUtils === 'undefined') {
        console.error('Performance utils not loaded');
        alert('ข้อผิดพลาด: ไม่สามารถโหลดระบบปรับปรุงประสิทธิภาพได้');
        return;
    }
    
    init().catch(error => {
        console.error('Failed to initialize application:', error);
        // Fallback to simple mode without advanced features
        initSimpleMode();
    });
});

// Fallback initialization without advanced features
function initSimpleMode() {
    console.log('Starting in simple mode...');
    
    // Use localStorage as fallback
    items = JSON.parse(localStorage.getItem('office-items')) || [];
    bags = JSON.parse(localStorage.getItem('office-bags') || '[]');
    events = JSON.parse(localStorage.getItem('office-events') || '[]');
    
    // Initialize basic navigation
    initNavigation();
    initItemManagement();
    initBagManagement();
    initEventManagement();
    initModals();
    
    // Render initial content
    renderItems();
    renderBags();
    renderEvents();
    renderReturns();
    
    console.log('Application initialized in simple mode');
    showNotification('ระบบเริ่มต้นในโหมดพื้นฐาน', 'info');
} 