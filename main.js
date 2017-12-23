import { app, globalShortcut, BrowserWindow, Menu, protocol, ipcMain, Tray } from 'electron'
import log from 'electron-log'
import { autoUpdater } from "electron-updater"
import path from 'path'
import prompt from './prompt'
import socket from './pricing_service'
import notification  from './notification_service'
import Analytics from 'electron-google-analytics';
const analytics = new Analytics('UA-111389782-1');
import Config from './config.json'
import {machineIdSync} from 'node-machine-id'
import Raven from 'raven'
import Positioner from 'electron-positioner'
import Store from 'electron-store'
const store = new Store();

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
// Starting variables
//-------------------------------------------------------------------

let mainWindow
let updateAvailable = false
let tray = null


const sendStatusToWindow = (text) => {
  log.info(text);
  
  if(text === 'Update downloaded'){
    updateAvailable = true
  }

  mainWindow.webContents.send('update', {
    updateAvailable: updateAvailable,
    updateInfo: text
  });

}

function createWindow () {


  autoUpdater.checkForUpdatesAndNotify();


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
   
  mainWindow = new BrowserWindow({
    width: 400,
    height: 435,
    transparent: true,
    frame: false,
    webPreferences: {
      devTools: true
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true);
  
  app.dock.hide();

  tray = new Tray(path.join(__dirname, 'assets', 'btcTemplate.png'))
  tray.setTitle("Fetching...")

  const getImage = type => {
    let crypto = Config.tickers.filter(x => type === x.symbol)[0];
    if (crypto && crypto.image && crypto.image.length > 0) {
        return path.join(__dirname, 'assets', crypto.image)
    } else {
        return path.join(__dirname, 'assets', 'blank.png')
    }
}


setInterval(() => {
  if (updateAvailable) {
    mainWindow.webContents.send('update', {
      updateAvailable: true
    });
  }
}, 10000);

// hiden shortcut for debugging
globalShortcut.register('CommandOrControl+Shift+Control+Option+D', () => {
  app.dock.show();
  mainWindow.webContents.openDevTools()
})

exports.app = app

analytics.event('App', 'initialLoad', { evLabel: `version ${app.getVersion()}`, clientID })
  .then((response) => {
      log.info(response)
  }).catch((err) => {
      log.error(err)
  });

// Heartbeat
setTimeout(() => {
  analytics.event('App', 'heartBeat', { evLabel: `version ${app.getVersion()}`, clientID })
  .then((response) => {
      log.info(response)
  }).catch((err) => {
      log.error(err)
  });
}, 30000);


  tray.setToolTip('Crypto Bar')
  mainWindow.loadURL('file://' + __dirname + '/index.html')
  

  let initPreferences = {
    currencies:[{
        exchange: 'Coinbase',
        from: 'BTC',
        to: 'USD',
        default:true
      },
      {
        exchange: 'Coinbase',
        from: 'ETH',
        to: 'USD',
        default:false
      },
      {
        exchange: 'Coinbase',
        from: 'LTC',
        to: 'USD',
        default:false
      },
      {
        exchange: 'Bitfinex',
        from: 'XRP',
        to: 'USD',
        default:false
      },
      {
        exchange: 'Coinbase',
        from: 'BCH',
        to: 'USD',
        default:false
      },
      {
        exchange: 'Bitfinex',
        from: 'IOT',
        to: 'USD',
        default:false
      }],
      toCurrency: {symbol:'USD',prefix:"$"}
    }

    store.set('preferences', store.get('preferences') || initPreferences);

    let connect = ()=> {
      log.info('Connecting to socket')
      socket.connect(store,mainWindow,tray,ipcMain,getImage,Config)
    }

    connect()

    let disconnect = ()=> {
      log.info('Disconnecting from socket')
      socket.disconnect()
    }

    exports.connect = connect
    exports.disconnect = disconnect
    


  const positioner = new Positioner(mainWindow)
  let bounds = tray.getBounds()
  positioner.move('trayCenter', bounds)

  mainWindow.on('blur', () => {
    mainWindow.hide()
  })

  exports.restart = () => {  
    //Print 6
    app.relaunch({
      args: process.argv.slice(1).concat(['--relaunch'])
  })
  app.exit(0)
}

exports.store = store

  tray.on('click', () => {
    bounds = tray.getBounds()
    positioner.move('trayCenter', bounds)
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
  mainWindow.on('show', () => {
    tray.setHighlightMode('always')
  })
  mainWindow.on('hide', () => {
    tray.setHighlightMode('never')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })


}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
