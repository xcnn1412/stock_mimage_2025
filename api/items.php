<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getConnection();

switch ($method) {
    case 'GET':
        handleGetItems($pdo);
        break;
        
    case 'POST':
        handleCreateItem($pdo);
        break;
        
    case 'PUT':
        handleUpdateItem($pdo);
        break;
        
    case 'DELETE':
        handleDeleteItem($pdo);
        break;
        
    default:
        sendError('Method not allowed', 405);
}

function handleGetItems($pdo) {
    try {
        // Get all items with optional filtering
        $status = $_GET['status'] ?? null;
        $bagId = $_GET['bagId'] ?? null;
        
        $sql = "SELECT * FROM items WHERE 1=1";
        $params = [];
        
        if ($status) {
            $sql .= " AND status = ?";
            $params[] = $status;
        }
        
        if ($bagId) {
            $sql .= " AND bag_id = ?";
            $params[] = $bagId;
        }
        
        $sql .= " ORDER BY created_at DESC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();
        
        // Convert date fields for frontend compatibility
        foreach ($items as &$item) {
            if ($item['purchase_date']) {
                $item['purchaseDate'] = $item['purchase_date'];
            }
            if ($item['receipt_photo']) {
                $item['receiptPhoto'] = $item['receipt_photo'];
            }
            if ($item['item_photo']) {
                $item['itemPhoto'] = $item['item_photo'];
            }
            if ($item['bag_id']) {
                $item['bagId'] = $item['bag_id'];
            }
        }
        
        sendResponse($items);
        
    } catch (Exception $e) {
        sendError('Failed to fetch items: ' . $e->getMessage(), 500);
    }
}

function handleCreateItem($pdo) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data) {
            sendError('Invalid JSON data');
        }
        
        // Validate required fields
        validateInput($data, ['name', 'purchaseDate', 'price']);
        
        // Generate ID if not provided
        $itemId = $data['id'] ?? generateId();
        
        $stmt = $pdo->prepare("
            INSERT INTO items (id, name, purchase_date, price, receipt_photo, item_photo, status, bag_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $result = $stmt->execute([
            $itemId,
            $data['name'],
            $data['purchaseDate'],
            $data['price'],
            $data['receiptPhoto'] ?? null,
            $data['itemPhoto'] ?? null,
            $data['status'] ?? 'available',
            $data['bagId'] ?? null
        ]);
        
        if ($result) {
            sendResponse([
                'success' => true,
                'id' => $itemId,
                'message' => 'Item created successfully'
            ]);
        } else {
            sendError('Failed to create item', 500);
        }
        
    } catch (Exception $e) {
        sendError('Failed to create item: ' . $e->getMessage(), 500);
    }
}

function handleUpdateItem($pdo) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['id'])) {
            sendError('Invalid data or missing ID');
        }
        
        // Build dynamic update query
        $fields = [];
        $values = [];
        
        $allowedFields = ['name', 'purchaseDate' => 'purchase_date', 'price', 'receiptPhoto' => 'receipt_photo', 
                         'itemPhoto' => 'item_photo', 'status', 'bagId' => 'bag_id'];
        
        foreach ($allowedFields as $frontendField => $dbField) {
            $field = is_numeric($frontendField) ? $dbField : $frontendField;
            $dbColumn = is_numeric($frontendField) ? $dbField : $dbField;
            
            if (isset($data[$field])) {
                $fields[] = "$dbColumn = ?";
                $values[] = $data[$field];
            }
        }
        
        if (empty($fields)) {
            sendError('No fields to update');
        }
        
        $values[] = $data['id']; // Add ID for WHERE clause
        
        $sql = "UPDATE items SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute($values);
        
        if ($result) {
            sendResponse([
                'success' => true,
                'message' => 'Item updated successfully'
            ]);
        } else {
            sendError('Failed to update item', 500);
        }
        
    } catch (Exception $e) {
        sendError('Failed to update item: ' . $e->getMessage(), 500);
    }
}

function handleDeleteItem($pdo) {
    try {
        $id = $_GET['id'] ?? '';
        
        if (empty($id)) {
            sendError('Missing item ID');
        }
        
        // Check if item exists and get its status
        $stmt = $pdo->prepare("SELECT status, bag_id FROM items WHERE id = ?");
        $stmt->execute([$id]);
        $item = $stmt->fetch();
        
        if (!$item) {
            sendError('Item not found', 404);
        }
        
        // Don't allow deletion if item is in a bag or on event
        if ($item['status'] !== 'available') {
            sendError('Cannot delete item that is not available (currently in bag or on event)');
        }
        
        $stmt = $pdo->prepare("DELETE FROM items WHERE id = ?");
        $result = $stmt->execute([$id]);
        
        if ($result) {
            sendResponse([
                'success' => true,
                'message' => 'Item deleted successfully'
            ]);
        } else {
            sendError('Failed to delete item', 500);
        }
        
    } catch (Exception $e) {
        sendError('Failed to delete item: ' . $e->getMessage(), 500);
    }
}
?> 