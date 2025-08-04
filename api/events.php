<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$pdo = getConnection();

switch ($method) {
    case 'GET':
        handleGetEvents($pdo);
        break;
        
    case 'POST':
        handleCreateEvent($pdo);
        break;
        
    case 'PUT':
        handleUpdateEvent($pdo);
        break;
        
    case 'DELETE':
        // Check if this is a return operation or delete operation
        $action = $_GET['action'] ?? 'return';
        if ($action === 'delete') {
            handleDeleteEvent($pdo);
        } else {
            handleReturnEvent($pdo);
        }
        break;
        
    default:
        sendError('Method not allowed', 405);
}

function handleGetEvents($pdo) {
    try {
        // Get all events with bag count and bag details
        $status = $_GET['status'] ?? null;
        $withBags = $_GET['withBags'] ?? false;
        
        $sql = "
            SELECT e.*, 
                   COUNT(eb.bag_id) as bag_count
            FROM events e 
            LEFT JOIN event_bags eb ON e.id = eb.event_id 
        ";
        
        $params = [];
        if ($status) {
            $sql .= " WHERE e.status = ?";
            $params[] = $status;
        }
        
        $sql .= " GROUP BY e.id ORDER BY e.date DESC, e.time DESC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $events = $stmt->fetchAll();
        
        // If withBags is requested, get bags and items for each event
        if ($withBags) {
            foreach ($events as &$event) {
                // Get bags for this event
                $stmt = $pdo->prepare("
                    SELECT b.*, COUNT(i.id) as item_count
                    FROM event_bags eb
                    JOIN bags b ON eb.bag_id = b.id
                    LEFT JOIN items i ON b.id = i.bag_id
                    WHERE eb.event_id = ?
                    GROUP BY b.id
                    ORDER BY b.name
                ");
                $stmt->execute([$event['id']]);
                $bags = $stmt->fetchAll();
                
                // Get items for each bag
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
                
                $event['bags'] = $bags;
            }
        }
        
        sendResponse($events);
        
    } catch (Exception $e) {
        sendError('Failed to fetch events: ' . $e->getMessage(), 500);
    }
}

function handleCreateEvent($pdo) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data) {
            sendError('Invalid JSON data');
        }
        
        // Validate required fields
        validateInput($data, ['name', 'date', 'time', 'location', 'customer', 'responsible']);
        
        // Generate ID if not provided
        $eventId = $data['id'] ?? generateId();
        
        $pdo->beginTransaction();
        
        try {
            // Insert event
            $stmt = $pdo->prepare("
                INSERT INTO events (id, name, date, time, location, customer, responsible, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $result = $stmt->execute([
                $eventId,
                $data['name'],
                $data['date'],
                $data['time'],
                $data['location'],
                $data['customer'],
                $data['responsible'],
                $data['status'] ?? 'active'
            ]);
            
            if (!$result) {
                throw new Exception('Failed to create event');
            }
            
            // Add bags to event if provided
            if (!empty($data['bagIds']) && is_array($data['bagIds'])) {
                // Validate all bags are available
                $placeholders = str_repeat('?,', count($data['bagIds']) - 1) . '?';
                $stmt = $pdo->prepare("SELECT id, status FROM bags WHERE id IN ($placeholders)");
                $stmt->execute($data['bagIds']);
                $bags = $stmt->fetchAll();
                
                if (count($bags) !== count($data['bagIds'])) {
                    throw new Exception('Some bags not found');
                }
                
                foreach ($bags as $bag) {
                    if ($bag['status'] !== 'available') {
                        throw new Exception("Bag {$bag['id']} is not available");
                    }
                }
                
                // Add bags to event
                $stmt = $pdo->prepare("INSERT INTO event_bags (event_id, bag_id) VALUES (?, ?)");
                foreach ($data['bagIds'] as $bagId) {
                    $stmt->execute([$eventId, $bagId]);
                }
                
                // Update bag status to on-event
                $stmt = $pdo->prepare("UPDATE bags SET status = 'on-event' WHERE id IN ($placeholders)");
                $stmt->execute($data['bagIds']);
                
                // Update items status to on-event
                $stmt = $pdo->prepare("UPDATE items SET status = 'on-event' WHERE bag_id IN ($placeholders)");
                $stmt->execute($data['bagIds']);
            }
            
            $pdo->commit();
            sendResponse([
                'success' => true,
                'id' => $eventId,
                'message' => 'Event created successfully'
            ]);
            
        } catch (Exception $e) {
            $pdo->rollback();
            throw $e;
        }
        
    } catch (Exception $e) {
        sendError('Failed to create event: ' . $e->getMessage(), 500);
    }
}

