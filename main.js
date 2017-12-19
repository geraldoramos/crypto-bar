const { app, globalShortcut, BrowserWindow, Menu, protocol, ipcMain, Tray } = require('electron');
const log = require('electron-log');
const { autoUpdater } = require("electron-updater");
const path = require('path')
let tray = null
const prompt = require('./prompt');
const pricing = require('./pricing_service');
const notification = require('./notification_service');
const Analytics = require('electron-google-analytics');
const analytics = new Analytics.default('UA-111389782-1');
const Config = require('./config.json');
const machineIdSync = require('node-machine-id').machineIdSync
const Raven = require('raven');

// capture user's unique machine ID
let clientID;
try {
    clientID = machineIdSync()
} catch (error) {
    clientID = 'no-machineid-detected'
}

//-------------------------------------------------------------------
// Logging
//-------------------------------------------------------------------
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');
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
        submenu: [{
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
// Open a window that displays the version when user press CMD+D
//-------------------------------------------------------------------
let win;
let updateAvailable = false

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
    updateAvailable = true
})


autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('Update not available.');
    updateAvailable = false
})
autoUpdater.on('error', (err) => {
    sendStatusToWindow('Error in auto-updater. ' + err);
})
autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    sendStatusToWindow(log_message);
    updateAvailable = false
})

autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('Update downloaded');
    updateAvailable = false
});

app.on('ready', function() {
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Default values for currency and crypto type
    let currency = 'USD'
    let type = 'BTC'

    app.dock.hide();
    tray = new Tray(path.join(__dirname, 'assets', 'btcTemplate.png'))
    tray.setTitle("Fetching...")

    const getImage = type => {
        crypto = Config.tickers.filter(x => type === x.symbol)[0];
        if (crypto && crypto.image && crypto.image.length > 0) {
            return path.join(__dirname, 'assets', crypto.image)
        } else {
            return path.join(__dirname, 'assets', 'blank.png')
        }
    }

    const cryptoTemplates = Config.tickers.map(({ symbol, label }) => ({
        label,
        type: 'radio',
        icon: getImage(symbol),
        click() {
            changeType(symbol);
        }
    }));

    const currencyTemplates = Config.currencies.map(({ symbol, label }) => ({
        label,
        type: 'radio',
        checked: currency === symbol,
        click() {
            changeCurrency(symbol)
        }
    }));

    const contextMenuTemplate = [{
            label: `Crypto Bar ${app.getVersion()}`,
            type: 'normal',
            enabled: false
        }, {
            label: 'Update Available (restart)',
            visible: false,
            click() {
                app.relaunch({
                    args: process.argv.slice(1).concat(['--relaunch'])
                })
                app.exit(0)
            }
        },

        {
            type: 'separator'
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
                notification.reset()
            },
        },
        {
            type: 'separator'
        }, ...cryptoTemplates, {
            type: 'separator'
        }, ...currencyTemplates, {
            type: 'separator'
        }, {
            label: 'Quit',
            accelerator: 'CommandOrControl+Q',
            click() {
                app.quit()
            }
        }
    ];

    const contextMenu = Menu.buildFromTemplate(contextMenuTemplate);
    // show update available menu if there is an update. Check for updates every minute
    if (updateAvailable) {
        contextMenu.items[1].visible = true
    }
    setInterval(() => {
        if (updateAvailable) {
            contextMenu.items[1].visible = true
        }
    }, 6000);

    globalShortcut.register('CommandOrControl+Shift+Control+Option+D', () => {
        createDefaultWindow()
    })

    let newAlert = () => {

        analytics.event('App', 'createdAlert', { evLabel: `version ${app.getVersion()}`, clientID })
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
                    let options = r.split(' ')
                    notification.set(options)
                }

            })
            .catch(console.error);
    }

    analytics.event('App', 'initialLoad', { evLabel: `version ${app.getVersion()}`, clientID })
        .then((response) => {
            log.info(response)
        }).catch((err) => {
            log.error(err)
        });


    // First update
    pricing.update(currency, type).then(data => {
        tray.setTitle(`${data.prefix}${data.rates[type][currency]}`)
        notification.send(data.rates).then(result => {
            log.info(result)
        })
    })

    // pricing.update(currency,type,tray,store)

    // Handle currency change
    const changeCurrency = (newcurrency) => {
        currency = newcurrency

        pricing.update(currency, type).then(data => {
            tray.setTitle(`${data.prefix}${data.rates[type][currency]}`)
            notification.send(data.rates).then(result => {
                log.info(result)
            })
        })
        analytics.event('App', 'changedCurrency', { evLabel: `version ${app.getVersion()}`, clientID })
            .then((response) => {
                log.info(response)
            }).catch((err) => {
                log.error(err)
            });
    }

    // Handle type change
    const changeType = (newType) => {
        type = newType
        pricing.update(currency, type).then(data => {
            tray.setTitle(`${data.prefix}${data.rates[type][currency]}`)
            tray.setImage(getImage(type));
            notification.send(data.rates).then(result => {
                log.info(result)
            })
        })
        analytics.event('App', 'changedType', { evLabel: `version ${app.getVersion()}`, clientID })
            .then((response) => {
                log.info(response)
            }).catch((err) => {
                log.error(err)
            });

    }

    // update prices every 60 seconds
    setInterval(() => {
        pricing.update(currency, type).then((data) => {
            tray.setTitle(`${data.prefix}${data.rates[type][currency]}`)
            notification.send(data.rates).then(result => {
                log.info(result)
            })
        })

        analytics.event('App', 'priceUpdate', { evLabel: `version ${app.getVersion()}`, clientID })
            .then((response) => {
                log.info(response)
            }).catch((err) => {
                log.error(err)
            });
    }, 60000);

    tray.setToolTip('Crypto Bar')
    tray.setContextMenu(contextMenu)
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('ready', function() {
    autoUpdater.checkForUpdatesAndNotify();
});