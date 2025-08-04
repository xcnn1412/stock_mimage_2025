<?php
// Example: ตัวอย่างการตั้งค่าฐานข้อมูลใน Hostinger
// คัดลอกข้อมูลจาก hPanel มาใส่ตรงนี้

// ===== ตัวอย่างที่ 1: Host เป็น localhost =====
define('DB_HOST', 'localhost');
define('DB_USER', 'office_user');
define('DB_PASS', 'n2A0&s6Z');
define('DB_NAME', 'office_supply_db');

// ===== ตัวอย่างที่ 2: Host เป็น IP (บางครั้ง Hostinger ใช้ IP) =====
// define('DB_HOST', '185.xxx.xxx.xxx');  // เปลี่ยนเป็น IP จริงจาก hPanel
// define('DB_USER', 'u123456789_office');  // ชื่อ user อาจมี prefix
// define('DB_PASS', 'n2A0&s6Z');
// define('DB_NAME', 'u123456789_office_supply');  // ชื่อ database อาจมี prefix

// ===== ตัวอย่างที่ 3: Host เป็น subdomain =====
// define('DB_HOST', 'mysql.yourdomain.com');
// define('DB_USER', 'office_user');
// define('DB_PASS', 'n2A0&s6Z');
// define('DB_NAME', 'office_supply_db');

/*
วิธีหาข้อมูลที่ถูกต้อง:
1. เข้า Hostinger hPanel
2. ไปที่ "Databases" → "MySQL Databases"
3. คลิกที่ฐานข้อมูลที่สร้าง
4. ดูข้อมูล: Hostname, Database name, Username
5. นำมาแก้ไขใน api/config.php
*/
?> 