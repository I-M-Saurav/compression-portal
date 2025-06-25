document.addEventListener('DOMContentLoaded', () => {
  function setupDropZone(zoneId, inputId, infoId, actionBtnId, endpoint, spinnerId, sizeInfoId = null) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const info = document.getElementById(infoId);
    const btn = document.getElementById(actionBtnId);
    const spinner = document.getElementById(spinnerId);
    let selectedFile = null;

    zone.onclick = () => input.click();
    zone.ondragover = e => { e.preventDefault(); zone.classList.add('hover'); };
    zone.ondragleave = () => zone.classList.remove('hover');
    zone.ondrop = e => {
      e.preventDefault();
      zone.classList.remove('hover');
      if (e.dataTransfer.files.length) {
        input.files = e.dataTransfer.files;
        updateInfo();
      }
    };
    input.onchange = updateInfo;

    function updateInfo() {
      selectedFile = input.files[0];
      if (!selectedFile) return;
      info.innerHTML = `<strong>${selectedFile.name}</strong> (${(selectedFile.size / 1024).toFixed(1)} KB)`;
    }

    btn.onclick = async () => {
      if (!selectedFile) return showToast('No file selected!', false);
      spinner.style.display = 'inline-block';

      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(endpoint, { method: 'POST', body: formData });
      spinner.style.display = 'none';
      if (!res.ok) return showToast('Operation failed!', false);

      if (endpoint === '/compress') {
        const data = await res.json();
        const blob = await (await fetch(data.downloadPath)).blob();
        downloadBlob(blob, selectedFile.name + '.gz');

        if (sizeInfoId) {
          const saved = ((1 - data.compressedSize / data.originalSize) * 100).toFixed(1);
          document.getElementById(sizeInfoId).innerHTML = `
            Original: ${(data.originalSize / 1024).toFixed(1)} KB<br>
            Compressed: ${(data.compressedSize / 1024).toFixed(1)} KB<br>
            Saved: ${saved}%
          `;
        }
      } else {
        const blob = await res.blob();
        const filename = res.headers.get('Content-Disposition').split('filename=')[1];
        downloadBlob(blob, filename);
      }

      showToast('Operation complete!');
    };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function showToast(msg, success = true) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `show ${success ? 'success' : 'error'}`;
    setTimeout(() => toast.className = '', 3000);
  }

  setupDropZone('drop-zone', 'fileInput', 'fileInfo', 'compressBtn', '/compress', 'spinner', 'sizeInfo');
  setupDropZone('drop-zone-decompress', 'fileInputDecompress', 'fileInfoDecompress', 'decompressBtn', '/decompress', 'spinnerDecompress');
});
