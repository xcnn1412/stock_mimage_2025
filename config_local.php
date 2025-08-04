<?php
// 🌩️ Local Development Configuration
// ใช้สำหรับทดสอบการเชื่อมต่อระหว่าง Local และ Cloud

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 🎯 Configuration Settings
class DatabaseConfig {
    // Cloud Database (Hostinger)
    const CLOUD_CONFIG = [
        'host' => 'localhost',
        'user' => 'u691986363_office_user',
        'password' => 'n2A0&s6Z',
        'database' => 'u691986363_office_user',
        'type' => 'cloud'
    ];
    
    // Local Database (XAMPP/MAMP)
    const LOCAL_CONFIG = [
        'host' => 'localhost',
        'user' => 'root',
        'password' => '',  // หรือ 'root' สำหรับ MAMP
        'database' => 'office_supply_local',
        'type' => 'local'
    ];
    
    // Current Environment
    private static $currentEnv = 'local'; // 'local' หรือ 'cloud'
    
    public static function setEnvironment($env) {
        self::$currentEnv = $env;
    }
    
    public static function getCurrentConfig() {
        return self::$currentEnv === 'cloud' ? self::CLOUD_CONFIG : self::LOCAL_CONFIG;
    }
}

// 🔌 Enhanced Database Connection
function getConnection($forceEnv = null) {
    $config = $forceEnv ? 
        ($forceEnv === 'cloud' ? DatabaseConfig::CLOUD_CONFIG : DatabaseConfig::LOCAL_CONFIG) :
        DatabaseConfig::getCurrentConfig();
    
    try {
        $pdo = new PDO(
            "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
            $config['user'],
            $config['password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
        
        // Log successful connection
        error_log("✅ Connected to {$config['type']} database: {$config['database']}");
        
        return $pdo;
    } catch (PDOException $e) {
        error_log("❌ Database connection failed ({$config['type']}): " . $e->getMessage());
        
        http_response_code(500);
        echo json_encode([
            'error' => 'Database connection failed',
            'type' => $config['type'],
            'message' => $e->getMessage()
        ]);
        exit;
    }
}

// 🔄 Cloud-Local Sync Functions
function syncFromCloudToLocal() {
    try {
        // เชื่อมต่อทั้งสอง database
        $cloudDb = getConnection('cloud');
        $localDb = getConnection('local');
        
        // ดึงข้อมูลจาก cloud
        $cloudData = getAllDataFromDb($cloudDb);
        
        // ล้างข้อมูลใน local
        clearAllDataInDb($localDb);
        
        // นำเข้าข้อมูลจาก cloud ไป local
        importDataToDb($localDb, $cloudData);
        
        return [
            'success' => true,
            'message' => 'Sync from cloud to local completed',
            'data' => $cloudData
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => 'Sync failed: ' . $e->getMessage()
        ];
    }
}

function syncFromLocalToCloud() {
    try {
        // เชื่อมต่อทั้งสอง database
        $localDb = getConnection('local');
        $cloudDb = getConnection('cloud');
        
        // ดึงข้อมูลจาก local
        $localData = getAllDataFromDb($localDb);
        
        // Backup cloud data ก่อน
        $cloudBackup = getAllDataFromDb($cloudDb);
        
        // ล้างข้อมูลใน cloud (ระวัง!)
        clearAllDataInDb($cloudDb);
        
        // นำเข้าข้อมูลจาก local ไป cloud
        importDataToDb($cloudDb, $localData);
        
        return [
            'success' => true,
            'message' => 'Sync from local to cloud completed',
            'data' => $localData,
            'backup' => $cloudBackup
        ];
        
    } catch (Exception $e) {
        return [
            'success' => false,
            'error' => 'Sync failed: ' . $e->getMessage()
        ];
    }
}

function getAllDataFromDb($pdo) {
    $data = [];
    
    // Get items
    $stmt = $pdo->query("SELECT * FROM items ORDER BY created_at DESC");
    $items = $stmt->fetchAll();
    
    // Convert field names for compatibility
    foreach ($items as &$item) {
        $item['purchaseDate'] = $item['purchase_date'];
        $item['receiptPhoto'] = $item['receipt_photo'];
        $item['itemPhoto'] = $item['item_photo'];
        $item['bagId'] = $item['bag_id'];
    }
    $data['items'] = $items;
    
    // Get bags
    $stmt = $pdo->query("SELECT * FROM bags ORDER BY created_at DESC");
    $bags = $stmt->fetchAll();
    
    // Add items array to each bag
    foreach ($bags as &$bag) {
        $stmt = $pdo->prepare("SELECT id FROM items WHERE bag_id = ?");
        $stmt->execute([$bag['id']]);
        $bag['items'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
    $data['bags'] = $bags;
    
    // Get events
    $stmt = $pdo->query("SELECT * FROM events ORDER BY date DESC, time DESC");
    $events = $stmt->fetchAll();
    
    // Add bags array to each event
    foreach ($events as &$event) {
        $stmt = $pdo->prepare("SELECT bag_id FROM event_bags WHERE event_id = ?");
        $stmt->execute([$event['id']]);
        $event['bagIds'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $event['bags'] = $event['bagIds']; // For compatibility
    }
    $data['events'] = $events;
    
    return $data;
}

function clearAllDataInDb($pdo) {
    $pdo->beginTransaction();
    
    try {
        // ลำดับการลบต้องถูกต้องเพื่อหลีกเลี่ยง foreign key constraint
        $pdo->exec("DELETE FROM event_bags");
        $pdo->exec("DELETE FROM events");
        $pdo->exec("UPDATE items SET bag_id = NULL");
        $pdo->exec("DELETE FROM bags");
        $pdo->exec("DELETE FROM items");
        
        $pdo->commit();
        
    } catch (Exception $e) {
        $pdo->rollback();
        throw $e;
    }
}

function importDataToDb($pdo, $data) {
    $pdo->beginTransaction();
    
    try {
        // Import items
        if (isset($data['items']) && count($data['items']) > 0) {
            $stmt = $pdo->prepare("
                INSERT INTO items (id, name, purchase_date, price, receipt_photo, item_photo, status, bag_id, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            
            foreach ($data['items'] as $item) {
                $stmt->execute([
                    $item['id'],
                    $item['name'],
                    $item['purchaseDate'] ?? $item['purchase_date'],
                    $item['price'],
                    $item['receiptPhoto'] ?? $item['receipt_photo'] ?? null,
                    $item['itemPhoto'] ?? $item['item_photo'] ?? null,
                    $item['status'] ?? 'available',
                    $item['bagId'] ?? $item['bag_id'] ?? null
                ]);
            }
        }
        
        // Import bags
        if (isset($data['bags']) && count($data['bags']) > 0) {
            $stmt = $pdo->prepare("
                INSERT INTO bags (id, name, responsible, status, created_at, updated_at) 
                VALUES (?, ?, ?, ?, NOW(), NOW())
            ");
            
            foreach ($data['bags'] as $bag) {
                $stmt->execute([
                    $bag['id'],
                    $bag['name'],
                    $bag['responsible'],
                    $bag['status'] ?? 'available'
                ]);
            }
        }
        
        // Import events
        if (isset($data['events']) && count($data['events']) > 0) {
            $stmt = $pdo->prepare("
                INSERT INTO events (id, name, date, time, location, customer, responsible, status, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            
            $eventBagStmt = $pdo->prepare("
                INSERT INTO event_bags (event_id, bag_id) VALUES (?, ?)
            ");
            
            foreach ($data['events'] as $event) {
                $stmt->execute([
                    $event['id'],
                    $event['name'],
                    $event['date'],
                    $event['time'],
                    $event['location'],
                    $event['customer'],
                    $event['responsible'],
                    $event['status'] ?? 'active'
                ]);
                
                // Add event-bag relationships
                if (isset($event['bagIds']) && count($event['bagIds']) > 0) {
                    foreach ($event['bagIds'] as $bagId) {
                        $eventBagStmt->execute([$event['id'], $bagId]);
                    }
                } elseif (isset($event['bags']) && count($event['bags']) > 0) {
                    foreach ($event['bags'] as $bagId) {
                        $eventBagStmt->execute([$event['id'], $bagId]);
                    }
                }
            }
        }
        
        $pdo->commit();
        
    } catch (Exception $e) {
        $pdo->rollback();
        throw $e;
    }
}

// 🧪 Test Connection Function
function testConnection($env = null) {
    $config = $env ? 
        ($env === 'cloud' ? DatabaseConfig::CLOUD_CONFIG : DatabaseConfig::LOCAL_CONFIG) :
        DatabaseConfig::getCurrentConfig();
    
    try {
        $pdo = new PDO(
            "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
            $config['user'],
            $config['password']
        );
        
        // Test query
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = '{$config['database']}'");
        $result = $stmt->fetch();
        
        return [
            'success' => true,
            'type' => $config['type'],
            'database' => $config['database'],
            'tables' => $result['count'],
            'message' => "Connected successfully to {$config['type']} database"
        ];
        
    } catch (PDOException $e) {
        return [
            'success' => false,
            'type' => $config['type'],
            'error' => $e->getMessage()
        ];
    }
}

// 📊 Database Statistics
function getDatabaseStats($env = null) {
    try {
        $pdo = getConnection($env);
        
        $stats = [];
        
        // Count items
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM items");
        $stats['items'] = $stmt->fetch()['count'];
        
        // Count bags
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM bags");
        $stats['bags'] = $stmt->fetch()['count'];
        
        // Count events
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM events");
        $stats['events'] = $stmt->fetch()['count'];
        
        $stats['total'] = $stats['items'] + $stats['bags'] + $stats['events'];
        
        return $stats;
        
    } catch (Exception $e) {
        return [
            'error' => $e->getMessage()
        ];
    }
}

// Utility functions (same as original)
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

function sendError($message, $statusCode = 400) {
    http_response_code($statusCode);
    echo json_encode(['error' => $message]);
    exit;
}

function generateId() {
    return uniqid() . '_' . time();
}

// 🎯 API Endpoints
if (isset($_GET['action'])) {
    switch ($_GET['action']) {
        case 'test-cloud':
            sendResponse(testConnection('cloud'));
            break;
            
        case 'test-local':
            sendResponse(testConnection('local'));
            break;
            
        case 'sync-cloud-to-local':
            sendResponse(syncFromCloudToLocal());
            break;
            
        case 'sync-local-to-cloud':
            sendResponse(syncFromLocalToCloud());
            break;
            
        case 'stats-cloud':
            sendResponse(getDatabaseStats('cloud'));
            break;
            
        case 'stats-local':
            sendResponse(getDatabaseStats('local'));
            break;
            
        case 'get-cloud-data':
            $cloudDb = getConnection('cloud');
            sendResponse(getAllDataFromDb($cloudDb));
            break;
            
        case 'get-local-data':
            $localDb = getConnection('local');
            sendResponse(getAllDataFromDb($localDb));
            break;
            
        default:
            sendError('Invalid action');
    }
}

// Default response
sendResponse([
    'message' => 'Cloud-Local Sync API Ready',
    'available_actions' => [
        'test-cloud',
        'test-local', 
        'sync-cloud-to-local',
        'sync-local-to-cloud',
        'stats-cloud',
        'stats-local',
        'get-cloud-data',
        'get-local-data'
    ]
]);
?>