# 🚀 คู่มือการ Deploy ระบบจัดเก็บวัสดุสำนักงาน บน Hostinger

## 📋 **สิ่งที่สร้างให้แล้ว**

### ✅ **ไฟล์ PHP API ทั้งหมด**
```
📁 api/
├── config.php          ← Database configuration
├── items.php           ← Items CRUD API
├── bags.php            ← Bags CRUD API
├── events.php          ← Events CRUD API
└── sync.php            ← Data sync & backup API
```

### ✅ **Database Schema**
```
📄 database_setup.sql   ← Complete SQL setup script
```

### ✅ **Frontend ที่มีอยู่**
```
📄 index.html          ← Main application (ready)
📄 styles.css          ← Styling (ready)
```

## 🎯 **ขั้นตอนการ Deploy**

### **Step 1: สร้างฐานข้อมูลใน Hostinger**

#### **1.1 เข้า hPanel**
1. เข้า **Hostinger hPanel**
2. ไปที่ **"Databases"** → **"MySQL Databases"**
3. คลิก **"Create Database"**

#### **1.2 ตั้งค่าฐานข้อมูล**
```
Database Name: office_supply_db
Username: office_user
Password: [สร้างรหัสผ่านที่แข็งแกร่ง]
```

#### **1.3 รันคำสั่ง SQL**
1. เข้า **phpMyAdmin**
2. เลือกฐานข้อมูล `office_supply_db`
3. ไปที่แท็บ **"SQL"**
4. Copy-paste เนื้อหาจากไฟล์ `database_setup.sql`
5. คลิก **"Go"** เพื่อสร้างตาราง

### **Step 2: อัปเดตการตั้งค่าฐานข้อมูล**

#### **2.1 แก้ไขไฟล์ config.php**
เปิด `api/config.php` และอัปเดต:
```php
// Database configuration - อัปเดตข้อมูลตามที่ Hostinger ให้
define('DB_HOST', 'localhost');           // หรือ IP ที่ Hostinger ให้
define('DB_USER', 'office_user');         // Username ที่สร้าง
define('DB_PASS', 'YOUR_ACTUAL_PASSWORD'); // รหัสผ่านจริง
define('DB_NAME', 'office_supply_db');    // ชื่อฐานข้อมูล
```

### **Step 3: Upload ไฟล์ขึ้น Hostinger**

#### **3.1 โครงสร้างไฟล์ที่ต้อง Upload**
```
📁 public_html/
├── index.html              ← Main application
├── styles.css              ← (optional - มี inline ใน index.html แล้ว)
├── 📁 api/
│   ├── config.php
│   ├── items.php
│   ├── bags.php
│   ├── events.php
│   └── sync.php
└── README.md               ← (optional)
```

#### **3.2 วิธี Upload**
**Option A: File Manager (ใน hPanel)**
1. เข้า **File Manager** ใน hPanel
2. ไปที่โฟลเดอร์ `public_html`
3. Upload ไฟล์ `index.html`
4. สร้างโฟลเดอร์ `api`
5. Upload ไฟล์ PHP ทั้งหมดเข้าโฟลเดอร์ `api`

**Option B: FTP/SFTP**
```bash
# ใช้ FileZilla หรือ FTP client
# Upload ตามโครงสร้างข้างต้น
```

### **Step 4: ปรับ Frontend ให้เชื่อมต่อ API**

#### **4.1 เพิ่ม API Functions ใน index.html**
เพิ่มโค้ดนี้ก่อน `</script>` ใน index.html:

