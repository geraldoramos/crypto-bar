const electron = require('electron');
const BrowserWindow = electron.BrowserWindow || electron.remote.BrowserWindow;
const ipcMain = electron.ipcMain || electron.remote.ipcMain;
const url = require('url');
const path = require('path');

function electronPrompt(options, parentWindow) {
    return new Promise((resolve, reject) => {
        const id = `${new Date().getTime()}-${Math.random()}`;

        const opts = Object.assign({
            title: 'Prompt',
            label: 'Please input a value:',
            alwaysOnTop: false,
            value: null,
            type: 'input',
            selectOptions: null
        }, options || {});

        if(opts.type == 'select' && (opts.selectOptions === null || typeof(opts.selectOptions) !== 'object')) {
            return reject(new Error('"selectOptions" must be an object'));
        }

        let promptWindow = new BrowserWindow({
            width: 370, height: 150,
            resizable: false,
            parent: parentWindow ? (parentWindow instanceof BrowserWindow) : null,
            skipTaskbar: true,
            alwaysOnTop: opts.alwaysOnTop,
            useContentSize: true,
            modal: parentWindow ? true : false,
            title : opts.title
        });

        promptWindow.setMenu(null);

        const getOptionsListener = (event) => {
            event.returnValue = JSON.stringify(opts);
        };

        const postDataListener = (event, value) => {
            resolve(value);
            event.returnValue = null;
            cleanup();
        };

        const unresponsiveListener = () => {
            console.log('olar?')
            reject(new Error('Window was unresponsive'));
            cleanup();
        };

        const errorListener = (event, message) => {
            console.log('olar2?')
            reject(new Error(message));
            event.returnValue = null;
            cleanup();
        };

        const cleanup = () => {
            if (promptWindow) {
                promptWindow.hide();
                promptWindow = null;
            }
        };

        ipcMain.on('prompt-get-options:' + id, getOptionsListener);
        ipcMain.on('prompt-post-data:' + id, postDataListener);
        ipcMain.on('prompt-error:' + id, errorListener);
        promptWindow.on('unresponsive', unresponsiveListener);

        promptWindow.on('closed', () => {
            ipcMain.removeListener('prompt-get-options:' + id, getOptionsListener);
            ipcMain.removeListener('prompt-post-data:' + id, postDataListener);
            ipcMain.removeListener('prompt-error:' + id, postDataListener);
            resolve(null);
        });

        const promptUrl = url.format({
            protocol: 'file',
            slashes: true,
            pathname: path.join(__dirname, 'page', 'prompt.html'),
            hash: id
        });

        promptWindow.loadURL(promptUrl);
    });
}

module.exports = electronPrompt;