<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getConnection();

switch ($method) {
    case 'GET':
        handleGetBags($pdo);
        break;
        
    case 'POST':
        handleCreateBag($pdo);
        break;
        
    case 'PUT':
        handleUpdateBag($pdo);
        break;
        
    case 'DELETE':
        handleDeleteBag($pdo);
        break;
        
    default:
        sendError('Method not allowed', 405);
}

function handleGetBags($pdo) {
    try {
        // Get all bags with item count and items list
        $status = $_GET['status'] ?? null;
        $withItems = $_GET['withItems'] ?? false;
        
        $sql = "
            SELECT b.*, 
                   COUNT(i.id) as item_count
            FROM bags b 
            LEFT JOIN items i ON b.id = i.bag_id 
        ";
        
        $params = [];
        if ($status) {
            $sql .= " WHERE b.status = ?";
            $params[] = $status;
        }
        
        $sql .= " GROUP BY b.id ORDER BY b.created_at DESC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $bags = $stmt->fetchAll();
        
        // If withItems is requested, get items for each bag
        if ($withItems) {
            foreach ($bags as &$bag) {
                $stmt = $pdo->prepare("SELECT * FROM items WHERE bag_id = ? ORDER BY name");
                $stmt->execute([$bag['id']]);
                $items = $stmt->fetchAll();
                
                // Convert field names for frontend compatibility
                foreach ($items as &$item) {
                    $item['purchaseDate'] = $item['purchase_date'];
                    $item['receiptPhoto'] = $item['receipt_photo'];
                    $item['itemPhoto'] = $item['item_photo'];
                    $item['bagId'] = $item['bag_id'];
                }
                
                $bag['items'] = $items;
            }
        }
        
        sendResponse($bags);
        
    } catch (Exception $e) {
        sendError('Failed to fetch bags: ' . $e->getMessage(), 500);
    }
}

function handleCreateBag($pdo) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data) {
            sendError('Invalid JSON data');
        }
        
        // Validate required fields
        validateInput($data, ['name', 'responsible']);
        
        // Generate ID if not provided
        $bagId = $data['id'] ?? generateId();
        
        $stmt = $pdo->prepare("
            INSERT INTO bags (id, name, responsible, status) 
            VALUES (?, ?, ?, ?)
        ");
        
        $result = $stmt->execute([
            $bagId,
            $data['name'],
            $data['responsible'],
            $data['status'] ?? 'available'
        ]);
        
        if ($result) {
            sendResponse([
                'success' => true,
                'id' => $bagId,
                'message' => 'Bag created successfully'
            ]);
        } else {
            sendError('Failed to create bag', 500);
        }
        
    } catch (Exception $e) {
        sendError('Failed to create bag: ' . $e->getMessage(), 500);
    }
}

function handleUpdateBag($pdo) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['id'])) {
            sendError('Invalid data or missing ID');
        }
        
        // Special handling for adding items to bag
        if (isset($data['action']) && $data['action'] === 'addItem') {
            return handleAddItemToBag($pdo, $data);
        }
        
        // Special handling for removing items from bag
        if (isset($data['action']) && $data['action'] === 'removeItem') {
            return handleRemoveItemFromBag($pdo, $data);
        }
        
        // Regular bag update
        $fields = [];
        $values = [];
        
        $allowedFields = ['name', 'responsible', 'status'];
        
        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $fields[] = "$field = ?";
                $values[] = $data[$field];
            }
        }
        
        if (empty($fields)) {
            sendError('No fields to update');
        }
        
        $values[] = $data['id'];
        
        $sql = "UPDATE bags SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute($values);
        
        if ($result) {
            sendResponse([
                'success' => true,
                'message' => 'Bag updated successfully'
            ]);
        } else {
            sendError('Failed to update bag', 500);
        }
        
    } catch (Exception $e) {
        sendError('Failed to update bag: ' . $e->getMessage(), 500);
    }
}