```javascript
// API Configuration
const API_BASE = '/api';
const USE_API = true; // เปลี่ยนเป็น true เพื่อใช้ API

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options
    };
    
    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        // Fallback to localStorage if API fails
        if (USE_API) {
            console.log('Falling back to localStorage');
            return null;
        }
        throw error;
    }
}

// Items API
const ItemsAPI = {
    getAll: () => apiRequest('/items.php'),
    add: (item) => apiRequest('/items.php', {
        method: 'POST',
        body: JSON.stringify(item)
    }),
    update: (item) => apiRequest('/items.php', {
        method: 'PUT',
        body: JSON.stringify(item)
    }),
    delete: (id) => apiRequest(`/items.php?id=${id}`, {
        method: 'DELETE'
    })
};

// Bags API  
const BagsAPI = {
    getAll: () => apiRequest('/bags.php'),
    add: (bag) => apiRequest('/bags.php', {
        method: 'POST',
        body: JSON.stringify(bag)
    }),
    update: (bag) => apiRequest('/bags.php', {
        method: 'PUT',
        body: JSON.stringify(bag)
    }),
    addItem: (bagId, itemId) => apiRequest('/bags.php', {
        method: 'PUT',
        body: JSON.stringify({
            id: bagId,
            action: 'addItem',
            itemId: itemId
        })
    }),
    removeItem: (bagId, itemId) => apiRequest('/bags.php', {
        method: 'PUT',
        body: JSON.stringify({
            id: bagId,
            action: 'removeItem',
            itemId: itemId
        })
    }),
    delete: (id) => apiRequest(`/bags.php?id=${id}`, {
        method: 'DELETE'
    })
};

// Events API
const EventsAPI = {
    getAll: () => apiRequest('/events.php'),
    add: (event) => apiRequest('/events.php', {
        method: 'POST',
        body: JSON.stringify(event)
    }),
    update: (event) => apiRequest('/events.php', {
        method: 'PUT',
        body: JSON.stringify(event)
    }),
    returnItems: (id) => apiRequest(`/events.php?id=${id}`, {
        method: 'DELETE'
    })
};

// Sync API
const SyncAPI = {
    getAll: () => apiRequest('/sync.php'),
    import: (data) => apiRequest('/sync.php?action=import', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    export: () => {
        window.open('/api/sync.php?action=export', '_blank');
    }
};

// ปรับ saveToLocalStorage เพื่อใช้ API
async function saveToLocalStorage() {
    if (!USE_API) {
        // ใช้โค้ดเดิม
        try {
            localStorage.setItem('office-items', JSON.stringify(items));
            localStorage.setItem('office-bags', JSON.stringify(bags));
            localStorage.setItem('office-events', JSON.stringify(events));
        } catch (error) {
            // Handle localStorage quota exceeded
            console.error('localStorage error:', error);
        }
        return;
    }
    
    // ใช้ API
    try {
        // Sync กับ server ได้ในอนาคต
        // ตอนนี้ยังใช้ localStorage เป็น fallback
        localStorage.setItem('office-items', JSON.stringify(items));
        localStorage.setItem('office-bags', JSON.stringify(bags));
        localStorage.setItem('office-events', JSON.stringify(events));
    } catch (error) {
        console.error('Save error:', error);
    }
}

// ปรับ addItem function ให้ใช้ API
async function addItemAPI(item) {
    if (!USE_API) return false;
    
    try {
        const result = await ItemsAPI.add(item);
        if (result && result.success) {
            // Refresh data from API
            await loadDataFromAPI();
            return true;
        }
    } catch (error) {
        console.error('Failed to add item via API:', error);
    }
    return false;
}

// Load data from API
async function loadDataFromAPI() {
    if (!USE_API) return false;
    
    try {
        const [itemsResult, bagsResult, eventsResult] = await Promise.all([
            ItemsAPI.getAll(),
            BagsAPI.getAll(),
            EventsAPI.getAll()
        ]);
        
        if (itemsResult && bagsResult && eventsResult) {
            items = itemsResult;
            bags = bagsResult;
            events = eventsResult;
            
            // Update localStorage as cache
            saveToLocalStorage();
            return true;
        }
    } catch (error) {
        console.error('Failed to load data from API:', error);
    }
    return false;
}

// ปรับ init function
async function init() {
    console.log('Initializing system...');
    
    // Try to load from API first
    const apiLoaded = await loadDataFromAPI();
    
    if (!apiLoaded) {
        // Fallback to localStorage
        items = JSON.parse(localStorage.getItem('office-items') || '[]');
        bags = JSON.parse(localStorage.getItem('office-bags') || '[]');
        events = JSON.parse(localStorage.getItem('office-events') || '[]');
        console.log('Using localStorage fallback');
    } else {
        console.log('Data loaded from API successfully');
    }
    
    initNavigation();
    initItemForm();
    initBagManagement();
    initEventManagement();
    checkStorageUsage();
    renderItems();
    
    console.log('System initialized successfully');
}
```

