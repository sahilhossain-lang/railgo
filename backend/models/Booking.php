<?php
/**
 * RailGo — Booking Engine & Transaction OOP Model
 * Manages atomic InnoDB reservations, SELECT FOR UPDATE locking,
 * unique 10-digit PNR generation, berth assignment and ticket cancellation.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/Database.php';

class Booking {
    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? Database::getConnection();
    }

    /**
     * Book railway ticket atomically with concurrency protection.
     *
     * @param array $payload Validated booking parameters and passenger array
     * @return array Created booking details with PNR and allocated manifest
     * @throws Exception On validation or inventory failure
     */
    public function bookTicket(array $payload): array {
        // 1. Validate train and class
        $trainId = (int)($payload['train_id'] ?? 0);
        $classCode = strtoupper(trim($payload['class_code'] ?? ''));
        $journeyDate = trim($payload['journey_date'] ?? date('Y-m-d', strtotime('+3 days')));
        $userId = !empty($payload['user_id']) ? (int)$payload['user_id'] : null;
        $passengers = $payload['passengers'] ?? [];

        if ($trainId <= 0 || empty($classCode)) {
            throw new InvalidArgumentException("Train ID and travel class are required.");
        }

        // 2. Validate passengers (1 to 6)
        if (!is_array($passengers) || count($passengers) === 0) {
            throw new InvalidArgumentException("At least one passenger is required for booking.");
        }
        if (count($passengers) > 6) {
            throw new InvalidArgumentException("Maximum 6 passengers allowed per booking.");
        }

        $validatedPassengers = [];
        foreach ($passengers as $idx => $p) {
            $name = trim($p['name'] ?? '');
            $age = (int)($p['age'] ?? 0);
            $gender = strtoupper(trim($p['gender'] ?? 'M'));
            $berthPref = trim($p['berth_pref'] ?? 'No Preference');

            if (empty($name) || strlen($name) < 2) {
                throw new InvalidArgumentException("Passenger #" . ($idx + 1) . ": valid name is required.");
            }
            if ($age < 1 || $age > 120) {
                throw new InvalidArgumentException("Passenger #" . ($idx + 1) . ": age must be between 1 and 120.");
            }
            if (!in_array($gender, ['M', 'F', 'O'], true)) {
                $gender = 'M';
            }

            $validatedPassengers[] = [
                'name'       => $name,
                'age'        => $age,
                'gender'     => $gender,
                'berth_pref' => $berthPref
            ];
        }

        $passengerCount = count($validatedPassengers);

        // 3. Begin Atomic InnoDB Transaction
        $this->db->beginTransaction();

        try {
            // Verify train exists
            $trainStmt = $this->db->prepare("SELECT * FROM `trains` WHERE id = :id LIMIT 1");
            $trainStmt->execute([':id' => $trainId]);
            $train = $trainStmt->fetch();

            if (!$train) {
                throw new Exception("Train record not found.");
            }

            // Pessimistic Concurrency Lock: SELECT FOR UPDATE on inventory
            $seatStmt = $this->db->prepare(
                "SELECT id, base_fare, total_seats, available_seats, rac_seats, waitlist_seats
                 FROM `train_seats`
                 WHERE train_id = :train_id AND class_code = :class_code
                 FOR UPDATE"
            );
            $seatStmt->execute([
                ':train_id'   => $trainId,
                ':class_code' => $classCode
            ]);
            $seatRow = $seatStmt->fetch();

            if (!$seatRow) {
                throw new Exception("Class '{$classCode}' is not available on train {$train['train_number']}.");
            }

            $avail = (int)$seatRow['available_seats'];
            $rac = (int)$seatRow['rac_seats'];
            $wl = (int)$seatRow['waitlist_seats'];
            $baseFare = (float)$seatRow['base_fare'];
            $totalFare = $baseFare * $passengerCount;

            // Determine overall booking status & availability
            $bookingStatus = 'Confirmed';
            $seatAllocationStatus = 'Confirmed';

            if ($avail >= $passengerCount) {
                // Fully confirmed booking
                $newAvail = $avail - $passengerCount;
                $updateStmt = $this->db->prepare(
                    "UPDATE `train_seats` SET available_seats = :avail WHERE id = :id"
                );
                $updateStmt->execute([':avail' => $newAvail, ':id' => $seatRow['id']]);
                $bookingStatus = 'Confirmed';
                $seatAllocationStatus = 'Confirmed';
            } elseif ($avail > 0) {
                // Partial confirmed, partial RAC
                $newAvail = 0;
                $remaining = $passengerCount - $avail;
                $newRac = max(0, $rac - $remaining);
                $updateStmt = $this->db->prepare(
                    "UPDATE `train_seats` SET available_seats = 0, rac_seats = :rac WHERE id = :id"
                );
                $updateStmt->execute([':rac' => $newRac, ':id' => $seatRow['id']]);
                $bookingStatus = 'RAC';
            } elseif ($rac >= $passengerCount) {
                // RAC allocation
                $newRac = $rac - $passengerCount;
                $updateStmt = $this->db->prepare(
                    "UPDATE `train_seats` SET rac_seats = :rac WHERE id = :id"
                );
                $updateStmt->execute([':rac' => $newRac, ':id' => $seatRow['id']]);
                $bookingStatus = 'RAC';
                $seatAllocationStatus = 'RAC';
            } elseif ($wl >= $passengerCount) {
                // Waitlist allocation
                $newWl = $wl - $passengerCount;
                $updateStmt = $this->db->prepare(
                    "UPDATE `train_seats` SET waitlist_seats = :wl WHERE id = :id"
                );
                $updateStmt->execute([':wl' => $newWl, ':id' => $seatRow['id']]);
                $bookingStatus = 'Waitlist';
                $seatAllocationStatus = 'Waitlist';
            } else {
                throw new Exception("Regret: Booking capacity reached for this train and class.");
            }

            // 4. Generate Unique 10-Digit PNR
            $pnr = $this->generateUniquePNR();

            // 5. Assign Coach & Seat Numbers
            $coach = $this->resolveCoachName($classCode);

            // 6. Insert Booking Header
            $insertBooking = $this->db->prepare(
                "INSERT INTO `bookings` (pnr, user_id, train_id, class_code, journey_date, total_fare, booking_status, coach, created_at)
                 VALUES (:pnr, :user_id, :train_id, :class_code, :journey_date, :total_fare, :booking_status, :coach, NOW())"
            );
            $insertBooking->execute([
                ':pnr'            => $pnr,
                ':user_id'        => $userId,
                ':train_id'       => $trainId,
                ':class_code'     => $classCode,
                ':journey_date'   => $journeyDate,
                ':total_fare'     => $totalFare,
                ':booking_status' => $bookingStatus,
                ':coach'          => $coach
            ]);

            $bookingId = (int)$this->db->lastInsertId();

            // 7. Insert Passenger Manifest Rows
            $assignedPassengers = [];
            $insertPassenger = $this->db->prepare(
                "INSERT INTO `passengers` (booking_id, name, age, gender, berth_pref, assigned_coach, assigned_seat, assigned_berth, status)
                 VALUES (:booking_id, :name, :age, :gender, :berth_pref, :assigned_coach, :assigned_seat, :assigned_berth, :status)"
            );

            // Calculate starting seat index based on allocated seats
            $startSeat = ((int)$seatRow['total_seats'] - $avail) + 1;

            foreach ($validatedPassengers as $i => $vp) {
                $seatNum = $startSeat + $i;
                $berthType = $this->assignBerthType($classCode, $vp['berth_pref'], $seatNum);
                $pStatus = ($bookingStatus === 'Confirmed') ? 'Confirmed' : $bookingStatus;

                $insertPassenger->execute([
                    ':booking_id'      => $bookingId,
                    ':name'            => $vp['name'],
                    ':age'             => $vp['age'],
                    ':gender'          => $vp['gender'],
                    ':berth_pref'      => $vp['berth_pref'],
                    ':assigned_coach'  => $coach,
                    ':assigned_seat'   => $seatNum,
                    ':assigned_berth'  => $berthType,
                    ':status'          => $pStatus
                ]);

                $assignedPassengers[] = [
                    'name'       => $vp['name'],
                    'age'        => $vp['age'],
                    'gender'     => $vp['gender'],
                    'coach'      => $coach,
                    'seat'       => (string)$seatNum,
                    'berth_pref' => $berthType,
                    'status'     => "✓ {$pStatus}"
                ];
            }

            // Commit Transaction
            $this->db->commit();

            // Return full booking payload matching frontend ticket expectations
            return [
                'pnr'            => $pnr,
                'booking_id'     => $bookingId,
                'train_id'       => (string)$train['id'],
                'train_name'     => $train['train_name'],
                'train_number'   => $train['train_number'],
                'class_code'     => $classCode,
                'class_name'     => $this->resolveClassName($classCode),
                'from_code'      => $train['from_code'],
                'from_name'      => $train['from_name'],
                'to_code'        => $train['to_code'],
                'to_name'        => $train['to_name'],
                'departure_time' => substr($train['departure_time'], 0, 5),
                'departure_date' => date('d M Y', strtotime($journeyDate)),
                'arrival_time'   => substr($train['arrival_time'], 0, 5),
                'arrival_date'   => date('d M Y', strtotime($journeyDate . ($train['next_day'] ? ' +1 day' : ''))),
                'duration'       => $train['duration'],
                'coach'          => $coach,
                'status'         => $bookingStatus,
                'status_label'   => "✓ {$bookingStatus}",
                'booking_date'   => date('d M Y · H:i'),
                'passengers'     => $assignedPassengers,
                'total_fare'     => $totalFare
            ];

        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Retrieve full booking, journey and passenger manifest by 10-digit PNR.
     *
     * @param string $pnr
     * @return array|null
     */
    public function getByPNR(string $pnr): ?array {
        $cleanPnr = trim($pnr);
        if (!preg_match('/^\d{10}$/', $cleanPnr)) {
            return null;
        }

        $sql = "SELECT b.*, t.train_number, t.train_name, t.from_code, t.from_name,
                       t.to_code, t.to_name, t.departure_time, t.arrival_time,
                       t.duration, t.next_day
                FROM `bookings` b
                JOIN `trains` t ON b.train_id = t.id
                WHERE b.pnr = :pnr LIMIT 1";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':pnr' => $cleanPnr]);
        $booking = $stmt->fetch();

        if (!$booking) {
            return null;
        }

        // Fetch passenger manifest
        $pStmt = $this->db->prepare(
            "SELECT name, age, gender, berth_pref, assigned_coach as coach, assigned_seat as seat, assigned_berth, status
             FROM `passengers`
             WHERE booking_id = :booking_id
             ORDER BY id ASC"
        );
        $pStmt->execute([':booking_id' => $booking['id']]);
        $passengers = $pStmt->fetchAll();

        $formattedPassengers = [];
        foreach ($passengers as $p) {
            $formattedPassengers[] = [
                'name'       => $p['name'],
                'age'        => (int)$p['age'],
                'gender'     => $p['gender'],
                'coach'      => $p['coach'],
                'seat'       => (string)$p['seat'],
                'berth_pref' => $p['assigned_berth'] ?: $p['berth_pref'],
                'status'     => ($p['status'] === 'Confirmed') ? '✓ Confirmed' : $p['status']
            ];
        }

        $jDate = $booking['journey_date'];
        $depDateFormatted = date('d M Y', strtotime($jDate));
        $arrDateFormatted = date('d M Y', strtotime($jDate . ($booking['next_day'] ? ' +1 day' : '')));

        return [
            'pnr'            => $booking['pnr'],
            'train_id'       => (string)$booking['train_id'],
            'train_name'     => $booking['train_name'],
            'train_number'   => $booking['train_number'],
            'class_code'     => $booking['class_code'],
            'class_name'     => $this->resolveClassName($booking['class_code']),
            'from_code'      => $booking['from_code'],
            'from_name'      => $booking['from_name'],
            'to_code'        => $booking['to_code'],
            'to_name'        => $booking['to_name'],
            'departure_time' => substr($booking['departure_time'], 0, 5),
            'departure_date' => $depDateFormatted,
            'arrival_time'   => substr($booking['arrival_time'], 0, 5),
            'arrival_date'   => $arrDateFormatted,
            'duration'       => $booking['duration'],
            'coach'          => $booking['coach'],
            'status'         => $booking['booking_status'],
            'status_label'   => ($booking['booking_status'] === 'Confirmed') ? '✓ Confirmed' : $booking['booking_status'],
            'booking_date'   => date('d M Y · H:i', strtotime($booking['created_at'])),
            'passengers'     => $formattedPassengers,
            'total_fare'     => (float)$booking['total_fare']
        ];
    }

    /**
     * Cancel booking atomically and release seats back to train inventory.
     *
     * @param string $pnr
     * @return array
     * @throws Exception
     */
    public function cancel(string $pnr): array {
        $cleanPnr = trim($pnr);
        if (!preg_match('/^\d{10}$/', $cleanPnr)) {
            throw new InvalidArgumentException("A valid 10-digit PNR is required for cancellation.");
        }

        $this->db->beginTransaction();

        try {
            // Lock booking row
            $bStmt = $this->db->prepare(
                "SELECT id, train_id, class_code, booking_status FROM `bookings` WHERE pnr = :pnr FOR UPDATE"
            );
            $bStmt->execute([':pnr' => $cleanPnr]);
            $booking = $bStmt->fetch();

            if (!$booking) {
                throw new Exception("No booking found with PNR {$cleanPnr}.");
            }

            if ($booking['booking_status'] === 'Cancelled') {
                throw new Exception("This booking is already cancelled.");
            }

            // Count passenger count to restore
            $countStmt = $this->db->prepare("SELECT COUNT(*) as cnt FROM `passengers` WHERE booking_id = :bid");
            $countStmt->execute([':bid' => $booking['id']]);
            $passengerCount = (int)$countStmt->fetchColumn();

            // Update booking status
            $updBooking = $this->db->prepare("UPDATE `bookings` SET booking_status = 'Cancelled' WHERE id = :id");
            $updBooking->execute([':id' => $booking['id']]);

            // Update passenger statuses
            $updPass = $this->db->prepare("UPDATE `passengers` SET status = 'Cancelled' WHERE booking_id = :bid");
            $updPass->execute([':bid' => $booking['id']]);

            // Restore available seats in train inventory if was confirmed
            if ($booking['booking_status'] === 'Confirmed') {
                $updSeats = $this->db->prepare(
                    "UPDATE `train_seats` SET available_seats = available_seats + :cnt
                     WHERE train_id = :tid AND class_code = :class_code"
                );
                $updSeats->execute([
                    ':cnt'        => $passengerCount,
                    ':tid'        => $booking['train_id'],
                    ':class_code' => $booking['class_code']
                ]);
            }

            $this->db->commit();

            return [
                'pnr'     => $cleanPnr,
                'status'  => 'Cancelled',
                'message' => "Ticket {$cleanPnr} has been successfully cancelled. Seats released."
            ];

        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Get booking history for a user or recent bookings.
     *
     * @param int|null $userId
     * @param int $limit
     * @return array
     */
    public function getHistory(?int $userId = null, int $limit = 10): array {
        if ($userId) {
            $stmt = $this->db->prepare(
                "SELECT b.pnr, b.journey_date, b.total_fare, b.booking_status, b.coach, b.class_code,
                        t.train_number, t.train_name, t.from_name, t.to_name,
                        (SELECT COUNT(*) FROM passengers WHERE booking_id = b.id) as passenger_count
                 FROM `bookings` b
                 JOIN `trains` t ON b.train_id = t.id
                 WHERE b.user_id = :uid
                 ORDER BY b.created_at DESC
                 LIMIT :limit"
            );
            $stmt->bindValue(':uid', $userId, PDO::PARAM_INT);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
        } else {
            $stmt = $this->db->prepare(
                "SELECT b.pnr, b.journey_date, b.total_fare, b.booking_status, b.coach, b.class_code,
                        t.train_number, t.train_name, t.from_name, t.to_name,
                        (SELECT COUNT(*) FROM passengers WHERE booking_id = b.id) as passenger_count
                 FROM `bookings` b
                 JOIN `trains` t ON b.train_id = t.id
                 ORDER BY b.created_at DESC
                 LIMIT :limit"
            );
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
        }

        return $stmt->fetchAll();
    }

    /**
     * Generate unique 10-digit numeric PNR with collision detection.
     */
    private function generateUniquePNR(): string {
        $checkStmt = $this->db->prepare("SELECT 1 FROM `bookings` WHERE pnr = :pnr LIMIT 1");

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $pnr = (string)random_int(1000000000, 9999999999);
            $checkStmt->execute([':pnr' => $pnr]);
            if (!$checkStmt->fetch()) {
                return $pnr;
            }
        }

        // Fallback with microtime seed if 10 collisions occur
        return substr(str_pad((string)time() . random_int(100, 999), 10, '0', STR_PAD_RIGHT), 0, 10);
    }

    /**
     * Resolve realistic coach codes based on class.
     */
    private function resolveCoachName(string $classCode): string {
        return match ($classCode) {
            '1A'    => 'H1',
            '2A'    => 'A' . random_int(1, 2),
            '3A'    => 'B' . random_int(1, 4),
            'CC'    => 'C' . random_int(1, 3),
            'EC'    => 'E1',
            'SL'    => 'S' . random_int(1, 6),
            '2S'    => 'D' . random_int(1, 4),
            default => 'B4'
        };
    }

    /**
     * Resolve readable class name.
     */
    private function resolveClassName(string $classCode): string {
        return match ($classCode) {
            '1A'    => '1A · AC 1st Class',
            '2A'    => '2A · AC 2 tier',
            '3A'    => '3A · AC 3 tier',
            'CC'    => 'CC · AC Chair Car',
            'EC'    => 'EC · Exec Chair Car',
            'SL'    => 'SL · Sleeper Class',
            '2S'    => '2S · Second Sitting',
            default => "{$classCode} Class"
        };
    }

    /**
     * Assign berth type respecting preference where feasible.
     */
    private function assignBerthType(string $classCode, string $pref, int $seatNum): string {
        if (in_array($classCode, ['CC', 'EC', '2S'], true)) {
            return ($seatNum % 3 === 0) ? 'Window' : 'Aisle';
        }

        $allowed = ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper'];
        if (in_array($pref, $allowed, true)) {
            return $pref;
        }

        // Standard cycle
        $cycle = ['Lower', 'Middle', 'Upper', 'Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper'];
        return $cycle[($seatNum - 1) % count($cycle)];
    }
}
