-- Office Supply Management System Database Setup
-- สำหรับ Hostinger MySQL Database

-- สร้างตารางสินค้า (Items)
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

-- สร้างตารางกระเป๋า (Bags)
CREATE TABLE bags (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    responsible VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- สร้างตารางอีเวนต์ (Events)
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

-- สร้างตารางความสัมพันธ์ระหว่างอีเวนต์และกระเป๋า (Event-Bag Relationship)
CREATE TABLE event_bags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL,
    bag_id VARCHAR(50) NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_bag (event_id, bag_id)
);

-- สร้าง Index เพื่อเพิ่มประสิทธิภาพการค้นหา
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_bag_id ON items(bag_id);
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_created_at ON items(created_at);

CREATE INDEX idx_bags_status ON bags(status);
CREATE INDEX idx_bags_responsible ON bags(responsible);
CREATE INDEX idx_bags_created_at ON bags(created_at);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_customer ON events(customer);
CREATE INDEX idx_events_responsible ON events(responsible);
CREATE INDEX idx_events_created_at ON events(created_at);

CREATE INDEX idx_event_bags_event_id ON event_bags(event_id);
CREATE INDEX idx_event_bags_bag_id ON event_bags(bag_id);

-- เพิ่ม Foreign Key ระหว่าง items และ bags
ALTER TABLE items 
ADD CONSTRAINT fk_items_bag_id 
FOREIGN KEY (bag_id) REFERENCES bags(id) ON DELETE SET NULL;

-- สร้าง View สำหรับ reporting (ไม่บังคับ)
CREATE VIEW view_items_with_bags AS
SELECT 
    i.*,
    b.name as bag_name,
    b.responsible as bag_responsible,
    b.status as bag_status
FROM items i
LEFT JOIN bags b ON i.bag_id = b.id;

CREATE VIEW view_events_with_bags AS
SELECT 
    e.*,
    COUNT(eb.bag_id) as bag_count,
    GROUP_CONCAT(b.name SEPARATOR ', ') as bag_names
FROM events e
LEFT JOIN event_bags eb ON e.id = eb.event_id
LEFT JOIN bags b ON eb.bag_id = b.id
GROUP BY e.id;

-- เพิ่มข้อมูลตัวอย่าง (ไม่บังคับ)
-- INSERT INTO bags (id, name, responsible) VALUES 
-- ('bag1', 'กระเป๋าทดสอบ 1', 'ผู้ดูแล A'),
-- ('bag2', 'กระเป๋าทดสอบ 2', 'ผู้ดูแล B');

-- INSERT INTO items (id, name, purchase_date, price, status) VALUES
-- ('item1', 'ปากกาทดสอบ', '2024-01-01', 25.00, 'available'),
-- ('item2', 'กระดาษทดสอบ', '2024-01-02', 150.00, 'available');

-- คำสั่งสำหรับ backup ข้อมูล
-- mysqldump -u office_user -p office_supply_db > backup.sql

-- คำสั่งสำหรับ restore ข้อมูล
-- mysql -u office_user -p office_supply_db < backup.sql

-- คำสั่งสำหรับตรวจสอบข้อมูล
-- SELECT COUNT(*) as total_items FROM items;
-- SELECT COUNT(*) as total_bags FROM bags;
-- SELECT COUNT(*) as total_events FROM events;
-- SELECT status, COUNT(*) as count FROM items GROUP BY status;
-- SELECT status, COUNT(*) as count FROM bags GROUP BY status;
-- SELECT status, COUNT(*) as count FROM events GROUP BY status; 