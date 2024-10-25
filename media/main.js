// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
import hljs from 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/es/highlight.min.js';
(
  /**
   * @description Функция, которая содержит основную логику веб-вью.
   */
  function () {
    /**
     * @description Инициализация переменных и элементов DOM.
     */
    // eslint-disable-next-line no-undef
    const vscode = acquireVsCodeApi();
    const { markedHighlight } = globalThis.markedHighlight;
    const { Marked } = globalThis.marked;
    const marked = new Marked(
      markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang, info) {
          return hljs.highlightAuto(code).value;
        },
      })
    );

    let isLoading = false;
    let chatState = [];
    const tokenInput = document.getElementById('api-token-input');
    const catalogueIdInput = document.getElementById('catalogue-id-input');
    const userMessageInput = document.getElementById('user-message-input');
    const sendBtn = document.getElementById('send-btn');

    /**
     * @description Обработчик события нажатия кнопки отправки сообщения.
     */
    const userSubmitHandler = () => {
      if (isLoading || !userMessageInput.value) {
        return;
      }
      isLoading = true;
      document.getElementById('progress-bar').classList.remove('hide');
      sendMessage();
      userMessageInput.value = '';
    };

    /**
     * @description Обработчики событий для полей ввода токена и идентификатора каталога.
     */
    tokenInput.addEventListener('input', () => {
      if (tokenInput.value) {
        tokenInput.classList.remove('settings-input__error');
      }
    });
    catalogueIdInput.addEventListener('input', () => {
      if (catalogueIdInput.value) {
        catalogueIdInput.classList.remove('settings-input__error');
      }
    });

    /**
     * @description Обработчик события нажатия кнопки сохранения настроек.
     */
    document.getElementById('save-settings').addEventListener('click', () => {
      let isValidationError = false;
      if (!tokenInput.value) {
        tokenInput.classList.add('settings-input__error');
        isValidationError = true;
      }
      if (!catalogueIdInput.value) {
        catalogueIdInput.classList.add('settings-input__error');
        isValidationError = true;
      }
      if (isValidationError) {
        return;
      }
      vscode.postMessage({
        type: 'saveSettings',
        message: {
          token: tokenInput.value,
          catalogueId: catalogueIdInput.value,
        },
      });
    });

    /**
     * @description Обработчик событий нажатия кнопки отправки сообщения и нажатия клавиши Enter.
     */
    sendBtn?.addEventListener('click', userSubmitHandler);
    window.addEventListener('keydown', function (event) {
      // Check if the Ctrl key or the Command key (on a Mac) + Enter is pressed
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        userSubmitHandler();
      }
    });

    /**
     * @description Обработчик события загрузки страницы.
     */
    window.onload = () => {
      vscode.postMessage({ type: 'controllerOnLoaded' });
    };

    /**
     * @description Обработчик событий для сообщений, отправленных из расширения в вебвью.
     */
    window.addEventListener('message', (event) => {
      const message = event.data; // The json data that the extension sent
      switch (message.type) {
        case 'updateChat': {
          chatState = message.message;
          console.log('received chatState from view', chatState);

          // create div and insert in inside element with id response-box
          const responseBox = document.getElementById('response-box');
          responseBox.replaceChildren();
          chatState.forEach((element) => {
            if (!element) {
              return;
            }
            if (element.role === 'system') {
              return;
            }
            const div = document.createElement('div');
            div.classList.add(
              element.role === 'assistant'
                ? 'bot-message'
                : 'user-message'
            );
            div.innerHTML = marked.parse(element.text);
            responseBox.appendChild(div);
          });
          if (chatState[chatState.length - 1]?.role === 'assistant') {
            document
              .getElementById('progress-bar')
              .classList.add('hide');
          }

          isLoading = false;
          break;
        }
        case 'initView': {
          if (message.message === 'home') {
            document
              .getElementById('home-block')
              .classList.remove('hide');
            document
              .getElementById('chat-area')
              .classList.remove('hide');
            document.getElementById('chat-area').classList.add('hide');
          } else if (message.message === 'chat') {
            document
              .getElementById('home-block')
              .classList.remove('hide');
            document
              .getElementById('chat-area')
              .classList.remove('hide');
            document.getElementById('home-block').classList.add('hide');
          } else {
            console.error('что-то не то пришло', message);
          }
          break;
        }
      }
    }
    );

    /**
     * @description Функция отправки сообщения.
     */
    function sendMessage() {
      const userMessage = userMessageInput?.value;
      vscode.postMessage({ type: 'sendMessage', message: userMessage });
    }
  })();
