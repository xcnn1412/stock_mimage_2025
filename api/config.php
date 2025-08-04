<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Database configuration - อัปเดตข้อมูลตามที่ Hostinger ให้
define('DB_HOST', 'localhost');
define('DB_USER', 'u691986363_office_user'); // Username จริงจาก Hostinger
define('DB_PASS', 'n2A0&s6Z'); // รหัสผ่านจริงจาก Hostinger
define('DB_NAME', 'u691986363_office_user'); // Database name จริงจาก Hostinger

// Create connection
function getConnection() {
    try {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Database connection failed',
            'message' => $e->getMessage()
        ]);
        exit;
    }
}

// Utility functions
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

function validateInput($data, $required_fields) {
    foreach ($required_fields as $field) {
        if (!isset($data[$field]) || empty($data[$field])) {
            sendError("Missing required field: $field");
        }
    }
}

// Generate unique ID
function generateId() {
    return uniqid() . '_' . time();
}
?> 