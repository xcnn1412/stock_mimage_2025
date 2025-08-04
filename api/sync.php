<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getConnection();

switch ($method) {
    case 'GET':
        handleGetAllData($pdo);
        break;
        
    case 'POST':
        $action = $_GET['action'] ?? '';
        switch ($action) {
            case 'import':
                handleImportData($pdo);
                break;
            case 'export':
                handleExportData($pdo);
                break;
            case 'backup':
                handleBackupData($pdo);
                break;
            case 'restore':
                handleRestoreData($pdo);
                break;
            default:
                sendError('Invalid action');
        }
        break;
        
    case 'DELETE':
        $action = $_GET['action'] ?? '';
        if ($action === 'clear') {
            handleClearAllData($pdo);
        } else {
            sendError('Invalid action');
        }
        break;
        
    default:
        sendError('Method not allowed', 405);
}

function handleGetAllData($pdo) {
    try {
        // Get all data for sync
        $data = [
            'items' => [],
            'bags' => [],
            'events' => [],
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        // Get items
        $stmt = $pdo->query("SELECT * FROM items ORDER BY created_at DESC");
        $items = $stmt->fetchAll();
        
        foreach ($items as &$item) {
            $item['purchaseDate'] = $item['purchase_date'];
            $item['receiptPhoto'] = $item['receipt_photo'];
            $item['itemPhoto'] = $item['item_photo'];
            $item['bagId'] = $item['bag_id'];
        }
        $data['items'] = $items;
        
        // Get bags with item count
        $stmt = $pdo->query("
            SELECT b.*, COUNT(i.id) as item_count
            FROM bags b 
            LEFT JOIN items i ON b.id = i.bag_id 
            GROUP BY b.id 
            ORDER BY b.created_at DESC
        ");
        $data['bags'] = $stmt->fetchAll();
        
        // Get events with bag count
        $stmt = $pdo->query("
            SELECT e.*, COUNT(eb.bag_id) as bag_count
            FROM events e 
            LEFT JOIN event_bags eb ON e.id = eb.event_id 
            GROUP BY e.id 
            ORDER BY e.date DESC, e.time DESC
        ");
        $events = $stmt->fetchAll();
        
        // Get bags for each event
        foreach ($events as &$event) {
            $stmt = $pdo->prepare("SELECT bag_id FROM event_bags WHERE event_id = ?");
            $stmt->execute([$event['id']]);
            $event['bagIds'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }
        $data['events'] = $events;
        
        sendResponse($data);
        
    } catch (Exception $e) {
        sendError('Failed to get sync data: ' . $e->getMessage(), 500);
    }
}

function handleImportData($pdo) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data) {
            sendError('Invalid JSON data');
        }
        
        $pdo->beginTransaction();
        
        $imported = [
            'items' => 0,
            'bags' => 0,
            'events' => 0
        ];
        
        try {
            // Import items
            if (isset($data['items']) && is_array($data['items'])) {
                $stmt = $pdo->prepare("
                    INSERT IGNORE INTO items (id, name, purchase_date, price, receipt_photo, item_photo, status, bag_id) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");
                
                foreach ($data['items'] as $item) {
                    $result = $stmt->execute([
                        $item['id'],
                        $item['name'],
                        $item['purchaseDate'] ?? $item['purchase_date'],
                        $item['price'],
                        $item['receiptPhoto'] ?? $item['receipt_photo'] ?? null,
                        $item['itemPhoto'] ?? $item['item_photo'] ?? null,
                        $item['status'] ?? 'available',
                        $item['bagId'] ?? $item['bag_id'] ?? null
                    ]);
                    if ($result) $imported['items']++;
                }
            }
            
            // Import bags
            if (isset($data['bags']) && is_array($data['bags'])) {
                $stmt = $pdo->prepare("
                    INSERT IGNORE INTO bags (id, name, responsible, status) 
                    VALUES (?, ?, ?, ?)
                ");
                
                foreach ($data['bags'] as $bag) {
                    $result = $stmt->execute([
                        $bag['id'],
                        $bag['name'],
                        $bag['responsible'],
                        $bag['status'] ?? 'available'
                    ]);
                    if ($result) $imported['bags']++;
                }
            }
            
            // Import events
            if (isset($data['events']) && is_array($data['events'])) {
                $eventStmt = $pdo->prepare("
                    INSERT IGNORE INTO events (id, name, date, time, location, customer, responsible, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");
                
                $bagStmt = $pdo->prepare("INSERT IGNORE INTO event_bags (event_id, bag_id) VALUES (?, ?)");
                
                foreach ($data['events'] as $event) {
                    $result = $eventStmt->execute([
                        $event['id'],
                        $event['name'],
                        $event['date'],
                        $event['time'],
                        $event['location'],
                        $event['customer'],
                        $event['responsible'],
                        $event['status'] ?? 'active'
                    ]);
                    
                    if ($result) {
                        $imported['events']++;
                        
                        // Import event bags
                        if (isset($event['bagIds']) && is_array($event['bagIds'])) {
                            foreach ($event['bagIds'] as $bagId) {
                                $bagStmt->execute([$event['id'], $bagId]);
                            }
                        }
                    }
                }
            }
            
            $pdo->commit();
            sendResponse([
                'success' => true,
                'imported' => $imported,
                'message' => 'Data imported successfully'
            ]);
            
        } catch (Exception $e) {
            $pdo->rollback();
            throw $e;
        }
        
    } catch (Exception $e) {
        sendError('Failed to import data: ' . $e->getMessage(), 500);
    }
}

function handleExportData($pdo) {
    try {
        // Export all data in a format suitable for download
        $exportData = [
            'export_info' => [
                'timestamp' => date('Y-m-d H:i:s'),
                'version' => '1.0',
                'source' => 'Office Supply Management System'
            ]
        ];
        
        // Get all data
        $syncData = handleGetAllDataInternal($pdo);
        $exportData = array_merge($exportData, $syncData);
        
        // Set headers for file download
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="office_supply_backup_' . date('Y-m-d_H-i-s') . '.json"');
        
        echo json_encode($exportData, JSON_PRETTY_PRINT);
        exit;
        
    } catch (Exception $e) {
        sendError('Failed to export data: ' . $e->getMessage(), 500);
    }
}

function handleGetAllDataInternal($pdo) {
    // Internal function to get all data without sending response
    $data = [
        'items' => [],
        'bags' => [],
        'events' => []
    ];
    
    // Get items
    $stmt = $pdo->query("SELECT * FROM items ORDER BY created_at DESC");
    $items = $stmt->fetchAll();
    
    foreach ($items as &$item) {
        $item['purchaseDate'] = $item['purchase_date'];
        $item['receiptPhoto'] = $item['receipt_photo'];
        $item['itemPhoto'] = $item['item_photo'];
        $item['bagId'] = $item['bag_id'];
    }
    $data['items'] = $items;
    
    // Get bags
    $stmt = $pdo->query("SELECT * FROM bags ORDER BY created_at DESC");
    $data['bags'] = $stmt->fetchAll();
    
    // Get events
    $stmt = $pdo->query("SELECT * FROM events ORDER BY date DESC, time DESC");
    $events = $stmt->fetchAll();
    
    // Get bags for each event
    foreach ($events as &$event) {
        $stmt = $pdo->prepare("SELECT bag_id FROM event_bags WHERE event_id = ?");
        $stmt->execute([$event['id']]);
        $event['bagIds'] = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
    $data['events'] = $events;
    
    return $data;
}

function handleBackupData($pdo) {
    try {
        $backupData = handleGetAllDataInternal($pdo);
        $backupData['backup_info'] = [
            'timestamp' => date('Y-m-d H:i:s'),
            'type' => 'automatic_backup'
        ];
        
        // Store backup in a backup table or file
        // For simplicity, we'll return the backup data
        sendResponse([
            'success' => true,
            'backup' => $backupData,
            'message' => 'Backup created successfully'
        ]);
        
    } catch (Exception $e) {
        sendError('Failed to create backup: ' . $e->getMessage(), 500);
    }
}

function handleRestoreData($pdo) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data) {
            sendError('Invalid backup data');
        }
        
        // Validate backup data structure
        if (!isset($data['items']) || !isset($data['bags']) || !isset($data['events'])) {
            sendError('Invalid backup data structure');
        }
        
        $pdo->beginTransaction();
        
        try {
            // Clear existing data
            $pdo->exec("DELETE FROM event_bags");
            $pdo->exec("DELETE FROM events");
            $pdo->exec("DELETE FROM items");
            $pdo->exec("DELETE FROM bags");
            
            // Reset auto increment if needed
            $pdo->exec("ALTER TABLE event_bags AUTO_INCREMENT = 1");
            
            // Restore data using import logic
            handleImportDataInternal($pdo, $data);
            
            $pdo->commit();
            sendResponse([
                'success' => true,
                'message' => 'Data restored successfully'
            ]);
            
        } catch (Exception $e) {
            $pdo->rollback();
            throw $e;
        }
        
    } catch (Exception $e) {
        sendError('Failed to restore data: ' . $e->getMessage(), 500);
    }
}

function handleImportDataInternal($pdo, $data) {
    // Internal import function without transaction management
    // Import bags first
    if (isset($data['bags']) && is_array($data['bags'])) {
        $stmt = $pdo->prepare("
            INSERT INTO bags (id, name, responsible, status, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        
        foreach ($data['bags'] as $bag) {
            $stmt->execute([
                $bag['id'],
                $bag['name'],
                $bag['responsible'],
                $bag['status'] ?? 'available',
                $bag['created_at'] ?? date('Y-m-d H:i:s'),
                $bag['updated_at'] ?? date('Y-m-d H:i:s')
            ]);
        }
    }
    
    // Import items
    if (isset($data['items']) && is_array($data['items'])) {
        $stmt = $pdo->prepare("
            INSERT INTO items (id, name, purchase_date, price, receipt_photo, item_photo, status, bag_id, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                $item['bagId'] ?? $item['bag_id'] ?? null,
                $item['created_at'] ?? date('Y-m-d H:i:s'),
                $item['updated_at'] ?? date('Y-m-d H:i:s')
            ]);
        }
    }
    
    // Import events
    if (isset($data['events']) && is_array($data['events'])) {
        $eventStmt = $pdo->prepare("
            INSERT INTO events (id, name, date, time, location, customer, responsible, status, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $bagStmt = $pdo->prepare("INSERT INTO event_bags (event_id, bag_id) VALUES (?, ?)");
        
        foreach ($data['events'] as $event) {
            $eventStmt->execute([
                $event['id'],
                $event['name'],
                $event['date'],
                $event['time'],
                $event['location'],
                $event['customer'],
                $event['responsible'],
                $event['status'] ?? 'active',
                $event['created_at'] ?? date('Y-m-d H:i:s'),
                $event['updated_at'] ?? date('Y-m-d H:i:s')
            ]);
            
            // Import event bags
            if (isset($event['bagIds']) && is_array($event['bagIds'])) {
                foreach ($event['bagIds'] as $bagId) {
                    $bagStmt->execute([$event['id'], $bagId]);
                }
            }
        }
    }
}

function handleClearAllData($pdo) {
    try {
        $pdo->beginTransaction();
        
        try {
            // Clear all tables in correct order
            $pdo->exec("DELETE FROM event_bags");
            $pdo->exec("DELETE FROM events");
            $pdo->exec("DELETE FROM items");
            $pdo->exec("DELETE FROM bags");
            
            // Reset auto increment
            $pdo->exec("ALTER TABLE event_bags AUTO_INCREMENT = 1");
            
            $pdo->commit();
            sendResponse([
                'success' => true,
                'message' => 'All data cleared successfully'
            ]);
            
        } catch (Exception $e) {
            $pdo->rollback();
            throw $e;
        }
        
    } catch (Exception $e) {
        sendError('Failed to clear data: ' . $e->getMessage(), 500);
    }
}
?> 