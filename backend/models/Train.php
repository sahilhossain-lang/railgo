<?php
/**
 * RailGo — Train OOP Model
 * Manages queries across trains, schedules, and stations tables.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/Database.php';

class Train {
    private ?PDO $db;

    public function __construct(?PDO $db = null) {
        try {
            $this->db = $db ?? Database::getConnection();
        } catch (Throwable $e) {
            $this->db = null;
        }
    }

    /**
     * Search trains matching origin, destination and optional filters across
     * both the direct trains catalog and intermediate schedules stops.
     *
     * @param string $from Station code (e.g. NDLS) or name
     * @param string $to Station code (e.g. BCT) or name
     * @param string|null $date Journey date
     * @param string|null $classFilter Travel class (e.g. '3A', '2A')
     * @param string|null $typeFilter Train type (e.g. 'Rajdhani', 'Express')
     * @param string|null $slotFilter Departure slot
     * @return array
     */
    public function search(
        string $from,
        string $to,
        ?string $date = null,
        ?string $classFilter = null,
        ?string $typeFilter = null,
        ?string $slotFilter = null
    ): array {
        $rawFrom = trim($from);
        $rawTo = trim($to);

        $fromCode = strtoupper($rawFrom);
        if (preg_match('/\(([A-Z0-9]+)\)/i', $rawFrom, $m)) {
            $fromCode = strtoupper($m[1]);
        }
        $toCode = strtoupper($rawTo);
        if (preg_match('/\(([A-Z0-9]+)\)/i', $rawTo, $m)) {
            $toCode = strtoupper($m[1]);
        }

        $fromCleanName = strtoupper(trim(preg_replace('/\s*\([A-Z0-9]+\)/i', '', $rawFrom)));
        $toCleanName = strtoupper(trim(preg_replace('/\s*\([A-Z0-9]+\)/i', '', $rawTo)));

        $simplifiedFrom = trim(preg_replace('/\b(JN|JUNCTION|TERMINUS|TERMINAL|CENTRAL|CANTT)\b/i', '', $fromCleanName));
        $simplifiedTo = trim(preg_replace('/\b(JN|JUNCTION|TERMINUS|TERMINAL|CENTRAL|CANTT)\b/i', '', $toCleanName));

        $matchStation = function(string $code, string $name, string $targetCode, string $targetName, string $targetSimple): bool {
            if ($targetCode !== '' && $code === $targetCode) return true;
            if ($targetName !== '' && (str_contains($name, $targetName) || str_contains($targetName, $name))) return true;
            if ($targetSimple !== '' && (str_contains($name, $targetSimple) || str_contains($targetSimple, $name))) return true;
            if ($targetCode !== '' && str_contains($name, $targetCode)) return true;
            return false;
        };

        if ($fromCode === 'MMCT') $fromCode = 'BCT';
        if ($toCode === 'MMCT') $toCode = 'BCT';

        $cleanFrom = $fromCode;
        $cleanTo = $toCode;

        $merged = [];

        // 1. Try MySQL Database if connected
        if ($this->db !== null) {
            try {
                $sqlDirect = "SELECT t.* FROM `trains` t
                              WHERE (t.from_station_code = :from_code OR t.from_station_name LIKE :from_name)
                                AND (t.to_station_code = :to_code OR t.to_station_name LIKE :to_name)";

                $stmt = $this->db->prepare($sqlDirect);
                $stmt->execute([
                    ':from_code' => $fromCode,
                    ':from_name' => "%{$fromCleanName}%",
                    ':to_code'   => $toCode,
                    ':to_name'   => "%{$toCleanName}%"
                ]);
                $directTrains = $stmt->fetchAll();

                $sqlSchedule = "SELECT DISTINCT t.*, s1.departure as sched_dep, s2.arrival as sched_arr,
                                       s1.station_code as sched_from_code, s1.station_name as sched_from_name,
                                       s2.station_code as sched_to_code, s2.station_name as sched_to_name,
                                       s1.day as dep_day, s2.day as arr_day
                                FROM `schedules` s1
                                JOIN `schedules` s2 ON s1.train_number = s2.train_number
                                JOIN `trains` t ON t.number = s1.train_number
                                WHERE (s1.station_code = :from_code OR s1.station_name LIKE :from_name)
                                  AND (s2.station_code = :to_code OR s2.station_name LIKE :to_name)
                                  AND (s2.day > s1.day OR (s2.day = s1.day AND s2.id > s1.id))
                                LIMIT 50";

                $schedStmt = $this->db->prepare($sqlSchedule);
                $schedStmt->execute([
                    ':from_code' => $fromCode,
                    ':from_name' => "%{$fromCleanName}%",
                    ':to_code'   => $toCode,
                    ':to_name'   => "%{$toCleanName}%"
                ]);
                $schedTrains = $schedStmt->fetchAll();

                $seen = [];
                foreach ($directTrains as $t) {
                    $num = $t['number'];
                    if (!isset($seen[$num])) {
                        $seen[$num] = true;
                        $merged[] = $t;
                    }
                }

                foreach ($schedTrains as $t) {
                    $num = $t['number'];
                    if (!isset($seen[$num])) {
                        $seen[$num] = true;
                        if (!empty($t['sched_dep']) && $t['sched_dep'] !== 'None') {
                            $t['departure'] = $t['sched_dep'];
                        }
                        if (!empty($t['sched_arr']) && $t['sched_arr'] !== 'None') {
                            $t['arrival'] = $t['sched_arr'];
                        }
                        $t['journey_from_code'] = $t['sched_from_code'] ?? null;
                        $t['journey_from_name'] = $t['sched_from_name'] ?? null;
                        $t['journey_to_code'] = $t['sched_to_code'] ?? null;
                        $t['journey_to_name'] = $t['sched_to_name'] ?? null;
                        $merged[] = $t;
                    }
                }
            } catch (Throwable $e) {
                // DB error; fall back to JSON datasets
                $merged = [];
            }
        }

        // 2. If DB returned no rows or DB is offline, search trains_index.json and routes
        if (empty($merged)) {
            $trainsFile = __DIR__ . '/../../frontend/assets/trains_index.json';
            if (!file_exists($trainsFile)) {
                $trainsFile = __DIR__ . '/../../database/trains.json';
            }
            if (file_exists($trainsFile)) {
                $raw = json_decode(file_get_contents($trainsFile), true);
                $trainList = $raw['features'] ?? $raw;
                $trainsByNum = [];
                foreach ($trainList as $f) {
                    $p = $f['properties'] ?? $f;
                    $num = (string)($p['number'] ?? '');
                    if ($num !== '') {
                        $p['from_station_code'] = $p['from_station_code'] ?? $p['from_code'] ?? '';
                        $p['from_station_name'] = $p['from_station_name'] ?? $p['from_name'] ?? '';
                        $p['to_station_code'] = $p['to_station_code'] ?? $p['to_code'] ?? '';
                        $p['to_station_name'] = $p['to_station_name'] ?? $p['to_name'] ?? '';
                        $trainsByNum[$num] = $p;
                    }
                }

                // Check routes index for intermediate & direct stop connections
                $routesFile = __DIR__ . '/../../frontend/assets/wb_routes.json';
                $seen = [];
                if (file_exists($routesFile)) {
                    $routes = json_decode(file_get_contents($routesFile), true);
                    foreach ($routes as $tnum => $stops) {
                        $fromStop = null;
                        $toStop = null;
                        foreach ($stops as $idx => $s) {
                            $code = strtoupper($s['code'] ?? '');
                            $name = strtoupper($s['name'] ?? '');
                            $matchF = $matchStation($code, $name, $fromCode, $fromCleanName, $simplifiedFrom);
                            $matchT = $matchStation($code, $name, $toCode, $toCleanName, $simplifiedTo);

                            if ($fromStop === null && $matchF) {
                                $fromStop = array_merge($s, ['idx' => $idx]);
                            } elseif ($fromStop !== null && $matchT) {
                                $toStop = array_merge($s, ['idx' => $idx]);
                                break;
                            }
                        }

                        if ($fromStop !== null && $toStop !== null && isset($trainsByNum[$tnum])) {
                            $t = $trainsByNum[$tnum];
                            if (!empty($fromStop['dep'])) $t['departure'] = $fromStop['dep'];
                            if (!empty($toStop['arr'])) $t['arrival'] = $toStop['arr'];
                            $t['journey_from_code'] = $fromStop['code'];
                            $t['journey_from_name'] = $fromStop['name'];
                            $t['journey_to_code'] = $toStop['code'];
                            $t['journey_to_name'] = $toStop['name'];
                            $merged[] = $t;
                            $seen[$tnum] = true;
                        }
                    }
                }

                // Direct from/to origin/destination terminal check
                foreach ($trainsByNum as $num => $p) {
                    if (isset($seen[$num])) continue;
                    $fCode = strtoupper($p['from_station_code']);
                    $fName = strtoupper($p['from_station_name']);
                    $tCode = strtoupper($p['to_station_code']);
                    $tName = strtoupper($p['to_station_name']);

                    $matchFrom = $matchStation($fCode, $fName, $fromCode, $fromCleanName, $simplifiedFrom);
                    $matchTo = $matchStation($tCode, $tName, $toCode, $toCleanName, $simplifiedTo);

                    if ($matchFrom && $matchTo) {
                        $merged[] = $p;
                        $seen[$num] = true;
                    }
                }
            }
        }

        // Format and filter
        $results = [];
        foreach ($merged as $train) {
            $type = $train['type'] ?: 'Express';

            if ($typeFilter && stripos($type, $typeFilter) === false) {
                continue;
            }

            $depTime = substr((string)$train['departure'], 0, 5);
            $arrTime = substr((string)$train['arrival'], 0, 5);
            $slot = $this->calculateTimeSlot($depTime);

            if ($slotFilter && $slot !== $slotFilter) {
                continue;
            }

            $classes = $this->buildClassesForTrain($train);

            if ($classFilter && $classFilter !== 'all' && !isset($classes[$classFilter])) {
                continue;
            }

            $durH = (int)($train['duration_h'] ?? 0);
            $durM = (int)($train['duration_m'] ?? 0);
            $durationStr = ($durH > 0 ? "{$durH}h " : '') . "{$durM}m";
            if ($durH === 0 && $durM === 0) {
                $durationStr = "12h 45m";
            }

            $results[] = [
                'id'             => $train['number'],
                'name'           => $train['name'],
                'number'         => $train['number'],
                'type'           => $type,
                'category_tag'   => strtoupper($type) . ' · RUNS DAILY',
                'hint'           => $train['zone'] ? "Zone {$train['zone']}" : 'Comfortable journey',
                'from_code'      => $train['journey_from_code'] ?? $train['from_station_code'],
                'from_name'      => $train['journey_from_name'] ?? $train['from_station_name'],
                'to_code'        => $train['journey_to_code'] ?? $train['to_station_code'],
                'to_name'        => $train['journey_to_name'] ?? $train['to_station_name'],
                'departure_time' => $depTime,
                'arrival_time'   => $arrTime,
                'duration'       => $durationStr,
                'departure_slot' => $slot,
                'runs_on'        => 'Daily',
                'next_day'       => ($durH > 12),
                'classes'        => $classes
            ];
        }

        return $results;
    }

    /**
     * Build realistic class inventory based on train coach flags and distance.
     */
    private function buildClassesForTrain(array $train): array {
        $classes = [];
        $dist = (int)($train['distance'] ?? 800);
        if ($dist <= 0) $dist = 850;

        $fare3A = max(650, (int)round($dist * 1.35));
        $fare2A = max(950, (int)round($dist * 1.95));
        $fare1A = max(1600, (int)round($dist * 3.25));
        $fareCC = max(450, (int)round($dist * 1.15));
        $fareSL = max(220, (int)round($dist * 0.48));

        $hasExplicitClass = ($train['third_ac'] || $train['second_ac'] || $train['first_ac'] || $train['chair_car'] || $train['sleeper']);

        if (!$hasExplicitClass || $train['third_ac']) {
            $classes['3A'] = [
                'name'   => '3A · AC 3 tier',
                'fare'   => $fare3A,
                'status' => 'available',
                'seats'  => 42,
                'label'  => '✓ Available · 42'
            ];
        }

        if (!$hasExplicitClass || $train['second_ac']) {
            $classes['2A'] = [
                'name'   => '2A · AC 2 tier',
                'fare'   => $fare2A,
                'status' => 'warning',
                'seats'  => 14,
                'label'  => '◷ Seats left: 14'
            ];
        }

        if ($train['first_ac']) {
            $classes['1A'] = [
                'name'   => '1A · AC 1st Class',
                'fare'   => $fare1A,
                'status' => 'waitlist',
                'seats'  => 6,
                'label'  => '! Waitlist · 6'
            ];
        }

        if ($train['chair_car']) {
            $classes['CC'] = [
                'name'   => 'CC · AC Chair Car',
                'fare'   => $fareCC,
                'status' => 'available',
                'seats'  => 56,
                'label'  => '✓ Available · 56'
            ];
        }

        if (!$hasExplicitClass || $train['sleeper']) {
            $classes['SL'] = [
                'name'   => 'SL · Sleeper Class',
                'fare'   => $fareSL,
                'status' => 'available',
                'seats'  => 84,
                'label'  => '✓ Available · 84'
            ];
        }

        return $classes;
    }

    private function calculateTimeSlot(string $time): string {
        $hour = (int)substr($time, 0, 2);
        if ($hour >= 4 && $hour < 8) return 'early_morning';
        if ($hour >= 8 && $hour < 12) return 'morning';
        if ($hour >= 12 && $hour < 18) return 'afternoon';
        return 'evening';
    }
}
