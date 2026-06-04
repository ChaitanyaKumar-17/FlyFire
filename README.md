# 🔥 FireSafetyPro

FireSafetyPro is a comprehensive, multi-platform ecosystem designed to manage, track, and inspect fire safety equipment across various zones. The system streamlines the inspection process using QR code scanning and provides administrators with real-time analytics and management capabilities.

## 🏗 System Architecture

The FireSafetyPro ecosystem is composed of three interconnected parts:
1. **Admin Web Portal**: A web-based React dashboard for managing equipment, users, zones, and viewing system-wide analytics.
2. **Inspector Mobile App**: A cross-platform mobile application (React Native) used by field inspectors to scan equipment QR codes and submit inspection reports.
3. **Java Spring Boot Backend**: A robust REST API providing business logic, role-based access validation, and safe data mutation.
4. **Supabase Integration**: Used for unified PostgreSQL database storage and secure Authentication (JWT & RLS).

## 🚀 Tech Stack

- **Frontend (Web)**: React.js (Vite), TypeScript, CSS
- **Frontend (Mobile)**: React Native (Expo), TypeScript
- **Backend**: Java 21, Spring Boot, Spring Security (OAuth2 Resource Server)
- **Database & Auth**: Supabase (PostgreSQL)

---

## 📋 Prerequisites

Ensure you have the following installed on your machine before setting up the project:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [Java Development Kit (JDK 17)](https://adoptium.net/)
- [Maven](https://maven.apache.org/) (or use the provided Maven Wrapper)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- A [Supabase](https://supabase.com/) account and project.

---

## 🛠 Getting Started

### 1. Database Setup (Supabase)
1. Create a new project in Supabase.
2. Run the provided SQL migration scripts (e.g., `v2_migration.sql`) in the Supabase SQL Editor to set up the `users`, `zones`, `equipment_types`, `devices` (equipment), and `inspections` tables.
3. Obtain your Supabase **Project URL**, **Anon Key**, and **Service Role Key** from the project dashboard.

### 2. Backend Setup (Spring Boot)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Update the `src/main/resources/application.properties` file with your database and Supabase credentials:
   ```properties
   spring.datasource.url=jdbc:postgresql://<SUPABASE_DB_HOST>:5432/postgres
   spring.datasource.username=postgres
   spring.datasource.password=<YOUR_DB_PASSWORD>
   
   spring.security.oauth2.resourceserver.jwt.issuer-uri=https://<YOUR_SUPABASE_PROJECT>.supabase.co/auth/v1
   
   supabase.url=https://<YOUR_SUPABASE_PROJECT>.supabase.co
   supabase.service-role-key=<YOUR_SERVICE_ROLE_KEY>
   ```
3. Build and run the server:
   ```bash
   ./mvnw clean install
   ./mvnw spring-boot:run
   ```
   *The backend will run on `http://localhost:8080`.*

### 3. Admin Web Portal Setup
1. Navigate to the web portal directory:
   ```bash
   cd admin-panel
   ```
2. Create a `.env` file in the root of the `admin-panel` folder:
   ```env
   VITE_SUPABASE_URL=https://<YOUR_SUPABASE_PROJECT>.supabase.co
   VITE_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
   ```
3. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```
   *The portal will be accessible at `http://localhost:5173`.*

### 4. Inspector Mobile App Setup
1. Navigate to the mobile app directory:
   ```bash
   cd inspector-app
   ```
2. Create a `.env` file or update `lib/supabase.ts` with your Supabase URL and Anon Key.
3. Install dependencies and start the Expo server:
   ```bash
   npm install
   npx expo start
   ```
4. Use the **Expo Go** app on your physical device to scan the generated QR code, or press `a` to run on an Android emulator / `i` for an iOS simulator.

---

## 🌟 Key Features

- **Equipment Management**: Register, decommission, and track equipment globally or by specific zones.
- **QR Code Integration**: Every registered piece of equipment generates a unique QR code for instant field scanning.
- **Live Inspection Logs**: Field inspectors scan equipment and submit pass/fail remarks that sync immediately to the admin portal.
- **Role-Based Access Control (RBAC)**:
  - `Super Admin`: Full system access across all zones.
  - `Zonal Admin`: Can manage equipment, users, and view reports *only* within their assigned zone.
  - `Inspector`: Mobile app access for scanning and reporting equipment status.
- **Account Management**: Admins can register, disable, and reinstate staff dynamically.

## 🤝 Contribution
When contributing to this repository, please ensure that any UI text correctly uses the term **"Equipment"** rather than "Device" to maintain nomenclature consistency across the platform.
