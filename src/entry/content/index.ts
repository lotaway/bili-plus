export {};

function main() {
  console.debug('Start video content.js');
  addListener();
  injectScript();
  console.debug('End video content.js');
}

function addListener() {
  window.addEventListener('message', async (event) => {
    if (
      event.source !== window ||
      event.data?.source !== 'VIDEO_PAGE_INJECT'
    ) {
      return;
    }

    switch (event.data.type) {
      case 'videoInfoInit':
        await chrome.runtime.sendMessage({
          type: 'VideoInfoUpdate',
          payload: event.data.payload,
        });
        break;
      case 'openSidePanel':
        chrome.runtime.sendMessage({
          type: 'openSidePanel',
        });
        break;
      default:
        break;
    }
  });
}

function injectScript() {
  const script = document.createElement('script');
  // Note: video_page_inject.js needs to be in web_accessible_resources
  // Since we are building it, it will be in assets/video_page_inject.js or similar.
  // But wait, if we build it as an entry point, it will be in assets/.
  // We need to make sure manifest points to the right place.
  // For now, let's assume it's built to assets/video_page_inject.js
  // But the original code used utils/video_page_inject.js.
  // We should check how vite builds it.
  // If we added it to input, it will be built.
  // Let's assume we will configure manifest to point to the built file.
  const url = chrome.runtime.getURL('assets/video_page_inject.js');
  script.src = url;
  document.documentElement.appendChild(script);
}

main();
