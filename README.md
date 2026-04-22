# NexaClinic - Cloud-Based Medical Management System

NexaClinic is a professional, high-performance medical practice management application designed for doctors and clinics. It provides secure patient records, visit history, clinical image management, and administrative oversight.

## 🚀 Features

-   **Secure Authentication**: Google-based login with restricted access control for authorized personnel.
-   **Patient Management**: Register patients, maintain medical history, and store history documents.
-   **Visit Tracking**: Record clinical visits with detailed notes, diagnosis, and attachments.
-   **Multimedia Records**: Support for Clinical Images, Lab Results, and Audio Recordings.
-   **Admin Control**: Comprehensive admin panel to manage authorized doctors and roles.
-   **Multilingual Support**: Arabic and English interface support.
-   **Modern UI**: Sleek, glassmorphism design with Dark and Light mode support.

## 🛠️ Tech Stack

-   **Frontend**: React 19, TypeScript, Vite
-   **Styling**: Tailwind CSS 4, Lucide React (Icons), Motion (Animations)
-   **Backend/DB**: Firebase Firestore & Firebase Authentication
-   **Storage**: Firebase Storage (for medical images and audio)

## 📦 Getting Started

### 1. Requirements

-   Node.js (LTS version)
-   npm or yarn
-   Firebase Account

### 2. Installation

```bash
git clone <your-repo-url>
cd NexaClinic
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory and add your Firebase credentials (refer to `.env.example`):

```env
GEMINI_API_KEY=your_gemini_api_key
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
...
```

### 4. Running the App

```bash
npm run dev
```

## 🔒 Security

This project uses **Attribute-Based Access Control (ABAC)** with Firebase Security Rules. Every document access is validated against the doctor's identity and organizational membership.

---

Built with ❤️ by AI Studio.
