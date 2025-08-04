# ฟีเจอร์บันทึกกิจกรรม (Activity Logs)

## ภาพรวม
ระบบบันทึกกิจกรรมถูกเพิ่มเข้ามาเพื่อติดตามการเปลี่ยนแปลงต่างๆ ภายในเว็บไซต์ โดยจะบันทึกข้อมูลการทำงานของผู้ใช้ทั้งหมด

## ฟีเจอร์หลัก

### 1. การบันทึกกิจกรรมอัตโนมัติ
- **สร้างข้อมูล**: เมื่อเพิ่มสินค้า กระเป๋า หรืออีเวนต์ใหม่
- **แก้ไขข้อมูล**: เมื่อมีการเปลี่ยนแปลงสถานะหรือข้อมูล
- **ลบข้อมูล**: เมื่อลบสินค้า กระเป๋า หรืออีเวนต์
- **ซิงค์ข้อมูล**: เมื่อมีการซิงค์ข้อมูลกับเซิร์ฟเวอร์

### 2. ข้อมูลที่บันทึก
- **ประเภทกิจกรรม**: สร้าง, แก้ไข, ลบ, ซิงค์
- **ตารางข้อมูล**: items, bags, events, system
- **รายละเอียด**: ข้อมูลเก่าและใหม่
- **ผู้ใช้**: IP Address และ User Agent
- **เวลา**: วันและเวลาที่เกิดกิจกรรม

### 3. หน้าแสดงผล Logs
- **ตัวกรองข้อมูล**: ตามประเภทกิจกรรม, ตารางข้อมูล, วันที่
- **ตารางแสดงผล**: แสดงรายการกิจกรรมทั้งหมด
- **การแบ่งหน้า**: แสดงผลทีละ 20 รายการ
- **การลบข้อมูลเก่า**: ลบ logs ที่มีอายุมากกว่า 30 วัน

## การใช้งาน

### การเข้าถึงหน้า Logs
1. คลิกปุ่ม "บันทึกกิจกรรม" ในเมนูนำทาง
2. ระบบจะแสดงหน้า Logs พร้อมตัวกรองข้อมูล

### การกรองข้อมูล
- **ประเภทกิจกรรม**: เลือกประเภทกิจกรรมที่ต้องการดู
- **ตารางข้อมูล**: เลือกตารางข้อมูลที่ต้องการดู
- **วันที่เริ่มต้น**: เลือกวันที่เริ่มต้น
- **วันที่สิ้นสุด**: เลือกวันที่สิ้นสุด

### การลบข้อมูลเก่า
1. คลิกปุ่ม "ลบข้อมูลเก่า"
2. ยืนยันการลบข้อมูล logs ที่มีอายุมากกว่า 30 วัน

## โครงสร้างฐานข้อมูล

### ตาราง activity_logs
```sql
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(100),
    old_data JSON,
    new_data JSON,
    user_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action (action),
    INDEX idx_table_name (table_name),
    INDEX idx_created_at (created_at)
);
```

## API Endpoints

### GET /api/logs.php
ดึงข้อมูล logs พร้อม filter และ pagination

**Parameters:**
- `page`: หน้าปัจจุบัน (default: 1)
- `limit`: จำนวนรายการต่อหน้า (default: 50)
- `action`: ประเภทกิจกรรม
- `table_name`: ตารางข้อมูล
- `date_from`: วันที่เริ่มต้น
- `date_to`: วันที่สิ้นสุด

**Response:**
```json
{
    "logs": [...],
    "pagination": {
        "page": 1,
        "limit": 50,
        "total": 100,
        "total_pages": 2
    },
    "filters": {
        "actions": ["create", "update", "delete"],
        "tables": ["items", "bags", "events"]
    }
}
```

### POST /api/logs.php
เพิ่ม log entry ใหม่

**Request Body:**
```json
{
    "action": "create",
    "table_name": "items",
    "record_id": "item_123",
    "old_data": null,
    "new_data": {...},
    "user_id": "user_123"
}
```

### DELETE /api/logs.php
ลบ logs เก่า

**Parameters:**
- `days`: จำนวนวันที่ต้องการลบ (default: 30)

## การใช้งานในโค้ด

### การบันทึก Log
```javascript
// บันทึกการสร้างข้อมูล
await LogUtils.logActivity('create', 'items', itemId, null, newData);

// บันทึกการแก้ไขข้อมูล
await LogUtils.logActivity('update', 'items', itemId, oldData, newData);

// บันทึกการลบข้อมูล
await LogUtils.logActivity('delete', 'items', itemId, oldData, null);
```

### การดึงข้อมูล Logs
```javascript
// ดึงข้อมูล logs พร้อม filter
const logs = await LogUtils.getLogs({
    page: 1,
    limit: 20,
    action: 'create',
    table_name: 'items',
    date_from: '2024-01-01',
    date_to: '2024-12-31'
});
```

## ประโยชน์

1. **การติดตาม**: รู้ว่าใครทำอะไร เมื่อไหร่
2. **การตรวจสอบ**: ตรวจสอบการเปลี่ยนแปลงข้อมูล
3. **การแก้ไขปัญหา**: หาสาเหตุของปัญหาได้ง่าย
4. **การรักษาความปลอดภัย**: ตรวจสอบการใช้งานที่ไม่ปกติ
5. **การรายงาน**: สร้างรายงานการใช้งานระบบ

## หมายเหตุ

- ข้อมูล logs จะถูกเก็บไว้เป็นเวลา 30 วัน (สามารถปรับได้)
- การบันทึก logs ไม่กระทบต่อประสิทธิภาพของระบบ
- สามารถปิดการบันทึก logs ได้โดยการลบการเรียกใช้ LogUtils.logActivity() 