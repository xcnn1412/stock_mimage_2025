# 🗄️ สร้างฐานข้อมูลใน Hostinger สำหรับระบบจัดเก็บวัสดุสำนักงาน

## 🎯 **Overview**
Hostinger รองรับ **MySQL Database** ซึ่งจะแก้ปัญหาการ sync ข้อมูลระหว่างอุปกรณ์ได้อย่างสมบูรณ์

## 📋 **Step-by-Step การสร้างฐานข้อมูล**

### **Step 1: เข้า Hostinger Control Panel**
1. เข้า **hPanel** ของ Hostinger
2. ไปที่ **Databases** → **MySQL Databases**
3. คลิก **"Create Database"**

### **Step 2: สร้างฐานข้อมูล**
```sql
Database Name: office_supply_db
Username: office_user
Password: [สร้างรหัสผ่านที่แข็งแกร่ง]
```

### **Step 3: สร้างตาราง**
เข้า **phpMyAdmin** และรันคำสั่ง SQL นี้:

```sql
-- สร้างตารางสินค้า
CREATE TABLE items (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    purchase_date DATE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    receipt_photo LONGTEXT,
    item_photo LONGTEXT,
    status VARCHAR(50) DEFAULT 'available',
    bag_id VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- สร้างตารางกระเป๋า
CREATE TABLE bags (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    responsible VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- สร้างตารางอีเวนต์
CREATE TABLE events (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    location VARCHAR(500) NOT NULL,
    customer VARCHAR(255) NOT NULL,
    responsible VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- สร้างตารางความสัมพันธ์ระหว่างอีเวนต์และกระเป๋า
CREATE TABLE event_bags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL,
    bag_id VARCHAR(50) NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE
);

-- สร้าง Index เพื่อเพิ่มประสิทธิภาพ
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_bag_id ON items(bag_id);
CREATE INDEX idx_bags_status ON bags(status);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(date);
```

## 🔗 **ข้อมูลการเชื่อมต่อ**

### **Database Configuration**
```javascript
const dbConfig = {
    host: 'localhost',        // หรือ IP ที่ Hostinger ให้
    username: 'office_user',
    password: '[รหัสผ่านที่สร้าง]',
    database: 'office_supply_db',
    port: 3306
};
```

## 🚀 **สร้างไฟล์ Backend API**

### **📁 Structure ที่ต้องสร้าง**
```
📁 public_html/
├── index.html              (Frontend ที่มีอยู่)
├── styles.css
├── 📁 api/
│   ├── config.php          (Database config)
│   ├── items.php           (Items API)
│   ├── bags.php            (Bags API)
│   ├── events.php          (Events API)
│   └── sync.php            (Sync API)
└── 📁 includes/
    └── database.php        (Database connection)
```

### **🔧 config.php**
```php
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Database configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'office_user');
define('DB_PASS', '[รหัสผ่านที่สร้าง]');
define('DB_NAME', 'office_supply_db');

// Create connection
function getConnection() {
    try {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        exit;
    }
}
?>
```

### **📦 items.php**
```php
<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getConnection();

switch ($method) {
    case 'GET':
        // Get all items
        $stmt = $pdo->query("SELECT * FROM items ORDER BY created_at DESC");
        echo json_encode($stmt->fetchAll());
        break;
        
    case 'POST':
        // Add new item
        $data = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $pdo->prepare("
            INSERT INTO items (id, name, purchase_date, price, receipt_photo, item_photo, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        
        $result = $stmt->execute([
            $data['id'],
            $data['name'],
            $data['purchaseDate'],
            $data['price'],
            $data['receiptPhoto'] ?? null,
            $data['itemPhoto'] ?? null,
            $data['status'] ?? 'available'
        ]);
        
        echo json_encode(['success' => $result]);
        break;
        
    case 'PUT':
        // Update item
        $data = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $pdo->prepare("
            UPDATE items 
            SET name=?, purchase_date=?, price=?, receipt_photo=?, item_photo=?, status=?, bag_id=?
            WHERE id=?
        ");
        
        $result = $stmt->execute([
            $data['name'],
            $data['purchaseDate'],
            $data['price'],
            $data['receiptPhoto'] ?? null,
            $data['itemPhoto'] ?? null,
            $data['status'] ?? 'available',
            $data['bagId'] ?? null,
            $data['id']
        ]);
        
        echo json_encode(['success' => $result]);
        break;
        
    case 'DELETE':
        // Delete item
        $id = $_GET['id'] ?? '';
        $stmt = $pdo->prepare("DELETE FROM items WHERE id = ?");
        $result = $stmt->execute([$id]);
        echo json_encode(['success' => $result]);
        break;
}
?>
```

### **🎒 bags.php**
```php
<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getConnection();

switch ($method) {
    case 'GET':
        // Get all bags with item count
        $stmt = $pdo->query("
            SELECT b.*, 
                   COUNT(i.id) as item_count
            FROM bags b 
            LEFT JOIN items i ON b.id = i.bag_id 
            GROUP BY b.id 
            ORDER BY b.created_at DESC
        ");
        echo json_encode($stmt->fetchAll());
        break;
        
    case 'POST':
        // Add new bag
        $data = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $pdo->prepare("
            INSERT INTO bags (id, name, responsible, status) 
            VALUES (?, ?, ?, ?)
        ");
        
        $result = $stmt->execute([
            $data['id'],
            $data['name'],
            $data['responsible'],
            $data['status'] ?? 'available'
        ]);
        
        echo json_encode(['success' => $result]);
        break;
        
    case 'PUT':
        // Update bag
        $data = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $pdo->prepare("
            UPDATE bags 
            SET name=?, responsible=?, status=?
            WHERE id=?
        ");
        
        $result = $stmt->execute([
            $data['name'],
            $data['responsible'],
            $data['status'],
            $data['id']
        ]);
        
        echo json_encode(['success' => $result]);
        break;
        
    case 'DELETE':
        // Delete bag (only if empty)
        $id = $_GET['id'] ?? '';
        
        // Check if bag has items
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM items WHERE bag_id = ?");
        $stmt->execute([$id]);
        $itemCount = $stmt->fetch()['count'];
        
        if ($itemCount > 0) {
            echo json_encode(['error' => 'Cannot delete bag with items']);
            exit;
        }
        
        $stmt = $pdo->prepare("DELETE FROM bags WHERE id = ?");
        $result = $stmt->execute([$id]);
        echo json_encode(['success' => $result]);
        break;
}
?>
```

