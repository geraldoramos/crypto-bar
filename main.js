const {app, globalShortcut, BrowserWindow, Menu, protocol, ipcMain, Tray, Notification} = require('electron');
const log = require('electron-log');
const {autoUpdater} = require("electron-updater");
const path = require('path')
const axios = require('axios')
let tray = null
const Store = require('electron-store');
const store = new Store();
const prompt = require('./prompt/lib');
const Analytics = require('electron-google-analytics');
const analytics = new Analytics.default('UA-111389782-1');
const Config = require('./config.json');

//-------------------------------------------------------------------
// Logging
//-------------------------------------------------------------------
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');
var Raven = require('raven');
Raven.config('https://e254805a5b5149d48d6561ae035dd19c:26a8736adf7c4ae08464ac3483eca1d2@sentry.io/260576').install();

//-------------------------------------------------------------------
// Define the menu
//-------------------------------------------------------------------
let template = []
if (process.platform === 'darwin') {
    // OS X
    const name = app.getName();
    template.unshift({
        label: name,
        submenu: [
            {
                label: 'About ' + name,
                role: 'about'
            },
            {
                label: 'Quit',
                accelerator: 'Command+Q',
                click() {
                    app.quit();
                }
            },
        ]
    })
}


//-------------------------------------------------------------------
// Crypto API
//-------------------------------------------------------------------
const ticker = async () => {
    const requests = Config.tickers.map(async ({ ticker }) => {
        const url = `https://min-api.cryptocompare.com/data/price?fsym=${ticker}&tsyms=USD,BRL,EUR,GBP`;
        const res = await axios.get(url);
        return { ticker, data: res.data };
    });
    const responses = await axios.all(requests)
    return responses.reduce((accum, res) => {
        accum[res.ticker] = res.data;
        return accum;
    }, {});
}


//-------------------------------------------------------------------
// Open a window that displays the version when user press CMD+D
//-------------------------------------------------------------------
let win;

function sendStatusToWindow(text) {
    log.info(text);
    win.webContents.send('message', text);
}

function createDefaultWindow() {
    win = new BrowserWindow();
    win.webContents.openDevTools();
    win.on('closed', () => {
        win = null;
    });
    win.loadURL(`file://${__dirname}/version.html#v${app.getVersion()}`);
    return win;
}

autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for update...');
})
autoUpdater.on('update-available', (info) => {
    sendStatusToWindow('Update available.');
})
autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('Update not available.');
})
autoUpdater.on('error', (err) => {
    sendStatusToWindow('Error in auto-updater. ' + err);
})
autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    sendStatusToWindow(log_message);
})

autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('Update downloaded');
});

app.on('ready', function () {
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);


    // Default values for currency and crypto type
    let currency = 'USD'
    let type = 'BTC'


    app.dock.hide();
    tray = new Tray(path.join(__dirname, 'assets', 'btc.png'))
    tray.setTitle("Fetching...")

    const cryptoTemplates = Config.tickers.map(({ ticker, label }) => ({
        label,
        type: 'radio',
        click() {
            changeType(ticker);
        }
    }));

    const contextMenuTemplate = [{
        label: `Crypto Bar ${app.getVersion()}`,
        type: 'normal',
        enabled: false
    }, {
        label: 'Set new alert',
        type: 'normal',
        click() {
            newAlert()
        },
    },
    {
        label: 'Reset alerts',
        type: 'normal',
        click() {
            store.set('notifyList', [])
        },
    },
    {
        type: 'separator'
    }, ...cryptoTemplates, {
        type: 'separator'
    }, {
        label: 'USD',
        type: 'radio',
        checked: true,
        click() {
            changeCurrency('USD')
        }
    }, {
        label: 'EUR',
        type: 'radio',
        click() {
            changeCurrency('EUR')
        }
    }, {
        label: 'GBP',
        type: 'radio',
        click() {
            changeCurrency('GBP')
        }
    }, {
        label: 'BRL',
        type: 'radio',
        click() {
            changeCurrency('BRL')
        }
    }, {
        type: 'separator'
    }, {
        label: 'Quit',
        accelerator: 'CommandOrControl+Q',
        click() {
            app.quit()
        }
    }];

    const contextMenu = Menu.buildFromTemplate(contextMenuTemplate);

    globalShortcut.register('CommandOrControl+D', () => {
        createDefaultWindow()
    })

    let newAlert = () => {

        analytics.event('App', 'createdAlert', {evLabel: `version ${app.getVersion()}`})
            .then((response) => {
                log.info(response)
            }).catch((err) => {
            log.error(err)
        });

        prompt({
            title: 'Set New Price Alert',
            label: 'Rule:',
            type: 'input', // 'select' or 'input, defaults to 'input'
        })
            .then((r) => {
                if (r !== null && r.split(' ').length == 4) {
                    let oldList = store.get('notifyList') || []
                    let options = r.split(' ')
                    oldList.push({
                        type: options[0].toUpperCase(),
                        rule: options[1],
                        target: options[2],
                        currency: options[3].toUpperCase()
                    })
                    store.set('notifyList', oldList);
                }

            })
            .catch(console.error);
    }

    analytics.event('App', 'initialLoad', {evLabel: `version ${app.getVersion()}`})
        .then((response) => {
            log.info(response)
        }).catch((err) => {
        log.error(err)
    });

    const updatePrice = async () => {
        rate = await ticker()
        switch (currency) {
            case 'USD':
                tray.setTitle(`$${rate[type][currency]}`)
                break;
            case 'EUR':
                tray.setTitle(`€${rate[type][currency]}`)
                break;
            case 'GBP':
                tray.setTitle(`£${rate[type][currency]}`)
                break;
            case 'BRL':
                tray.setTitle(`R$${rate[type][currency]}`)
                break;
        }

        notifyList = store.get('notifyList') || [];

        let sendNotify = notifyList.filter(x => {
            return x.rule === 'above' ? x.target < rate[x.type][x.currency] : x.target > rate[x.type][x.currency]
        })

        let notification;
        for (item of sendNotify) {

            notification = new Notification({
                title: "Crypto price alert",
                body: `${item.type} is now ${item.rule} ${item.target} ${item.currency}`
            })
            notification.show()

            // remove item from notify list
            let index = notifyList.indexOf(item);
            notifyList.splice(index, 1);
        }
        store.set('notifyList', notifyList);
    }
    // First update
    updatePrice()

    // When currency is changed
    const changeCurrency = (newcurrency) => {
        currency = newcurrency
        updatePrice()
        analytics.event('App', 'changedCurrency', {evLabel: `version ${app.getVersion()}`})
            .then((response) => {
                log.info(response)
            }).catch((err) => {
            log.error(err)
        });
    }

    const changeType = (newType) => {
        type = newType
        updatePrice()

        const crypto = Config.tickers.filter(x => type === x.ticker)[0];
        if (crypto && crypto.image && crypto.image.length > 0) {
            const image = path.join(__dirname, 'assets', crypto.image);
            tray.setImage(image);
        } else {
            tray.setImage(path.join(__dirname, 'assets', 'blank.png'));
        }

        analytics.event('App', 'changedType', {evLabel: `version ${app.getVersion()}`})
            .then((response) => {
                log.info(response)
            }).catch((err) => {
            log.error(err)
        });

    }

    // update prices every 60 seconds
    setInterval(() => {
        updatePrice()
    }, 60000);

    tray.setToolTip('Crypto Bar')
    tray.setContextMenu(contextMenu)

});
app.on('window-all-closed', () => {
    app.quit();
});


app.on('ready', function () {
    autoUpdater.checkForUpdatesAndNotify();
});