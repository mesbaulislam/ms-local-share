/* MS Local Transfer - KaiOS receiver (optional enhancement).
   ES5 only, XMLHttpRequest only. The page is server-rendered, so it
   works fully even if this script never runs. This script only
   refreshes the list in place, without reloading the page. */
(function () {
  "use strict";
  var listEl = document.getElementById("fileList");
  var storageEl = document.getElementById("storageText");
  if (!listEl || !window.XMLHttpRequest) { return; }

  function refresh() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/files", true);
    xhr.onreadystatechange = function () {
      var data, i, item, nameEl, metaEl, link;
      if (xhr.readyState !== 4 || xhr.status !== 200) { return; }
      try { data = JSON.parse(xhr.responseText); } catch (e) { return; }
      if (storageEl) {
        storageEl.textContent = data.file_count + " file(s) - " + data.total_size_human;
      }
      listEl.innerHTML = "";
      if (!data.files || data.files.length === 0) {
        var empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "No files received yet.";
        listEl.appendChild(empty);
        return;
      }
      for (i = 0; i < data.files.length; i++) {
        item = document.createElement("div");
        item.className = "item";
        nameEl = document.createElement("div");
        nameEl.className = "name";
        nameEl.textContent = data.files[i].name;
        metaEl = document.createElement("div");
        metaEl.className = "meta";
        metaEl.textContent = data.files[i].extension.toUpperCase() + " - " +
          data.files[i].size_human + " - " + data.files[i].uploaded_at;
        link = document.createElement("a");
        link.className = "dl";
        link.href = data.files[i].download_url;
        link.textContent = "Download";
        item.appendChild(nameEl);
        item.appendChild(metaEl);
        item.appendChild(link);
        listEl.appendChild(item);
      }
    };
    xhr.send();
  }

  /* Refresh every 30 seconds so new uploads appear without a reload. */
  setInterval(refresh, 30000);
})();
