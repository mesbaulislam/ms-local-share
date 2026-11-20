/* MS Local Transfer - Android sender.
   ES5-compatible, XMLHttpRequest only (upload progress needs XHR).
   No external libraries, no CDN. */
(function () {
  "use strict";

  var cfg = window.MS_TRANSFER || {};
  var MAX_MB = cfg.maxUploadMB || 500;

  var fileInput = document.getElementById("fileInput");
  var selectedList = document.getElementById("selectedList");
  var totalRow = document.getElementById("totalRow");
  var totalSizeEl = document.getElementById("totalSize");
  var totalCountEl = document.getElementById("totalCount");
  var uploadBtn = document.getElementById("uploadBtn");
  var progressWrap = document.getElementById("progressWrap");
  var progressFill = document.getElementById("progressFill");
  var percentText = document.getElementById("percentText");
  var currentFileEl = document.getElementById("currentFile");
  var uploadedSizeEl = document.getElementById("uploadedSize");
  var totalUploadSizeEl = document.getElementById("totalUploadSize");
  var messageEl = document.getElementById("message");
  var historyList = document.getElementById("historyList");
  var historyEmpty = document.getElementById("historyEmpty");
  var fileCountText = document.getElementById("fileCountText");
  var pinInput = document.getElementById("pinInput");

  var selected = []; // array of File objects

  function fmt(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes < 1024) { return bytes + " B"; }
    if (bytes < 1024 * 1024) { return (bytes / 1024).toFixed(1) + " KB"; }
    if (bytes < 1024 * 1024 * 1024) { return (bytes / 1048576).toFixed(1) + " MB"; }
    return (bytes / 1073741824).toFixed(2) + " GB";
  }

  function showMessage(text, kind) {
    messageEl.textContent = text;
    messageEl.className = "message " + (kind || "");
  }

  function getPin() {
    return pinInput ? pinInput.value : "";
  }

  function totalSelectedSize() {
    var total = 0, i;
    for (i = 0; i < selected.length; i++) { total += selected[i].size; }
    return total;
  }

  function renderSelected() {
    var i, item, info, nameEl, metaEl, removeBtn;
    selectedList.innerHTML = "";
    for (i = 0; i < selected.length; i++) {
      (function (index) {
        item = document.createElement("div");
        item.className = "file-item";
        info = document.createElement("div");
        info.className = "finfo";
        nameEl = document.createElement("div");
        nameEl.className = "fname";
        nameEl.textContent = selected[index].name;
        metaEl = document.createElement("div");
        metaEl.className = "fmeta";
        metaEl.textContent = fmt(selected[index].size);
        info.appendChild(nameEl);
        info.appendChild(metaEl);
        removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove";
        removeBtn.textContent = "Remove";
        removeBtn.onclick = function () {
          selected.splice(index, 1);
          renderSelected();
        };
        item.appendChild(info);
        item.appendChild(removeBtn);
        selectedList.appendChild(item);
      })(i);
    }
    if (selected.length > 0) {
      totalRow.hidden = false;
      totalSizeEl.textContent = fmt(totalSelectedSize());
      totalCountEl.textContent = "(" + selected.length + " file" +
        (selected.length > 1 ? "s" : "") + ")";
      uploadBtn.disabled = false;
    } else {
      totalRow.hidden = true;
      uploadBtn.disabled = true;
    }
  }

  fileInput.addEventListener("change", function () {
    var i;
    selected = [];
    for (i = 0; i < fileInput.files.length; i++) {
      selected.push(fileInput.files[i]);
    }
    if (totalSelectedSize() > MAX_MB * 1024 * 1024) {
      showMessage("Total size exceeds the " + MAX_MB + " MB limit. Remove some files.", "err");
    } else {
      showMessage("", "");
    }
    renderSelected();
  });

  function setProgress(percent, loaded, total, currentName) {
    progressWrap.hidden = false;
    progressFill.style.width = percent + "%";
    percentText.textContent = percent + "%";
    uploadedSizeEl.textContent = fmt(loaded);
    totalUploadSizeEl.textContent = fmt(total);
    currentFileEl.textContent = currentName || "Uploading...";
  }

  uploadBtn.addEventListener("click", function () {
    var form, xhr, i, total;
    if (selected.length === 0) { return; }
    total = totalSelectedSize();
    if (total > MAX_MB * 1024 * 1024) {
      showMessage("Total size exceeds the " + MAX_MB + " MB limit.", "err");
      return;
    }
    form = new FormData();
    for (i = 0; i < selected.length; i++) {
      form.append("files", selected[i]);
    }
    if (getPin()) { form.append("pin", getPin()); }

    uploadBtn.disabled = true;
    showMessage("", "");
    setProgress(0, 0, total, selected[0].name);

    xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);
    xhr.upload.addEventListener("progress", function (e) {
      var percent = 0;
      if (e.lengthComputable && e.total > 0) {
        percent = Math.round((e.loaded / e.total) * 100);
        setProgress(percent, e.loaded, e.total, selected[0].name);
      }
    });
    xhr.onreadystatechange = function () {
      var data, names, j;
      if (xhr.readyState !== 4) { return; }
      uploadBtn.disabled = false;
      try { data = JSON.parse(xhr.responseText); } catch (err) { data = null; }
      if (xhr.status === 200 && data && data.ok) {
        names = [];
        for (j = 0; j < data.uploaded.length; j++) { names.push(data.uploaded[j].name); }
        setProgress(100, total, total, "Done");
        showMessage("Uploaded " + data.uploaded.length + " file(s): " + names.join(", ") +
          ". Open /receiver on the KaiOS phone to download.", "ok");
        selected = [];
        fileInput.value = "";
        renderSelected();
        loadHistory();
      } else {
        setProgress(0, 0, total, "Upload failed");
        showMessage((data && data.error) || ("Upload failed (HTTP " + xhr.status + "). Check Wi-Fi and try again."), "err");
      }
    };
    xhr.onerror = function () {
      uploadBtn.disabled = false;
      showMessage("Upload failed: connection lost. Check that both phones are on the same Wi-Fi.", "err");
    };
    xhr.send(form);
  });

  function loadHistory() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/files", true);
    xhr.onreadystatechange = function () {
      var data, i, item, info, nameEl, metaEl, delBtn;
      if (xhr.readyState !== 4 || xhr.status !== 200) { return; }
      try { data = JSON.parse(xhr.responseText); } catch (err) { return; }
      historyList.innerHTML = "";
      if (data.files && data.files.length > 0) {
        historyEmpty.style.display = "none";
        for (i = 0; i < data.files.length; i++) {
          (function (f) {
            item = document.createElement("div");
            item.className = "file-item";
            info = document.createElement("div");
            info.className = "finfo";
            nameEl = document.createElement("div");
            nameEl.className = "fname";
            nameEl.textContent = f.name;
            metaEl = document.createElement("div");
            metaEl.className = "fmeta";
            metaEl.textContent = f.size_human + "  |  " + f.uploaded_at + "  |  Uploaded";
            info.appendChild(nameEl);
            info.appendChild(metaEl);
            delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "del";
            delBtn.textContent = "Delete";
            delBtn.onclick = function () { deleteFile(f.name); };
            item.appendChild(info);
            item.appendChild(delBtn);
            historyList.appendChild(item);
          })(data.files[i]);
        }
      } else {
        historyEmpty.style.display = "";
      }
      if (fileCountText) {
        fileCountText.textContent = data.file_count + " files | " + data.total_size_human;
      }
    };
    xhr.send();
  }

  function deleteFile(name) {
    var xhr, form;
    if (!window.confirm("Delete '" + name + "' from the server?")) { return; }
    xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/delete/" + encodeURIComponent(name), true);
    form = new FormData();
    if (getPin()) { form.append("pin", getPin()); }
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) { return; }
      if (xhr.status === 200) { showMessage("Deleted " + name + ".", "ok"); loadHistory(); }
      else { showMessage("Could not delete " + name + ".", "err"); }
    };
    xhr.send(form);
  }

  document.getElementById("clearBtn").addEventListener("click", function () {
    var xhr, form;
    if (!window.confirm("Delete ALL uploaded files? This cannot be undone.")) { return; }
    xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/clear", true);
    form = new FormData();
    if (getPin()) { form.append("pin", getPin()); }
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) { return; }
      if (xhr.status === 200) { showMessage("All files cleared.", "ok"); loadHistory(); }
      else { showMessage("Could not clear files.", "err"); }
    };
    xhr.send(form);
  });

  document.getElementById("refreshBtn").addEventListener("click", loadHistory);

  document.getElementById("copyBtn").addEventListener("click", function () {
    var input = document.getElementById("receiverUrl");
    var hint = document.getElementById("copyHint");
    function done() { hint.textContent = "Copied! Paste it into the KaiOS browser."; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.value).then(done, function () { fallbackCopy(); });
    } else { fallbackCopy(); }
    function fallbackCopy() {
      input.select();
      try { document.execCommand("copy"); done(); }
      catch (err) { hint.textContent = "Copy did not work - long-press the URL and copy it manually."; }
    }
  });

  loadHistory();
})();
