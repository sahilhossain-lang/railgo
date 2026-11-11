# RailGo — XAMPP Setup & Deployment Guide

This guide explains how to run the RailGo Railway Reservation System locally using **XAMPP** (Apache, PHP 8+, MySQL).

---

## 📋 Prerequisites
- **XAMPP** with PHP 8.0+ and MySQL / MariaDB installed (from [https://www.apachefriends.org](https://www.apachefriends.org)).
- Web browser (Chrome, Edge, Firefox, or Safari).

---

## 🚀 Step 1: Copy Project to XAMPP `htdocs`

1. Open your XAMPP installation directory (default: `C:\xampp`).
2. Navigate to the `htdocs` folder: `C:\xampp\htdocs\`.
3. Copy or move the `railway` project folder directly into `htdocs`:
   ```
   C:\xampp\htdocs\railway\
   ```
   *Your folder structure inside `C:\xampp\htdocs\railway\` should look like:*
   ```
   C:\xampp\htdocs\railway\
   ├── api\
   │   ├── search_trains.php
   │   ├── book_ticket.php
   │   ├── check_pnr.php
   │   ├── cancel_ticket.php
   │   ├── booking_history.php
   │   ├── register.php
   │   ├── login.php
   │   ├── logout.php
   │   └── auth_check.php
   ├── backend\
   │   ├── config\
   │   │   ├── config.php
   │   │   └── Database.php
   │   └── models\
   │       ├── Train.php
   │       ├── Booking.php
   │       └── User.php
   ├── database\
   │   └── schema.sql
   ├── frontend\
   │   ├── css\
   │   ├── js\
   │   ├── assets\
   │   ├── index.html
   │   └── pnr.html
   ├── tests\
   └── README.md
   ```

---

## 🗄️ Step 2: Start Services & Import Database

1. Open the **XAMPP Control Panel**.
2. Click **Start** next to **Apache**.
3. Click **Start** next to **MySQL**.
4. Both modules should turn green.
5. In your web browser, navigate to **phpMyAdmin**:
   ```
   http://localhost/phpmyadmin/
   ```
6. Click on the **Import** tab at the top.
7. Click **Choose File** and select:
   ```
   C:\xampp\htdocs\railway\database\schema.sql
   ```
8. Click **Import** (or **Go**) at the bottom.
9. You should see a green success message:
   > *Import has been successfully finished, queries executed.*
10. The `railway_db` database is now created with all tables (`trains`, `train_seats`, `bookings`, `passengers`, `users`) and pre-seeded with realistic Indian Railways routes and the Figma demo PNR `4827361950`.

---

## ⚙️ Step 3: Verify Database Configuration

Open `C:\xampp\htdocs\railway\backend\config\config.php`:
The default settings are configured out of the box for XAMPP:
```php
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'railway_db');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : '');
```
*(If you have set a custom password for your MySQL `root` user, enter it inside `DB_PASS`)*.

---

## 🌐 Step 4: Access the Application

Open your browser and navigate to:
- **Home & Train Search**:
  [http://localhost/railway/frontend/index.html](http://localhost/railway/frontend/index.html)
- **PNR Inquiry & 3D E-Ticket**:
  [http://localhost/railway/frontend/pnr.html](http://localhost/railway/frontend/pnr.html)

---

## 🧪 Step 5: Test Key Features

1. **Train Search**:
   - Origin: `New Delhi (NDLS)`
   - Destination: `Mumbai Central (MMCT)`
   - View live trains: *12952 Mumbai Rajdhani*, *12954 August Kranti*, *12926 Paschim Express*, *20901 Vande Bharat*.
   - Filter by time slots (Morning, Afternoon, Evening) and travel classes (3A, 2A, 1A, SL).

2. **Book a Ticket**:
   - Click on any class (e.g. `3A · ₹1895`).
   - The booking dialog opens. Add 1 to 6 passengers with names, ages, and berth preferences.
   - Click **Confirm Booking (₹...)**.
   - Your booking will be saved in the database, seats will be atomically decremented with `SELECT FOR UPDATE`, and a unique 10-digit PNR will be issued.

3. **Check PNR Status**:
   - Enter `4827361950` (the pre-seeded Figma demo booking) or your newly generated 10-digit PNR.
   - View the 3-stage journey timeline and passenger manifest.
   - Click **Tap to flip ticket** for the pure CSS 3D flip.
   - Click **Print / Save as PDF** to generate an isolated, clean single-page ticket PDF.

4. **Verify Automated Tests**:
   Open a terminal inside the project directory and run:
   ```bash
   php tests/test_backend.php
   ```

