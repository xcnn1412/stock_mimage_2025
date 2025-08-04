<?php
require_once 'config.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$pdo = getConnection();

// Create logs table if not exists
$createTableSQL = "
CREATE TABLE IF NOT EXISTS activity_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

try {
    $pdo->exec($createTableSQL);
} catch (PDOException $e) {
    sendError("Failed to create logs table: " . $e->getMessage());
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Get logs with filtering and pagination
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $action = isset($_GET['action']) ? $_GET['action'] : '';
        $table_name = isset($_GET['table_name']) ? $_GET['table_name'] : '';
        $date_from = isset($_GET['date_from']) ? $_GET['date_from'] : '';
        $date_to = isset($_GET['date_to']) ? $_GET['date_to'] : '';
        
        $offset = ($page - 1) * $limit;
        
        $whereConditions = [];
        $params = [];
        
        if ($action) {
            $whereConditions[] = "action = ?";
            $params[] = $action;
        }
        
        if ($table_name) {
            $whereConditions[] = "table_name = ?";
            $params[] = $table_name;
        }
        
        if ($date_from) {
            $whereConditions[] = "DATE(created_at) >= ?";
            $params[] = $date_from;
        }
        
        if ($date_to) {
            $whereConditions[] = "DATE(created_at) <= ?";
            $params[] = $date_to;
        }
        
        $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";
        
        // Get total count
        $countSQL = "SELECT COUNT(*) as total FROM activity_logs $whereClause";
        $countStmt = $pdo->prepare($countSQL);
        $countStmt->execute($params);
        $totalCount = $countStmt->fetch()['total'];
        
        // Get logs
        $sql = "SELECT * FROM activity_logs $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $logs = $stmt->fetchAll();
        
        // Get unique actions and table names for filters
        $actionsSQL = "SELECT DISTINCT action FROM activity_logs ORDER BY action";
        $actionsStmt = $pdo->query($actionsSQL);
        $actions = $actionsStmt->fetchAll(PDO::FETCH_COLUMN);
        
        $tablesSQL = "SELECT DISTINCT table_name FROM activity_logs ORDER BY table_name";
        $tablesStmt = $pdo->query($tablesSQL);
        $tables = $tablesStmt->fetchAll(PDO::FETCH_COLUMN);
        
        sendResponse([
            'logs' => $logs,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $totalCount,
                'total_pages' => ceil($totalCount / $limit)
            ],
            'filters' => [
                'actions' => $actions,
                'tables' => $tables
            ]
        ]);
        break;
        
    case 'POST':
        // Add new log entry
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            sendError("Invalid JSON input");
        }
        
        $required_fields = ['action', 'table_name'];
        validateInput($input, $required_fields);
        
        $sql = "INSERT INTO activity_logs (action, table_name, record_id, old_data, new_data, user_id, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $input['action'],
            $input['table_name'],
            $input['record_id'] ?? null,
            isset($input['old_data']) ? json_encode($input['old_data']) : null,
            isset($input['new_data']) ? json_encode($input['new_data']) : null,
            $input['user_id'] ?? null,
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
        
        sendResponse([
            'message' => 'Log entry created successfully',
            'id' => $pdo->lastInsertId()
        ], 201);
        break;
        
    case 'DELETE':
        // Clear old logs (optional - for maintenance)
        $days = isset($_GET['days']) ? (int)$_GET['days'] : 30;
        
        $sql = "DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$days]);
        
        sendResponse([
            'message' => 'Old logs cleared successfully',
            'deleted_count' => $stmt->rowCount()
        ]);
        break;
        
    default:
        sendError("Method not allowed", 405);
        break;
}
?> 