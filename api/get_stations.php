<?php
/**
 * RailGo — REST API: Station Search & Autocomplete
 * GET /api/get_stations.php?q=delhi
 */

declare(strict_types=1);

require_once __DIR__ . '/../backend/config/config.php';
require_once __DIR__ . '/../backend/config/Database.php';

setRestHeaders();

$query = trim($_GET['q'] ?? $_GET['query'] ?? '');
$limit = min(50, max(5, (int)($_GET['limit'] ?? 25)));

try {
    $db = Database::getConnection();

    if ($query === '') {
        $stmt = $db->prepare(
            "SELECT code, name, state, zone FROM `stations`
             WHERE code IN ('HWH', 'SDAH', 'KOAA', 'SHM', 'KGP', 'NJP', 'ASN', 'DGR', 'BWN', 'MLDT', 'LGL', 'DGHA', 'RPH', 'BHP', 'BDC', 'BLGT', 'ADRA', 'PRR')
             ORDER BY name ASC LIMIT :limit"
        );
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $stations = $stmt->fetchAll();
    } else {
        $cleanQ = "%{$query}%";
        $prefixQ = "{$query}%";
        $stmt = $db->prepare(
            "SELECT code, name, state, zone,
                    CASE
                        WHEN code = :exact THEN 1
                        WHEN code LIKE :prefix THEN 2
                        WHEN name LIKE :prefix THEN 3
                        ELSE 4
                    END as relevance
             FROM `stations`
             WHERE code LIKE :q OR name LIKE :q OR state LIKE :q
             ORDER BY relevance ASC, name ASC
             LIMIT :limit"
        );
        $stmt->bindValue(':exact', strtoupper($query));
        $stmt->bindValue(':prefix', $prefixQ);
        $stmt->bindValue(':q', $cleanQ);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $stations = $stmt->fetchAll();
    }

    sendJsonResponse(true, $stations, count($stations) . ' stations found.');

} catch (Throwable $e) {
    // Fallback to static stations_index.json if DB unavailable
    $staticFile = __DIR__ . '/../frontend/assets/stations_index.json';
    if (file_exists($staticFile)) {
        $all = json_decode(file_get_contents($staticFile), true);
        if ($query !== '') {
            $qLower = strtolower($query);
            $filtered = array_filter($all, fn($s) =>
                str_contains(strtolower($s['name']), $qLower) ||
                str_contains(strtolower($s['code']), $qLower)
            );
            $slice = array_slice(array_values($filtered), 0, $limit);
        } else {
            $slice = array_slice($all, 0, $limit);
        }
        sendJsonResponse(true, $slice, count($slice) . ' stations found (cached).');
    }

    sendJsonResponse(false, [], 'Failed to fetch stations: ' . $e->getMessage(), 500);
}

