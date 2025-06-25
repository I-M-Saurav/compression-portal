const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve everything in /public as static assets
app.use(express.static(path.join(__dirname, 'public')));

// Ensure storage dirs exist
['uploads', 'compressed', 'decompressed'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

const upload = multer({ dest: 'uploads/' });

/**
 * POST /compress
 * Wraps the original file in:
 * [4-byte metadata length][metadata JSON][gzip(data)]
 */
app.post('/compress', upload.single('file'), (req, res) => {
  const inputPath    = req.file.path;
  const originalName = req.file.originalname;
  const outPath      = path.join('compressed', `${Date.now()}-${originalName}.gz`);

  try {
    const fileData      = fs.readFileSync(inputPath);
    const metadata      = Buffer.from(JSON.stringify({ filename: originalName }), 'utf-8');
    const metaLenBuf    = Buffer.alloc(4);
    metaLenBuf.writeUInt32BE(metadata.length, 0);

    const gzipData      = zlib.gzipSync(fileData);
    const finalBuffer   = Buffer.concat([metaLenBuf, metadata, gzipData]);

    fs.writeFileSync(outPath, finalBuffer);
    fs.unlinkSync(inputPath);

    res.json({
      originalSize:  fileData.length,
      compressedSize: finalBuffer.length,
      downloadPath: `/${outPath}`
    });
  } catch (err) {
    console.error('Compression error:', err);
    res.status(500).send('Compression failed.');
  }
});

/**
 * POST /decompress
 * Tries to parse our custom header. If that fails,
 * assumes the entire upload is a standard gzip.
 */
app.post('/decompress', upload.single('file'), (req, res) => {
  const inputPath = req.file.path;

  try {
    const buffer = fs.readFileSync(inputPath);
    
    // Ensure the file is actually a valid GZIP by checking for the proper header
    const isGzip = buffer.slice(0, 3).toString('hex') === '1f8b08'; // GZIP header check
    
    if (!isGzip) {
      return res.status(400).send('File is not a valid GZIP file.');
    }

    let compressedData;
    let filename;

    // Attempt to extract our metadata header if present
    try {
      const metaLen = buffer.readUInt32BE(0);
      const metaBuf = buffer.slice(4, 4 + metaLen);
      const meta = JSON.parse(metaBuf.toString('utf-8'));

      filename = meta.filename || req.file.originalname.replace(/\.gz$/, '');
      compressedData = buffer.slice(4 + metaLen);
    } catch (err) {
      // If no metadata, treat the file as a standard .gz file
      compressedData = buffer;
      filename = req.file.originalname.replace(/\.gz$/, '');
    }

    // Perform decompression
    const decompressed = zlib.gunzipSync(compressedData);
    const outPath = path.join('decompressed', `${Date.now()}-${filename}`);
    fs.writeFileSync(outPath, decompressed);
    fs.unlinkSync(inputPath);

    res.download(outPath, filename, err => {
      fs.unlinkSync(outPath);
      if (err) console.error('Download error:', err);
    });
  } catch (err) {
    console.error('Decompression error:', err);
    if (err.code === 'Z_DATA_ERROR') {
      return res.status(500).send('Decompression failed: Incorrect file format or corrupted data.');
    }
    res.status(500).send('Decompression failed.');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