function handleUpdateEvent($pdo) {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['id'])) {
            sendError('Invalid data or missing ID');
        }
        
        // Check if event exists
        $stmt = $pdo->prepare("SELECT status FROM events WHERE id = ?");
        $stmt->execute([$data['id']]);
        $event = $stmt->fetch();
        
        if (!$event) {
            sendError('Event not found', 404);
        }
        
        // Build dynamic update query
        $fields = [];
        $values = [];
        
        $allowedFields = ['name', 'date', 'time', 'location', 'customer', 'responsible', 'status'];
        
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
        
        $sql = "UPDATE events SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute($values);
        
        if ($result) {
            sendResponse([
                'success' => true,
                'message' => 'Event updated successfully'
            ]);
        } else {
            sendError('Failed to update event', 500);
        }
        
    } catch (Exception $e) {
        sendError('Failed to update event: ' . $e->getMessage(), 500);
    }
}

function handleReturnEvent($pdo) {
    try {
        $id = $_GET['id'] ?? '';
        
        if (empty($id)) {
            sendError('Missing event ID');
        }
        
        $pdo->beginTransaction();
        
        try {
            // Check if event exists
            $stmt = $pdo->prepare("SELECT status FROM events WHERE id = ?");
            $stmt->execute([$id]);
            $event = $stmt->fetch();
            
            if (!$event) {
                $pdo->rollback();
                sendError('Event not found', 404);
            }
            
            if ($event['status'] !== 'active') {
                $pdo->rollback();
                sendError('Event is not active');
            }
            
            // Get bags in this event
            $stmt = $pdo->prepare("SELECT bag_id FROM event_bags WHERE event_id = ?");
            $stmt->execute([$id]);
            $bagIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            if (!empty($bagIds)) {
                // Update items status back to available
                $placeholders = str_repeat('?,', count($bagIds) - 1) . '?';
                $stmt = $pdo->prepare("UPDATE items SET status = 'in-bag' WHERE bag_id IN ($placeholders)");
                $stmt->execute($bagIds);
                
                // Update bag status back to available
                $stmt = $pdo->prepare("UPDATE bags SET status = 'available' WHERE id IN ($placeholders)");
                $stmt->execute($bagIds);
                
                // Remove bags from event
                $stmt = $pdo->prepare("DELETE FROM event_bags WHERE event_id = ?");
                $stmt->execute([$id]);
            }
            
            // Update event status to completed
            $stmt = $pdo->prepare("UPDATE events SET status = 'completed' WHERE id = ?");
            $stmt->execute([$id]);
            
            $pdo->commit();
            sendResponse([
                'success' => true,
                'message' => 'Event items returned successfully'
            ]);
            
        } catch (Exception $e) {
            $pdo->rollback();
            throw $e;
        }
        
    } catch (Exception $e) {
        sendError('Failed to return event items: ' . $e->getMessage(), 500);
    }
}

function handleDeleteEvent($pdo) {
    try {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            sendError('Event ID is required', 400);
        }

        // Start transaction
        $pdo->beginTransaction();
        
        try {
            // Check if event exists
            $stmt = $pdo->prepare("SELECT * FROM events WHERE id = ?");
            $stmt->execute([$id]);
            $event = $stmt->fetch();
            
            if (!$event) {
                sendError('Event not found', 404);
            }
            
            // If event is active, return items first
            if ($event['status'] === 'active') {
                // Get all bags in this event
                $stmt = $pdo->prepare("SELECT bag_id FROM event_bags WHERE event_id = ?");
                $stmt->execute([$id]);
                $eventBags = $stmt->fetchAll(PDO::FETCH_COLUMN);
                
                if (!empty($eventBags)) {
                    // Update items status back to available
                    $placeholders = str_repeat('?,', count($eventBags) - 1) . '?';
                    $stmt = $pdo->prepare("UPDATE items SET status = 'available' WHERE status = 'on-event' AND bag_id IN ($placeholders)");
                    $stmt->execute($eventBags);
                    
                    // Update bag status back to available
                    $stmt = $pdo->prepare("UPDATE bags SET status = 'available' WHERE id IN ($placeholders)");
                    $stmt->execute($eventBags);
                }
            }
            
            // Delete event bags relationships
            $stmt = $pdo->prepare("DELETE FROM event_bags WHERE event_id = ?");
            $stmt->execute([$id]);
            
            // Delete the event
            $stmt = $pdo->prepare("DELETE FROM events WHERE id = ?");
            $stmt->execute([$id]);
            
            $pdo->commit();
            sendResponse([
                'success' => true,
                'message' => 'Event deleted successfully'
            ]);
            
        } catch (Exception $e) {
            $pdo->rollback();
            throw $e;
        }
    } catch (Exception $e) {
        sendError('Failed to delete event: ' . $e->getMessage(), 500);
    }
}
?> 