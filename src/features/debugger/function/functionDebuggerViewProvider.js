const vscode = require("vscode");

const {getNonce} = require("../providerUtils");
const {startDebugger} = require("./debugger");
const {getFunctionSignaturesAndArgs, getImports} = require("../../regexUtils");


/**Debugger View Provider
 * 
 * Interface between the vscode extension and the debug webview envs. 
 * The two components communicate with each other via a message bus
 */
class DebuggerViewProvider{

    static viewType = "huff.debugView";

    constructor(extensionUri){
        this._extensionURI = extensionUri;   
        this._view = null;     
    }

    resolveWebviewView(
        webviewView,
        context,
        _token
    ){
        // Enable scripting within the webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionURI
            ]
        }
        
        // Set the webview's html - written inline
        webviewView.webview.html = this.getHtmlForWebView(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case "loadDocument":{
                    const functionSignatures = getFunctionSignaturesAndArgs(vscode.window.activeTextEditor?.document.getText());
                    this.addOptionsToFunctionSelector(functionSignatures.sighashes);
                    
                    break;
                }
                case "start-debug": {
                    const {selectedFunction, argsArr} = data.values;
                    
                    const imports = getImports(vscode.window.activeTextEditor?.document.getText())

                    startDebugger(
                        vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri).uri.path, 
                        vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri), 
                        imports,
                        selectedFunction, 
                        argsArr, 
                        {}
                    );
                }
            }
        });

        this._view = webviewView;
    }

    /**Add Options to function selector
     * 
     * Send function selectors back to the web view after they have been scraped from the file
     * @param {Object} functionSelectors 
     */
    addOptionsToFunctionSelector(functionSelectors){
        if (this._view){
            this._view.show?.(true);
            this._view.webview.postMessage({ type: "receiveContractInterface", data: functionSelectors })
        }
    }

    /**Get html for webview
     * 
     * Inline create html to be shown in the function debugger webview
     * @param webview 
     * @returns 
     */
    getHtmlForWebView(webview) {
        // local path of main script to run in the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "function", "functions.main.js"));
        const helpersUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "helpers.js"));

        // Do the same for the stylesheet
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview", "css", "vscode.css"));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionURI, "webview","css", "main.css"));

        // Use nonce to allow only a specific script to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <!--
                            Use a content security policy to only allow loading images from https or from our extension directory,
                            and only allow scripts that have a specific nonce.
                        -->
                        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">

                        <link href="${styleVSCodeUri}" rel="stylesheet">
                        <link href="${styleMainUri}" rel="stylesheet">
                                              
                        <title>Huff Debugger</title>
                    </head>
                    <body>
                        <button class="load-interface">Load interface</button>

                        <select id="function-select">
                        </select>

                        <ol class="args-inputs">
                        </ol>
                        
                        <button class="start-debug">Start Debug</button>
                        
                        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
                        <script type="module" nonce="${nonce}" src="${helpersUri}"></script>
                     </body>
                </html>`;
        
    }
}

module.exports = {
    DebuggerViewProvider
}