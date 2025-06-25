# 🗜️ Compression Portal

A web-based portal to compress and decompress `.txt`, `.jpg`, and `.bin` files, built with **Node.js**, **Express**, and a simple web frontend. This project demonstrates file upload handling, custom compression logic, and user-friendly interaction over the browser.

---

## 📦 Features

- ✅ Upload `.txt`, `.jpg`, or `.bin` files
- ✅ Compress or decompress uploaded files
- ✅ Clear UI with real-time feedback
- ✅ Fast compression logic implemented in Node.js
- ✅ Download processed files directly
- ✅ File size preview before and after compression

---

## 🏗️ Project Structure

compression-portal/
├── public/ # Static assets (HTML, CSS, JS)
│ ├── index.html
│ ├── style.css
│ └── script.js
├── uploads/ # Temporarily stores uploaded files
├── routes/
│ └── compression.js # Compression/decompression logic
├── utils/
│ └── compressor.js # Helper functions for file processing
├── app.js # Main Express app
├── package.json
└── README.md


---

## 🧰 Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML, CSS, JavaScript
- **File Handling**: `multer` for uploads
- **Compression Logic**: Custom Node.js functions

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/I-M-Saurav/compression-portal.git
   cd compression-portal


🌐 How to Use
Open the web UI.

Choose a file (.txt, .jpg, or .bin) from your system.

Select Compress or Decompress.

Click Submit.

Wait for processing.

Download the result file.

📤 Deployment
You can deploy this on any Node.js-supported platform like:

Render

Railway

Heroku

Vercel (via Node.js API routes)

Example Deployment with Render
Create a new Web Service on Render.

Connect your GitHub repo.

Set build command:

nginx
Copy
Edit
npm install
Set start command:

sql
Copy
Edit
npm start
Add a PORT environment variable (Render automatically sets it, but make sure your app reads it).

✍️ Development Notes
Compression logic is basic and illustrative, not optimized for production.

You can plug in real compression libraries (e.g., zlib, lzma, jpegtran) for better performance.

