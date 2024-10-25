import * as vscode from 'vscode';

let chatState: { role: string; text: string }[] = [];
type settings = {
  token: string;
  catalogueId: string;
};


/**
 * Функция активации расширения.
 * @param {vscode.ExtensionContext} context - Контекст расширения.
 */
export function activate(context: vscode.ExtensionContext) {
  /**
   * Создаем новый экземпляр класса ChatViewProvider.
   * @param {vscode.ExtensionContext['extensionUri']} context.extensionUri - URI расширения.
   * @param {vscode.ExtensionContext['globalState']} context.globalState - Глобальное состояние расширения.
   */
  const provider = new ChatViewProvider(context.extensionUri, context.globalState);

  /**
   * Регистрируем провайдера веб-вью.
   * @param {vscode.window.registerWebviewViewProvider} vscode.window.registerWebviewViewProvider - Провайдер веб-вью.
   * @param {ChatViewProvider} provider - Провайдер для регистрации.
   */
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
  );

  /**
   * Регистрируем команду 'yaGPT.updateChat'.
   * @param {vscode.commands.registerCommand} vscode.commands.registerCommand - Команда для регистрации.
   * @param {(resp) => provider.updateChat(resp)} - Функция обратного вызова, которая будет выполнена при вызове команды.
   */
  context.subscriptions.push(
    vscode.commands.registerCommand('yaGPT.updateChat', (resp) => {
      provider.updateChat(resp);
    })
  );

  // Повторяем этот процесс для других команд.
  // ...
  context.subscriptions.push(
    vscode.commands.registerCommand('yaGPT.initView', (resp) => {
      provider.initView(resp);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('yaGPT.saveSettings', (resp) => {
      provider.saveSettingsInGlobalState(resp);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('yaGPT.clearChat', (resp) => {
      provider.clearChat();
      provider.setSystemPrompt(vscode.workspace.getConfiguration('yaGPT').SystemPrompt);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('yaGPT.goToSettings', () => {
      provider.goToSettings();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('yaGPT.explainSelected', (data) => {
      provider.explainSelected();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('yaGPT.commentSelected', (data) => {
      provider.commentSelected();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('yaGPT.fixSelected', (data) => {
      provider.fixSelected();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('yaGPT.translateSelected', (data) => {
      provider.translateSelected();
    })
  );
}


class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'yaGPT.chatView';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private globalState: vscode.ExtensionContext['globalState']
  ) { }


  /**
   * Метод resolveWebviewView вызывается при создании WebView. Он устанавливает опции WebView, загружает HTML-страницу и обрабатывает сообщения из WebView.
   * @param webviewView - объект WebView.
   * @param context - контекст WebView.
   * @param _token - токен отмены операции.
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    /**
     * Сохраняем объект WebView.
     */
    this._view = webviewView;

    /**
     * Устанавливаем опции WebView:
     * - enableScripts: true - включает JavaScript.
     * - localResourceRoots: [this._extensionUri] - устанавливает корневые пути для ресурсов.
     */
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    /**
     * Загружаем HTML-страницу для WebView.
     */
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    /**
     * Устанавливаем обработчик сообщений из WebView.
     */
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        /**
         * Если сообщение типа 'saveSettings', сохраняем настройки в глобальном состоянии расширения.
         */
        case 'saveSettings': {
          await this.saveSettingsInGlobalState(data.message);
          break;
        }
        /**
         * Если сообщение типа 'controllerOnLoaded', отображаем вкладки 'home' или 'chat' в зависимости от наличия настроек.
         */
        case 'controllerOnLoaded': {
          vscode.commands.executeCommand(
            'yaGPT.initView',
            this.globalState.get('settings') ? 'chat' : 'home'
          );
          /**
           * Обновляем список сообщений.
           */
          vscode.commands.executeCommand(
            'yaGPT.updateChat',
            chatState
          );
          break;
        }
        /**
         * Если сообщение типа 'sendMessage', отправляем сообщение в Yandex AI Language Models и обновляем список сообщений.
         */
        case 'sendMessage': {
          this.sendMessage(data.message);
          break;
        }
      }
    });
  }


  /**
   * Метод updateChat обновляет список сообщений в WebView.
   * @param resp - строка, содержащая обновленные сообщения.
   */
  public updateChat(resp: string) {
    /**
     * Проверяем, существует ли объект WebView.
     */
    if (this._view) {
      /**
       * Отправляем сообщение в WebView с типом 'updateChat' и содержимым 'resp'.
       */
      this._view.webview.postMessage({
        type: 'updateChat',
        message: resp,
      });
    }
  }


  /**
   * Метод initView отображает определенную вкладку в WebView.
   * @param type - тип вкладки, которую нужно отобразить.
   */
  public initView(type: string) {
    /**
     * Проверяем, существует ли объект WebView.
     */
    if (this._view) {
      /**
       * Отправляем сообщение в WebView с типом 'initView' и содержимым 'type'.
       */
      this._view.webview.postMessage({
        type: 'initView',
        message: type,
      });
    }
  }


  /**
   * Метод saveSettingsInGlobalState сохраняет настройки в глобальном состоянии расширения и отображает вкладку 'chat'.
   * @param settings - объект, содержащий настройки.
   */
  public async saveSettingsInGlobalState(settings: settings) {
    /**
     * Сохраняем настройки в глобальном состоянии.
     */
    await this.globalState.update('settings', settings);
    /**
     * Выводим сообщение об успешном сохранении.
     */
    vscode.window.showInformationMessage(`Настройки сохранены`);
    /**
     * Переходим к вкладок 'chat'.
     */
    vscode.commands.executeCommand('yaGPT.initView', 'chat');
  }


  /**
   * Метод clearChat очищает список сообщений.
   */
  public clearChat() {
    /**
     * Очищаем список сообщений.
     */
    chatState = [];
    /**
     * Обновляем список сообщений.
     */
    vscode.commands.executeCommand('yaGPT.updateChat', chatState);
  }


  /**
   * Метод goToSettings переходит к настройкам.
   */
  public goToSettings() {
    /**
     * Переходим к настройкам.
     */
    vscode.commands.executeCommand('yaGPT.initView', 'home');
  }


  /**
   * Метод explainSelected обрабатывает выбранный текст и отправляет его в Yandex AI Language Models для анализа и объяснения.
   */
  public explainSelected() {
    this._processSelected(
      'Проанализируй и объясни следующий фрагмент кода c точки зрения разработчика ПО. Обдумывай проблему шаг за шагом и предоставь мне цепочку своих рассуждений перед генерацией ответа:\n\n');
  }

  /**
   * Метод commentSelected обрабатывает выбранный текст и отправляет его в Yandex AI Language Models для добавления комментариев.
   */
  public commentSelected() {
    this._processSelected(
      'Проанализируй следующий фрагмент кода c точки зрения разработчика ПО. Вставь в код подробный построчный комментарий, выведи в виде кода с комментариями:\n\n');
  }

  /**
   * Метод fixSelected обрабатывает выбранный текст и отправляет его в Yandex AI Language Models для исправления ошибок.
   */
  public fixSelected() {
    this._processSelected(
      'Проанализируй следующий фрагмент кода c точки зрения разработчика ПО. Найди ошибки и потенциальные проблемы:\n\n');
  }

  /**
   * Метод translateSelected обрабатывает выбранный текст и отправляет его в Yandex AI Language Models для перевода на русский язык.
   */
  public translateSelected() {
    this._processSelected(
      'Переведи следующий фрагмент текста на русский язык. Сохраняй исходное форматирование и разметку языка:\n\n');
  }


  /**
   * Метод _processSelected обрабатывает выбранный текст.
   * @param uPrompt - пользовательский промпт, добавляемый к выбранному тексту.
   */
  private _processSelected(uPrompt: string) {
    // Получение активного редактора текста
    const editor = vscode.window.activeTextEditor;

    // Если редактор не активен, функция завершает свою работу
    if (!editor) {
      return;
    }

    // Получение выбранного текста
    const selection = editor.document.getText(editor.selection);

    // Если текст не выбран, функция завершает свою работу
    if (!selection) {
      return;
    }

    // Очистка чата
    this.clearChat();

    // Установка системного запроса
    this.setSystemPrompt(vscode.workspace.getConfiguration('yaGPT').SystemPrompt);

    // Открытие панели ChatGPT
    vscode.commands.executeCommand('workbench.view.extension.yaGPT');

    // Отправка пользовательского запроса и выбранного текста в GPT
    this.sendMessage(uPrompt + '```\n' + selection + '\n```');
  }

  public setSystemPrompt(prompt: string) {
    // Установка системного запроса
    chatState.push({ role: 'system', text: prompt, });
  }


  /**
   * Отправка сообщения в чат с помощью Yandex.Cloud LLM.
   * @param {string} message - сообщение, которое нужно отправить в чат
   */
  public sendMessage(message: string) {
    /**
     * Добавление сообщения в chatState с ролью 'user'.
     */
    chatState.push({ role: 'user', text: message });

    /**
     * Вызов команды для обновления чата.
     */
    vscode.commands.executeCommand('yaGPT.updateChat', chatState);

    /**
     * Получение настроек из глобального состояния.
     */
    const settings: settings | undefined = this.globalState.get('settings');

    /**
     * Создание нового объекта newPost для передачи в API.
     */
    const newPost = {
      modelUri: `gpt://${settings?.catalogueId}/${vscode.workspace.getConfiguration('yaGPT').model}`,
      completionOptions: {
        stream: false,
        temperature: vscode.workspace.getConfiguration('yaGPT').temperature,
        maxTokens: '2000',
      },
      messages: chatState,
    };

    /**
     * Отправка POST-запроса к API Yandex.Cloud LLM.
     */
    fetch(
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
      {
        method: 'POST',
        body: JSON.stringify(newPost),
        headers: {
          'content-type': 'application/json',
          Authorization: `Api-Key ${settings?.token}`,
          'x-folder-id': `${settings?.catalogueId}`,
        },
      }
    )
      /**
       * Преобразование ответа API в JSON.
       */
      .then((response) => response.json())
      /**
       * Обработка ответа API.
       */
      .then((response) => {
        const result = response.result;
        /**
         * Если в ответе есть ошибка, показывается сообщение об ошибке.
         */
        if (response.error) {
          vscode.window.showErrorMessage(
            `ОШИБКА ОТ yaGPT: ${JSON.stringify(response)}`
          );
        }
        /**
         * Добавление результата ответа в chatState и обновление чата.
         */
        chatState.push(result?.alternatives[0].message);
        vscode.commands.executeCommand('yaGPT.updateChat', chatState);
      })
      /**
       * Обработка ошибок при выполнении запроса.
       */
      .catch((err) => {
        console.log('error', err);
        vscode.window.showErrorMessage(
          `ОШИБКА ОТ yaGPT: ${JSON.stringify(err)}`
        );
      });
  }

  /**
   * Генерирует HTML для WebView.
   *
   * @param {vscode.Webview} webview - объект WebView.
   * @returns {string} HTML для WebView.
   */
  private _getHtmlForWebview(webview: vscode.Webview) {
    console.log('_getHtmlForWebview');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
    );
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" Content-Security-Policy: default-src "self"; connect-src "self" https://llm.api.cloud.yandex.net; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleResetUri}" rel="stylesheet">
        <link href="${styleVSCodeUri}" rel="stylesheet">
        <link href="${styleMainUri}" rel="stylesheet">
        <title>Chat yaGPT</title>
      </head>
      <body>
        <div id="chat-area" class="hide">
                    <div id="response-box" class="chat-box"></div>
                    <textarea id="user-message-input" class="user-input" rows="5" cols="33" placeholder="Пиши сюда"></textarea>
                    <button id="send-btn" class="base-btn">Отправить</button>
                </div>
                <div id="home-block" class="hide">
                    <label>API-токен
                        <input type="text" class="settings-input" id="api-token-input">
                    </label>
                    <label>Идентификатор каталога
                        <input type="text" class="settings-input" id="catalogue-id-input">
                    </label>
                    <button id="save-settings" class="base-btn">Сохранить настройки</button>
                    <p class="home-help-text small-text">
                        <a href="https://cloud.yandex.ru/ru/docs/iam/operations/api-key/create">Как получить API-ключ?</a></br>
                        </br>
                        <a href="https://cloud.yandex.ru/ru/docs/resource-manager/operations/folder/get-id">Как получить идентификатор каталога?</a>
                    </p>
                </div>
                <div id="progress-bar" class="progress-bar hide">
                    <div class="progress-bar-value"></div>
                </div>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/dark.min.css">
                <script src="https://cdn.jsdelivr.net/npm/marked-highlight/lib/index.umd.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

/**
 * Генерирует случайную строку из 32 символов, состоящую из алфавита и цифр.
 *
 * @returns {string} Случайная строка из 32 символов.
 */
function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
