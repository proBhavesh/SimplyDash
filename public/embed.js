(function() {
  function createAssistantFrame(config) {
    // Create container
    const container = document.createElement('div');
    container.id = 'assistant-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    `;

    // Create chat icon
    const chatIcon = document.createElement('div');
    chatIcon.style.cssText = `
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      cursor: pointer;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    `;
    chatIcon.innerHTML = '<img src="' + config.baseUrl + '/static/yuboto.gif" style="width: 100%; height: 100%; border-radius: 50%;">';

    // Create iframe with enhanced permissions
    const frame = document.createElement('iframe');
    frame.id = 'assistant-frame';
    frame.src = `${config.baseUrl}/embed/${config.workspaceId}/${config.assistantName}`;
    
    // Enhanced permissions for WordPress compatibility
    frame.allow = "microphone *; autoplay";
    frame.setAttribute('allowfullscreen', 'true');
    frame.setAttribute('allow', 'microphone');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-popups-to-escape-sandbox');
    
    frame.style.cssText = `
      border: none;
      width: 400px;
      height: 600px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      background: #fff;
      display: none;
      transition: opacity 0.3s, transform 0.3s;
    `;

    // Add click handler to toggle iframe
    let isFrameVisible = false;
    chatIcon.onclick = function() {
      if (isFrameVisible) {
        frame.style.display = 'none';
        chatIcon.style.transform = 'scale(1)';
      } else {
        frame.style.display = 'block';
        chatIcon.style.transform = 'scale(0.9)';
        // Send message to iframe that it's visible and force focus
        frame.contentWindow?.postMessage({ type: 'assistant-frame-visible' }, '*');
        frame.focus();
        // Force a click inside the iframe to ensure proper focus
        setTimeout(() => {
          frame.contentWindow?.postMessage({ type: 'assistant-frame-focus' }, '*');
        }, 100);
      }
      isFrameVisible = !isFrameVisible;
    };

    // Add hover effect
    chatIcon.onmouseover = function() {
      if (!isFrameVisible) {
        chatIcon.style.transform = 'scale(1.1)';
      }
    };
    chatIcon.onmouseout = function() {
      if (!isFrameVisible) {
        chatIcon.style.transform = 'scale(1)';
      }
    };

    // Assemble and add to page
    container.appendChild(frame);
    container.appendChild(chatIcon);
    document.body.appendChild(container);

    // Handle messages from iframe
    window.addEventListener('message', function(event) {
      // Allow messages from any origin for WordPress compatibility
      if (event.data.type === 'assistant-ready') {
        console.log('Assistant is ready');
      }
    });
  }

  window.initAssistant = function(config) {
    if (!config.baseUrl) {
      console.error('baseUrl is required in config');
      return;
    }
    if (!config.workspaceId) {
      console.error('workspaceId is required in config');
      return;
    }
    if (!config.assistantName) {
      console.error('assistantName is required in config');
      return;
    }

    // Create assistant frame when document is ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      createAssistantFrame(config);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        createAssistantFrame(config);
      });
    }
  };
})();
