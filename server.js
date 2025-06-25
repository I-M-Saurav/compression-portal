const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
['uploads', 'compressed', 'decompressed'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

const upload = multer({ dest: 'uploads/' });

app.post('/compress', upload.single('file'), (req, res) => {
  const inputPath = req.file.path;
  const originalName = req.file.originalname;
  const compressedPath = `compressed/${Date.now()}-${originalName}.gz`;

  try {
    const fileData = fs.readFileSync(inputPath);
    const metadata = Buffer.from(JSON.stringify({ filename: originalName }), 'utf-8');
    const metadataLength = Buffer.alloc(4);
    metadataLength.writeUInt32BE(metadata.length, 0);

    const compressedData = zlib.gzipSync(fileData);
    const finalBuffer = Buffer.concat([metadataLength, metadata, compressedData]);

    fs.writeFileSync(compressedPath, finalBuffer);
    fs.unlinkSync(inputPath);

    res.json({
      originalSize: fileData.length,
      compressedSize: finalBuffer.length,
      downloadPath: `/${compressedPath}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Compression failed.');
  }
});

app.post('/decompress', upload.single('file'), (req, res) => {
  const inputPath = req.file.path;

  try {
    const buffer = fs.readFileSync(inputPath);
    const metadataLength = buffer.readUInt32BE(0);
    const metadataBuffer = buffer.slice(4, 4 + metadataLength);
    const compressedData = buffer.slice(4 + metadataLength);

    const meta = JSON.parse(metadataBuffer.toString('utf-8'));
    const filename = meta.filename || 'decompressed-file.bin';

    const decompressed = zlib.gunzipSync(compressedData);
    const outputPath = path.join('decompressed', `${Date.now()}-${filename}`);
    fs.writeFileSync(outputPath, decompressed);
    fs.unlinkSync(inputPath);

    res.download(outputPath, filename, err => {
      fs.unlinkSync(outputPath);
      if (err) console.error('Download error:', err);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Decompression failed.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
