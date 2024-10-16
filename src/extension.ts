import * as vscode from 'vscode';

let chatState: { role: string; text: string }[] = [];
type settings = {
  token: string;
  catalogueId: string;
};

export function activate(context: vscode.ExtensionContext) {
  const provider = new ChatViewProvider(context.extensionUri, context.globalState);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('yaGPT.updateChat', (resp) => {
      provider.updateChat(resp);
    })
  );
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


/**
 * Provider for creating `WebviewView` elements.
 */
class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'yaGPT.chatView';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private globalState: vscode.ExtensionContext['globalState']
  ) { }


  /**
   * Resolves a webview view.
   *
   * `resolveWebviewView` is called when a view first becomes visible. This may happen when the view is
   * first loaded or when the user hides and then shows a view again.
   *
   * @param webviewView Webview view to restore. The provider should take ownership of this view. The
   *    provider must set the webview's `.html` and hook up all webview events it is interested in.
   * @param context Additional metadata about the view being resolved.
   * @param token Cancellation token indicating that the view being provided is no longer needed.
   *
   * @returns Optional thenable indicating that the view has been fully resolved.
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'saveSettings': {
          await this.saveSettingsInGlobalState(data.message);
          break;
        }
        case 'controllerOnLoaded': {
          vscode.commands.executeCommand(
            'yaGPT.initView',
            this.globalState.get('settings') ? 'chat' : 'home'
          );
          vscode.commands.executeCommand(
            'yaGPT.updateChat',
            chatState
          );
          break;
        }
        case 'sendMessage': {
          this.sendMessage(data.message);
          break;
        }
      }
    });
  }

  public updateChat(resp: string) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateChat',
        message: resp,
      });
    }
  }

  public initView(type: string) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'initView',
        message: type,
      });
    }
  }

  public async saveSettingsInGlobalState(settings: settings) {
    await this.globalState.update('settings', settings);
    vscode.window.showInformationMessage(`Настройки сохранены`);
    vscode.commands.executeCommand('yaGPT.initView', 'chat');
  }

  public clearChat() {
    chatState = [];
    vscode.commands.executeCommand('yaGPT.updateChat', chatState);
  }

  public goToSettings() {
    vscode.commands.executeCommand('yaGPT.initView', 'home');
  }

  public explainSelected() {
    this._processSelected(
      'Проанализируй и объясни следующий фрагмент кода c точки зрения разработчика ПО. Обдумывай проблему шаг за шагом и предоставь мне цепочку своих рассуждений перед генерацией ответа:\n\n');
  }

  public commentSelected() {
    this._processSelected(
      'Проанализируй следующий фрагмент кода c точки зрения разработчика ПО. Вставь в код подробный построчный комментарий, выведи в виде кода с комментариями:\n\n');
  }

  public fixSelected() {
    this._processSelected(
      'Проанализируй следующий фрагмент кода c точки зрения разработчика ПО. Найди ошибки и потенциальные проблемы:\n\n');
  }

  public translateSelected() {
    this._processSelected(
      'Переведи следующий фрагмент текста на русский язык. Сохраняй исходное форматирование и разметку языка:\n\n');
  }

  private _processSelected(uPrompt: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const selection = editor.document.getText(editor.selection);
    if (!selection) {
      return;
    }
    this.clearChat();
    this.setSystemPrompt(vscode.workspace.getConfiguration('yaGPT').SystemPrompt);
    vscode.commands.executeCommand('workbench.view.extension.yaGPT');
    this.sendMessage(uPrompt + '```\n' + selection + '\n```');
  }

  public setSystemPrompt(prompt: string) {
    chatState.push({ role: 'system', text: prompt, });
  }

  public sendMessage(
    message: string
  ) {
    // Добавляем сообщение в массив chatState с ролью «user».
    chatState.push({ role: 'user', text: message });
    // Обновляем состояние чата с помощью команды yaGPT.updateChat.
    vscode.commands.executeCommand('yaGPT.updateChat', chatState);

    const settings: settings | undefined = this.globalState.get('settings');

    // Создаём новый объект newPost, который содержит информацию о модели GPT, параметрах завершения и сообщениях из массива chatState.
    const newPost = {
      modelUri: `gpt://${settings?.catalogueId}/${vscode.workspace.getConfiguration('yaGPT').model}`,
      completionOptions: {
        stream: false,
        temperature: vscode.workspace.getConfiguration('yaGPT').temperature,
        maxTokens: '2000',
      },
      messages: chatState,
    };

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
    ) // Отправляем запрос на сервер с помощью fetch. Запрос содержит данные для генерации ответа от модели.
      .then((response) => response.json())
      .then((response) => {
        const result = response.result;
        // Обрабатываем ответ сервера. Если в ответе есть ошибка, то отображается соответствующее сообщение об ошибке. В противном случае результат добавляется в чат.
        if (response.error) {
          vscode.window.showErrorMessage(
            `ОШИБКА ОТ yaGPT: ${JSON.stringify(response)}`
          );
        }
        chatState.push(result?.alternatives[0].message);
        vscode.commands.executeCommand('yaGPT.updateChat', chatState);
      })
      .catch((err) => {
        console.log('error', err);
        vscode.window.showErrorMessage(
          `ОШИБКА ОТ yaGPT: ${JSON.stringify(err)}`
        );
      });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    console.log('_getHtmlForWebview');
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
    );

    // Do the same for the stylesheet.
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css')
    );

    // Use a nonce to only allow a specific script to be run.
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
<!--
                    <label for="ya-gpt-model">Модель: </label>
                    <select id="ya-gpt-model" class="model-select">
                        <option value="yandexgpt-lite">YandexGPT Lite</option>
                        <option value="yandexgpt">YandexGPT Pro</option>
                    </select>
-->
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

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
