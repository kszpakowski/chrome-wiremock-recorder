const downloadBtn = document.getElementById("download");
const recordBtn = document.getElementById("record");
const cancelBtn = document.getElementById("cancel");

const { state } = await chrome.storage.local.get('state');
if (state === "recording") {
  showDownloadUI();
}

downloadBtn.addEventListener("click", (e) => {
  save();
  showRecordUI();
});

recordBtn.addEventListener("click", async (e) => {
  startRecording();
  showDownloadUI();
});

cancelBtn.addEventListener("click", async (e) => {
  await stopRecording();
  showRecordUI();
});

function startRecording() {
  chrome.tabs.query(
    {
      currentWindow: true,
      active: true,
    },
    function (tabArray) {
      chrome.runtime.sendMessage({ action: "record", tabId: tabArray[0].id });
    }
  );
}

async function stopRecording() {
  await chrome.runtime.sendMessage({ action: "stopRecording" });
}

function save() {
  const zip = new JSZip();

  chrome.storage.local.get().then((result) => {
    Object.values(result).filter(item => item.type === 'request').forEach((req) => {

      console.log('req', req)
      const { method, url, status, body } = req;

      const urlPathPattern = urlToPathPattern(url);

      const fileContent = buildMockMappingFileContent(
        method,
        urlPathPattern,
        status,
        body
      );

      const filename = urlToFileName(method, url);

      zip.file(filename, fileContent);
    });

    zip.generateAsync({ type: "blob" }).then(function (content) {
      saveAs(content, "mappings.zip");
    });

    stopRecording();
  });
}

function showRecordUI() {
  recordBtn.style.display = "block";
  downloadBtn.style.display = "none";
  cancelBtn.style.display = "none";
}

function showDownloadUI() {
  recordBtn.style.display = "none";
  downloadBtn.style.display = "block";
  cancelBtn.style.display = "block";
}

function urlToFileName(method, url) {
  const b = url
    .replace(/https:\/\/.+?\//, "")
    .replace(/\?.*/, "")
    .split("/");
  b[b.length - 1] = method + "_" + b[b.length - 1];
  return `./mappings/${b.join("/")}.json`;
}

function urlToPathPattern(url) {
  return "/" + url.replace(/https:\/\/.+?\//, "").replace(/\?.*/, "");
}

function buildMockMappingFileContent(method, urlPathPattern, status, body) {
  return JSON.stringify(
    {
      priority: 2,
      request: {
        method,
        urlPathPattern,
      },
      response: {
        status,
        headers: {
          "Content-Type": "application/json",
        },
        body,
      },
    },
    null,
    2
  );
}