### **🎪 events.php**
```php
<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getConnection();

switch ($method) {
    case 'GET':
        // Get all events with bag count
        $stmt = $pdo->query("
            SELECT e.*, 
                   COUNT(eb.bag_id) as bag_count
            FROM events e 
            LEFT JOIN event_bags eb ON e.id = eb.event_id 
            GROUP BY e.id 
            ORDER BY e.date DESC, e.time DESC
        ");
        echo json_encode($stmt->fetchAll());
        break;
        
    case 'POST':
        // Add new event
        $data = json_decode(file_get_contents('php://input'), true);
        
        $pdo->beginTransaction();
        
        try {
            // Insert event
            $stmt = $pdo->prepare("
                INSERT INTO events (id, name, date, time, location, customer, responsible, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $data['id'],
                $data['name'],
                $data['date'],
                $data['time'],
                $data['location'],
                $data['customer'],
                $data['responsible'],
                $data['status'] ?? 'active'
            ]);
            
            // Add bags to event
            if (!empty($data['bagIds'])) {
                $stmt = $pdo->prepare("INSERT INTO event_bags (event_id, bag_id) VALUES (?, ?)");
                foreach ($data['bagIds'] as $bagId) {
                    $stmt->execute([$data['id'], $bagId]);
                }
                
                // Update bag status
                $placeholders = str_repeat('?,', count($data['bagIds']) - 1) . '?';
                $stmt = $pdo->prepare("UPDATE bags SET status = 'on-event' WHERE id IN ($placeholders)");
                $stmt->execute($data['bagIds']);
            }
            
            $pdo->commit();
            echo json_encode(['success' => true]);
            
        } catch (Exception $e) {
            $pdo->rollback();
            echo json_encode(['error' => $e->getMessage()]);
        }
        break;
        
    case 'DELETE':
        // Return items from event
        $id = $_GET['id'] ?? '';
        
        $pdo->beginTransaction();
        
        try {
            // Get bags in this event
            $stmt = $pdo->prepare("SELECT bag_id FROM event_bags WHERE event_id = ?");
            $stmt->execute([$id]);
            $bagIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            if (!empty($bagIds)) {
                // Update bag status back to available
                $placeholders = str_repeat('?,', count($bagIds) - 1) . '?';
                $stmt = $pdo->prepare("UPDATE bags SET status = 'available' WHERE id IN ($placeholders)");
                $stmt->execute($bagIds);
                
                // Update item status back to available
                $stmt = $pdo->prepare("UPDATE items SET status = 'available' WHERE bag_id IN ($placeholders)");
                $stmt->execute($bagIds);
            }
            
            // Delete event
            $stmt = $pdo->prepare("DELETE FROM events WHERE id = ?");
            $stmt->execute([$id]);
            
            $pdo->commit();
            echo json_encode(['success' => true]);
            
        } catch (Exception $e) {
            $pdo->rollback();
            echo json_encode(['error' => $e->getMessage()]);
        }
        break;
}
?>
```

## 🔄 **ปรับ Frontend ให้เชื่อมต่อ API**

### **JavaScript API Functions**
```javascript
// เพิ่มใน index.html
const API_BASE = '/api';

// API Helper functions
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
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
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
    returnItems: (id) => apiRequest(`/events.php?id=${id}`, {
        method: 'DELETE'
    })
};
```

## 🎯 **ขั้นตอนการ Deploy**

### **1. Upload ไฟล์**
```
📁 public_html/
├── index.html              ← Frontend ที่มีอยู่
├── styles.css
├── 📁 api/                 ← สร้างใหม่
│   ├── config.php
│   ├── items.php
│   ├── bags.php
│   └── events.php
```

### **2. เปลี่ยน Frontend**
- ปรับ `saveToLocalStorage()` ให้เป็น API calls
- ปรับ `loadData()` ให้โหลดจาก API
- เพิ่ม error handling สำหรับ network issues

### **3. ทดสอบ**
- ทดสอบการเพิ่ม/ลบ/แก้ไข
- ทดสอบ sync ระหว่างอุปกรณ์
- ทดสอบการทำงานแบบ offline

## ✅ **ผลลัพธ์ที่ได้**

### **🔄 Auto Sync ระหว่างอุปกรณ์**
- ข้อมูลเก็บใน MySQL Database
- ทุกอุปกรณ์ดูข้อมูลเดียวกัน
- Real-time sync เมื่อมี internet

### **📱 Offline Support**
- เก็บ cache ใน localStorage เมื่อ offline
- Sync อัตโนมัติเมื่อ online กลับมา

### **🚀 Performance**
- Database indexing สำหรับค้นหาเร็ว
- Image optimization ใน MySQL
- Backup & restore ง่าย

## 🎪 **ต้องการให้ช่วยสร้างไหม?**

ฉันสามารถสร้างไฟล์ PHP API ทั้งหมดและปรับ Frontend ให้พร้อมใช้งานได้เลย!

**ตอบ "ใช่" หากต้องการให้ฉันสร้างไฟล์ทั้งหมด** 🚀 