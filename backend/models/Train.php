<?php
/**
 * RailGo — Train OOP Model
 * Manages route search, station lookups, train catalog and class pricing queries.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/Database.php';

class Train {
    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? Database::getConnection();
    }

    /**
     * Search trains matching origin, destination and optional filters.
     *
     * @param string $from Station code (e.g. NDLS) or name
     * @param string $to Station code (e.g. MMCT) or name
     * @param string|null $date Journey date (YYYY-MM-DD)
     * @param string|null $classFilter Travel class (e.g. '3A', '2A')
     * @param string|null $typeFilter Train type (e.g. 'Rajdhani', 'Express')
     * @param string|null $slotFilter Departure slot ('morning', 'afternoon', etc.)
     * @return array List of trains with nested class inventory
     */
    public function search(
        string $from,
        string $to,
        ?string $date = null,
        ?string $classFilter = null,
        ?string $typeFilter = null,
        ?string $slotFilter = null
    ): array {
        $cleanFrom = trim($from);
        $cleanTo = trim($to);

        $sql = "SELECT t.* FROM `trains` t
                WHERE (t.from_code = :from_code OR t.from_name LIKE :from_name)
                  AND (t.to_code = :to_code OR t.to_name LIKE :to_name)";
        $params = [
            ':from_code' => $cleanFrom,
            ':from_name' => "%{$cleanFrom}%",
            ':to_code'   => $cleanTo,
            ':to_name'   => "%{$cleanTo}%",
        ];

        if ($typeFilter) {
            $sql .= " AND t.train_type = :type";
            $params[':type'] = $typeFilter;
        }

        if ($slotFilter) {
            $sql .= " AND t.departure_slot = :slot";
            $params[':slot'] = $slotFilter;
        }

        $sql .= " ORDER BY t.departure_time ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $trains = $stmt->fetchAll();

        // If no direct trains found, fallback to fetching all trains for broad results
        if (empty($trains)) {
            $fallbackStmt = $this->db->query("SELECT * FROM `trains` ORDER BY departure_time ASC LIMIT 6");
            $trains = $fallbackStmt->fetchAll();
        }

        $result = [];
        foreach ($trains as $train) {
            $classes = $this->getSeatsForTrain((int)$train['id']);

            // If a specific class filter was applied and train doesn't have it, skip
            if ($classFilter && !isset($classes[$classFilter])) {
                continue;
            }

            // Format departure and arrival times (H:i)
            $depTime = substr($train['departure_time'], 0, 5);
            $arrTime = substr($train['arrival_time'], 0, 5);

            $result[] = [
                'id'             => (string)$train['id'],
                'name'           => $train['train_name'],
                'number'         => $train['train_number'],
                'type'           => $train['train_type'],
                'category_tag'   => $train['category_tag'],
                'hint'           => $train['hint'],
                'from_code'      => $train['from_code'],
                'from_name'      => $train['from_name'],
                'to_code'        => $train['to_code'],
                'to_name'        => $train['to_name'],
                'departure_time' => $depTime,
                'arrival_time'   => $arrTime,
                'duration'       => $train['duration'],
                'departure_slot' => $train['departure_slot'],
                'runs_on'        => $train['runs_on'],
                'next_day'       => (bool)$train['next_day'],
                'classes'        => $classes
            ];
        }

        return $result;
    }

    /**
     * Retrieve all class seat inventories for a specific train.
     *
     * @param int $trainId
     * @return array
     */
    public function getSeatsForTrain(int $trainId): array {
        $stmt = $this->db->prepare(
            "SELECT class_code, class_name, base_fare, total_seats, available_seats, rac_seats, waitlist_seats
             FROM `train_seats`
             WHERE train_id = :train_id
             ORDER BY base_fare DESC"
        );
        $stmt->execute([':train_id' => $trainId]);
        $rows = $stmt->fetchAll();

        $classes = [];
        foreach ($rows as $row) {
            $code = $row['class_code'];
            $avail = (int)$row['available_seats'];
            $rac = (int)$row['rac_seats'];
            $wl = (int)$row['waitlist_seats'];

            // Determine status and human-readable label matching Figma design
            if ($avail > 10) {
                $status = 'available';
                $label = "✓ Available · {$avail}";
            } elseif ($avail > 0) {
                $status = 'warning';
                $label = "◷ Seats left: {$avail}";
            } elseif ($rac > 0) {
                $status = 'rac';
                $label = "RAC · {$rac}";
            } elseif ($wl > 0) {
                $status = 'waitlist';
                $label = "! Waitlist · {$wl}";
            } else {
                $status = 'soldout';
                $label = "— Sold out";
            }

            $classes[$code] = [
                'name'    => $row['class_name'],
                'fare'    => (float)$row['base_fare'],
                'status'  => $status,
                'seats'   => $avail,
                'label'   => $label,
                'rac'     => $rac,
                'waitlist'=> $wl
            ];
        }

        return $classes;
    }

    /**
     * Get single train record by ID.
     *
     * @param int $id
     * @return array|null
     */
    public function getById(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM `trains` WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $train = $stmt->fetch();
        if (!$train) return null;

        $train['classes'] = $this->getSeatsForTrain($id);
        return $train;
    }

    /**
     * Get single train record by train number.
     *
     * @param string $number
     * @return array|null
     */
    public function getByNumber(string $number): ?array {
        $stmt = $this->db->prepare("SELECT * FROM `trains` WHERE train_number = :number LIMIT 1");
        $stmt->execute([':number' => trim($number)]);
        $train = $stmt->fetch();
        if (!$train) return null;

        $train['classes'] = $this->getSeatsForTrain((int)$train['id']);
        return $train;
    }
}
