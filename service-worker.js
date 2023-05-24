var version = "1.0";

chrome.runtime.onMessage.addListener(async function (
  request,
  sender,
  sendResponse
) {
  if (request.action === "record") {
    startRecording(request.tabId);
  }

  if (request.action === "stopRecording") {
    stopRecording();
  }
});

async function startRecording(tabId) {
  chrome.debugger.attach(
    {
      tabId,
    },
    version,
    onAttach.bind(null, tabId)
  );

  await setTabId(tabId)
  await setState("recording");
}

async function stopRecording() {
  const tabId = await getTabId()

  chrome.debugger.detach({
    tabId,
  });

  chrome.action.setBadgeText({
    text: ''
  });
  await clearRequests();
  await setState("stopped");
}

function onAttach(tabId) {
  chrome.debugger.sendCommand(
    {
      tabId: tabId,
    },
    "Network.enable"
  );

  chrome.debugger.onEvent.addListener(allEventHandler);
}

async function allEventHandler(debuggeeId, message, params) {
  if (message == "Network.requestWillBeSent") {
    const { requestId, request } = params;

    if (!request.url.includes("/api/")) { return }

    await saveOrUpdateRequest(requestId, {
      method: request.method,
      url: request.url,
    })
  }

  if (message == "Network.responseReceived") {
    const { requestId, response } = params;
    const { url, status } = response;

    if (!url.includes("/api/")) { return }

    setTimeout(async () => {
      chrome.debugger.sendCommand(
        {
          tabId: debuggeeId.tabId,
        },
        "Network.getResponseBody",
        {
          requestId: requestId,
        },
        async function (response) { //TODO record response headers
          await saveOrUpdateRequest(requestId, {
            body: response.body,
            status
          })

          chrome.action.setBadgeText({
            text: `${(await getAllRequests()).length}`
          })
        });
    }, 100);
  }
}

async function saveOrUpdateRequest(id, data) {
  const req = await chrome.storage.local.get(id)

  const newData = {
    [id]: {
      type: 'request',
      ...data,
      ...req[id]
    }
  }

  await chrome.storage.local.set(newData)

}

async function getAllRequests() {
  const data = await chrome.storage.local.get()
  return Object.values(data).filter(item => item.type === 'request')
}

async function clearRequests() {
  const data = await chrome.storage.local.get()

  const ids = Object.keys(data).filter(id => data[id].type === 'request')

  await chrome.storage.local.remove(ids)
}

async function setState(state) {
  await chrome.storage.local.set({
    state
  })
}

async function setTabId(id) {
  await chrome.storage.local.set({
    tabId: id
  })
}

async function getTabId() {
  const { tabId } = await chrome.storage.local.get('tabId');
  return tabId
}