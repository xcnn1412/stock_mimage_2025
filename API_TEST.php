<?php
// Simple API Test - ทดสอบการเชื่อมต่อ API
// ไฟล์นี้ใช้สำหรับทดสอบ API ก่อน deploy จริง

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Office Supply API Test</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; text-align: center; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { background: #d4edda; border-color: #c3e6cb; color: #155724; }
        .error { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
        .info { background: #d1ecf1; border-color: #bee5eb; color: #0c5460; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
        button:hover { background: #0056b3; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
        .status { font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Office Supply API Test</h1>
        
        <div class="test-section info">
            <h3>📊 ข้อมูลการเชื่อมต่อ</h3>
            <p><strong>Database:</strong> office_supply_db</p>
            <p><strong>Username:</strong> office_user</p>
            <p><strong>Password:</strong> n2A0&s6Z</p>
            <p><strong>Host:</strong> localhost</p>
        </div>

        <div class="test-section">
            <h3>🔧 1. ทดสอบการเชื่อมต่อฐานข้อมูล</h3>
            <div id="db-test">
                <?php
                try {
                    require_once 'api/config.php';
                    $pdo = getConnection();
                    echo '<div class="success"><span class="status">✅ สำเร็จ:</span> เชื่อมต่อฐานข้อมูลได้</div>';
                    
                    // ทดสอบตารางที่จำเป็น
                    $tables = ['items', 'bags', 'events', 'event_bags'];
                    foreach ($tables as $table) {
                        $stmt = $pdo->query("SELECT COUNT(*) FROM $table");
                        $count = $stmt->fetchColumn();
                        echo "<p>📋 ตาราง <strong>$table</strong>: $count รายการ</p>";
                    }
                    
                } catch (Exception $e) {
                    echo '<div class="error"><span class="status">❌ ล้มเหลว:</span> ' . $e->getMessage() . '</div>';
                }
                ?>
            </div>
        </div>

        <div class="test-section">
            <h3>🛠️ 2. ทดสอบ API Endpoints</h3>
            <button onclick="testAPI('items')">ทดสอบ Items API</button>
            <button onclick="testAPI('bags')">ทดสอบ Bags API</button>
            <button onclick="testAPI('events')">ทดสอบ Events API</button>
            <button onclick="testAPI('sync')">ทดสอบ Sync API</button>
            <div id="api-results"></div>
        </div>

        <div class="test-section">
            <h3>📝 3. เพิ่มข้อมูลตัวอย่าง</h3>
            <button onclick="addSampleData()">เพิ่มข้อมูลตัวอย่าง</button>
            <button onclick="clearAllData()">ลบข้อมูลทั้งหมด</button>
            <div id="sample-results"></div>
        </div>

        <div class="test-section">
            <h3>🚀 4. ขั้นตอนต่อไป</h3>
            <p>✅ หาก API ทำงานได้ปกติ สามารถ:</p>
            <ol>
                <li>Upload ไฟล์ทั้งหมดขึ้น Hostinger</li>
                <li>สร้างฐานข้อมูลใน hPanel</li>
                <li>รัน SQL จาก database_setup.sql</li>
                <li>ทดสอบเว็บไซต์จริงได้เลย!</li>
            </ol>
        </div>
    </div>

    <script>
        async function testAPI(endpoint) {
            const resultDiv = document.getElementById('api-results');
            resultDiv.innerHTML = '<p>🔄 กำลังทดสอบ...</p>';
            
            try {
                const response = await fetch(`api/${endpoint}.php`);
                const data = await response.json();
                
                if (response.ok) {
                    resultDiv.innerHTML = `
                        <div class="success">
                            <span class="status">✅ ${endpoint}.php ทำงานได้:</span>
                            <pre>${JSON.stringify(data, null, 2)}</pre>
                        </div>
                    `;
                } else {
                    resultDiv.innerHTML = `
                        <div class="error">
                            <span class="status">❌ ${endpoint}.php ล้มเหลว:</span>
                            <pre>${JSON.stringify(data, null, 2)}</pre>
                        </div>
                    `;
                }
            } catch (error) {
                resultDiv.innerHTML = `
                    <div class="error">
                        <span class="status">❌ Error:</span> ${error.message}
                    </div>
                `;
            }
        }

        async function addSampleData() {
            const resultDiv = document.getElementById('sample-results');
            resultDiv.innerHTML = '<p>🔄 กำลังเพิ่มข้อมูลตัวอย่าง...</p>';
            
            try {
                // เพิ่มสินค้าตัวอย่าง
                const sampleItem = {
                    name: 'ปากกาทดสอบ',
                    purchaseDate: '2024-01-01',
                    price: 25.50,
                    status: 'available'
                };
                
                const itemResponse = await fetch('api/items.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sampleItem)
                });
                
                // เพิ่มกระเป๋าตัวอย่าง
                const sampleBag = {
                    name: 'กระเป๋าทดสอบ',
                    responsible: 'ผู้ทดสอบระบบ',
                    status: 'available'
                };
                
                const bagResponse = await fetch('api/bags.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sampleBag)
                });
                
                if (itemResponse.ok && bagResponse.ok) {
                    resultDiv.innerHTML = '<div class="success"><span class="status">✅ สำเร็จ:</span> เพิ่มข้อมูลตัวอย่างแล้ว</div>';
                } else {
                    resultDiv.innerHTML = '<div class="error"><span class="status">❌ ล้มเหลว:</span> ไม่สามารถเพิ่มข้อมูลได้</div>';
                }
                
            } catch (error) {
                resultDiv.innerHTML = `<div class="error"><span class="status">❌ Error:</span> ${error.message}</div>`;
            }
        }

        async function clearAllData() {
            if (!confirm('แน่ใจหรือไม่ที่จะลบข้อมูลทั้งหมด?')) return;
            
            const resultDiv = document.getElementById('sample-results');
            resultDiv.innerHTML = '<p>🔄 กำลังลบข้อมูล...</p>';
            
            try {
                const response = await fetch('api/sync.php?action=clear', {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    resultDiv.innerHTML = '<div class="success"><span class="status">✅ สำเร็จ:</span> ลบข้อมูลทั้งหมดแล้ว</div>';
                } else {
                    resultDiv.innerHTML = '<div class="error"><span class="status">❌ ล้มเหลว:</span> ไม่สามารถลบข้อมูลได้</div>';
                }
                
            } catch (error) {
                resultDiv.innerHTML = `<div class="error"><span class="status">❌ Error:</span> ${error.message}</div>`;
            }
        }
    </script>
</body>
</html> 