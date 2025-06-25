const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve everything in /public as static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Ensure storage dirs exist
['uploads', 'compressed', 'decompressed'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure multer with file validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'text/plain',           // .txt files
    'image/jpeg',           // .jpg, .jpeg files
    'image/jpg',            // .jpg files
    'application/octet-stream', // .bin files and other binary files
    'application/x-binary',  // binary files
    'application/binary'     // binary files
  ];
  
  // Check file extension as additional validation
  const allowedExtensions = ['.txt', '.jpg', '.jpeg', '.bin'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: txt, jpg, jpeg, bin. Received: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// POST /compress - Compress a file
app.post('/compress', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  const originalName = req.file.originalname;
  const timestamp = Date.now();
  const outPath = path.join('compressed', `${timestamp}-${originalName}.gz`);

  try {
    console.log(`Compressing file: ${originalName}`);
    
    // Read the original file
    const fileData = fs.readFileSync(inputPath);
    console.log(`Original file size: ${fileData.length} bytes`);
    
    // Create metadata object
    const metadata = {
      filename: originalName,
      originalSize: fileData.length,
      timestamp: timestamp,
      mimetype: req.file.mimetype
    };
    
    // Convert metadata to buffer
    const metadataJson = JSON.stringify(metadata);
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    const metadataLengthBuffer = Buffer.alloc(4);
    metadataLengthBuffer.writeUInt32BE(metadataBuffer.length, 0);
    
    // Compress the file data
    const compressedData = zlib.gzipSync(fileData);
    console.log(`Compressed data size: ${compressedData.length} bytes`);
    
    // Combine metadata length + metadata + compressed data
    const finalBuffer = Buffer.concat([
      metadataLengthBuffer,
      metadataBuffer,
      compressedData
    ]);
    
    // Write the final compressed file
    fs.writeFileSync(outPath, finalBuffer);
    
    // Clean up temporary upload file
    fs.unlinkSync(inputPath);
    
    console.log(`Compression completed. Final size: ${finalBuffer.length} bytes`);
    
    res.json({
      success: true,
      originalSize: fileData.length,
      compressedSize: finalBuffer.length,
      compressionRatio: ((1 - finalBuffer.length / fileData.length) * 100).toFixed(2) + '%',
      downloadPath: `/compressed/${path.basename(outPath)}`,
      filename: `${timestamp}-${originalName}.gz`
    });
    
  } catch (err) {
    console.error('Compression error:', err);
    
    // Clean up on error
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    
    res.status(500).json({ 
      error: 'Compression failed',
      details: err.message 
    });
  }
});

// POST /decompress - Decompress a file
app.post('/decompress', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  
  try {
    console.log(`Decompressing file: ${req.file.originalname}`);
    
    const buffer = fs.readFileSync(inputPath);
    console.log(`Compressed file size: ${buffer.length} bytes`);
    
    let decompressedData;
    let originalFilename;
    let metadata = null;
    
    // Try to extract metadata first
    try {
      if (buffer.length >= 4) {
        const metadataLength = buffer.readUInt32BE(0);
        
        if (metadataLength > 0 && metadataLength < buffer.length) {
          const metadataBuffer = buffer.slice(4, 4 + metadataLength);
          const compressedDataBuffer = buffer.slice(4 + metadataLength);
          
          try {
            metadata = JSON.parse(metadataBuffer.toString('utf-8'));
            originalFilename = metadata.filename;
            
            // Decompress the actual data
            decompressedData = zlib.gunzipSync(compressedDataBuffer);
            console.log('Successfully extracted metadata and decompressed data');
            
          } catch (parseError) {
            console.log('Metadata parsing failed, treating as standard gzip');
            throw parseError;
          }
        } else {
          throw new Error('Invalid metadata length');
        }
      } else {
        throw new Error('File too small to contain metadata');
      }
    } catch (metadataError) {
      console.log('No valid metadata found, treating as standard gzip file');
      
      // Try to decompress the entire buffer as a standard gzip file
      try {
        decompressedData = zlib.gunzipSync(buffer);
        originalFilename = req.file.originalname.replace(/\.gz$/, '');
        console.log('Successfully decompressed as standard gzip');
      } catch (gzipError) {
        throw new Error('File is not a valid gzip file or corrupted');
      }
    }
    
    // Generate output filename
    const timestamp = Date.now();
    const outPath = path.join('decompressed', `${timestamp}-${originalFilename}`);
    
    // Write decompressed data
    fs.writeFileSync(outPath, decompressedData);
    console.log(`Decompression completed. Output size: ${decompressedData.length} bytes`);
    
    // Clean up temporary file
    fs.unlinkSync(inputPath);
    
    // Send the file to user and clean up
    res.download(outPath, originalFilename, (err) => {
      // Clean up the temporary decompressed file
      if (fs.existsSync(outPath)) {
        fs.unlinkSync(outPath);
      }
      
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
    
  } catch (err) {
    console.error('Decompression error:', err);
    
    // Clean up on error
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    
    let errorMessage = 'Decompression failed';
    if (err.code === 'Z_DATA_ERROR' || err.message.includes('incorrect header check')) {
      errorMessage = 'Invalid or corrupted gzip file';
    } else if (err.message.includes('not a valid gzip file')) {
      errorMessage = 'File is not a valid gzip file';
    }
    
    res.status(400).json({ 
      error: errorMessage,
      details: err.message 
    });
  }
});

// GET route to serve compressed files
app.get('/compressed/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'compressed', filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
  }
  
  if (error.message.includes('File type not allowed')) {
    return res.status(400).json({ error: error.message });
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Upload endpoint: http://localhost:${PORT}/compress`);
  console.log(`📤 Decompress endpoint: http://localhost:${PORT}/decompress`);
});