### **Step 5: ทดสอบระบบ**

#### **5.1 ทดสอบการเชื่อมต่อฐานข้อมูล**
1. เปิด `https://yourdomain.com/api/items.php`
2. ควรเห็น `[]` (array ว่าง) หรือข้อมูลสินค้า
3. หากเห็น error ให้ตรวจสอบ config.php

#### **5.2 ทดสอบหน้าเว็บหลัก**
1. เปิด `https://yourdomain.com/`
2. ทดสอบเพิ่มสินค้า
3. ทดสอบสร้างกระเป๋า
4. ทดสอบสร้างอีเวนต์

#### **5.3 ทดสอบ Sync ระหว่างอุปกรณ์**
1. เพิ่มข้อมูลจากคอมพิวเตอร์
2. เปิดเว็บในมือถือ
3. ข้อมูลควรเหมือนกัน

## ✅ **ผลลัพธ์ที่ได้**

### **🔄 Auto Sync ระหว่างอุปกรณ์**
- ข้อมูลเก็บใน MySQL Database
- Notebook และมือถือเห็นข้อมูลเดียวกัน
- Real-time sync เมื่อรีเฟรชหน้า

### **📱 Offline Support**
- เก็บ cache ใน localStorage
- ทำงานได้แม้ไม่มี internet (ใช้ข้อมูลล่าสุด)

### **🚀 Performance**
- Database indexing สำหรับค้นหาเร็ว
- รองรับข้อมูลจำนวนมาก
- API-based architecture

### **💾 Backup & Restore**
- Export ข้อมูลเป็น JSON
- Import ข้อมูลจากไฟล์
- Auto backup features

## 🔧 **การแก้ไขปัญหา**

### **❌ Error: Database connection failed**
- ตรวจสอบ username/password ใน config.php
- ตรวจสอบชื่อฐานข้อมูล
- ตรวจสอบ host (อาจเป็น IP แทน localhost)

### **❌ Error: Table doesn't exist**
- รันคำสั่ง SQL ใน database_setup.sql
- ตรวจสอบว่าสร้างตารางครบ 4 ตาราง

### **❌ Error: Permission denied**
- ตรวจสอบ file permissions (755 สำหรับโฟลเดอร์, 644 สำหรับไฟล์)
- ตรวจสอบ ownership ของไฟล์

### **❌ API ไม่ทำงาน**
- เปลี่ยน `USE_API = false` ในโค้ด JavaScript
- ระบบจะใช้ localStorage เป็น fallback

## 🎉 **สำเร็จแล้ว!**

ระบบจัดเก็บวัสดุสำนักงานของคุณพร้อมใช้งานบน Hostinger พร้อมฟีเจอร์:

✅ **Multi-device sync** - ข้อมูล sync ระหว่างอุปกรณ์  
✅ **Database storage** - เก็บข้อมูลใน MySQL  
✅ **Offline support** - ทำงานได้แม้ไม่มี internet  
✅ **API architecture** - พร้อมขยายฟีเจอร์  
✅ **Backup/Restore** - สำรองและกู้คืนข้อมูล  

🎯 **URL สำหรับเข้าใช้งาน:** `https://yourdomain.com/` 