function handleAddItemToBag($pdo, $data) {
    try {
        if (!isset($data['itemId'])) {
            sendError('Missing itemId');
        }
        
        $pdo->beginTransaction();
        
        // Check if item exists and is available
        $stmt = $pdo->prepare("SELECT status FROM items WHERE id = ?");
        $stmt->execute([$data['itemId']]);
        $item = $stmt->fetch();
        
        if (!$item) {
            $pdo->rollback();
            sendError('Item not found', 404);
        }
        
        if ($item['status'] !== 'available') {
            $pdo->rollback();
            sendError('Item is not available');
        }
        
        // Check if bag exists and is available
        $stmt = $pdo->prepare("SELECT status FROM bags WHERE id = ?");
        $stmt->execute([$data['id']]);
        $bag = $stmt->fetch();
        
        if (!$bag) {
            $pdo->rollback();
            sendError('Bag not found', 404);
        }
        
        if ($bag['status'] !== 'available') {
            $pdo->rollback();
            sendError('Bag is not available (currently on event)');
        }
        
        // Add item to bag
        $stmt = $pdo->prepare("UPDATE items SET bag_id = ?, status = ? WHERE id = ?");
        $result = $stmt->execute([$data['id'], 'in-bag', $data['itemId']]);
        
        if ($result) {
            $pdo->commit();
            sendResponse([
                'success' => true,
                'message' => 'Item added to bag successfully'
            ]);
        } else {
            $pdo->rollback();
            sendError('Failed to add item to bag', 500);
        }
        
    } catch (Exception $e) {
        $pdo->rollback();
        sendError('Failed to add item to bag: ' . $e->getMessage(), 500);
    }
}

function handleRemoveItemFromBag($pdo, $data) {
    try {
        if (!isset($data['itemId'])) {
            sendError('Missing itemId');
        }
        
        $pdo->beginTransaction();
        
        // Check if item belongs to this bag
        $stmt = $pdo->prepare("SELECT bag_id FROM items WHERE id = ?");
        $stmt->execute([$data['itemId']]);
        $item = $stmt->fetch();
        
        if (!$item || $item['bag_id'] !== $data['id']) {
            $pdo->rollback();
            sendError('Item does not belong to this bag');
        }
        
        // Remove item from bag
        $stmt = $pdo->prepare("UPDATE items SET bag_id = NULL, status = 'available' WHERE id = ?");
        $result = $stmt->execute([$data['itemId']]);
        
        if ($result) {
            $pdo->commit();
            sendResponse([
                'success' => true,
                'message' => 'Item removed from bag successfully'
            ]);
        } else {
            $pdo->rollback();
            sendError('Failed to remove item from bag', 500);
        }
        
    } catch (Exception $e) {
        $pdo->rollback();
        sendError('Failed to remove item from bag: ' . $e->getMessage(), 500);
    }
}

function handleDeleteBag($pdo) {
    try {
        $id = $_GET['id'] ?? '';
        
        if (empty($id)) {
            sendError('Missing bag ID');
        }
        
        $pdo->beginTransaction();
        
        // Check if bag exists and get its status
        $stmt = $pdo->prepare("SELECT status FROM bags WHERE id = ?");
        $stmt->execute([$id]);
        $bag = $stmt->fetch();
        
        if (!$bag) {
            $pdo->rollback();
            sendError('Bag not found', 404);
        }
        
        // Don't allow deletion if bag is on event
        if ($bag['status'] === 'on-event') {
            $pdo->rollback();
            sendError('Cannot delete bag that is currently on event');
        }
        
        // Check if bag has items
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM items WHERE bag_id = ?");
        $stmt->execute([$id]);
        $itemCount = $stmt->fetch()['count'];
        
        if ($itemCount > 0) {
            // Remove all items from bag first
            $stmt = $pdo->prepare("UPDATE items SET bag_id = NULL, status = 'available' WHERE bag_id = ?");
            $stmt->execute([$id]);
        }
        
        // Delete bag
        $stmt = $pdo->prepare("DELETE FROM bags WHERE id = ?");
        $result = $stmt->execute([$id]);
        
        if ($result) {
            $pdo->commit();
            sendResponse([
                'success' => true,
                'message' => 'Bag deleted successfully'
            ]);
        } else {
            $pdo->rollback();
            sendError('Failed to delete bag', 500);
        }
        
    } catch (Exception $e) {
        $pdo->rollback();
        sendError('Failed to delete bag: ' . $e->getMessage(), 500);
    }
}
?> 