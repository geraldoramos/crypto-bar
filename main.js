const {app, globalShortcut, BrowserWindow, Menu, protocol, ipcMain, Tray, Notification} = require('electron');
const log = require('electron-log');
const {autoUpdater} = require("electron-updater");
const path = require('path')
const axios = require('axios')
let tray = null
let iconBtc = path.join(__dirname,'assets/btc.png');
let iconEth = path.join(__dirname,'assets/eth.png');
let iconLtc = path.join(__dirname,'assets/ltc.png');
const Store = require('electron-store');
const store = new Store();
const prompt = require('./prompt/lib');

//-------------------------------------------------------------------
// Logging
//-------------------------------------------------------------------
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

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
        click() { app.quit(); }
      },
    ]
  })
}


//-------------------------------------------------------------------
// Crypto API
//-------------------------------------------------------------------
const ticker = async() => {
  let BTC = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD,BRL,EUR,GBP`)
  let ETH = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD,BRL,EUR,GBP`)
  let LTC = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=LTC&tsyms=USD,BRL,EUR,GBP`)
  return {BTC:BTC.data,ETH:ETH.data,LTC:LTC.data}
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

app.on('ready', function() {
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  

  // Default values for currency and crypto type
  let currency = 'USD'
  let type = 'BTC'

  
    app.dock.hide();
    tray = new Tray(iconBtc)
    tray.setTitle("Fetching...")

  
    const contextMenu = Menu.buildFromTemplate([{
        label: `Crypto Bar ${app.getVersion()}`,
        type: 'normal',
        enabled: false
      },
      {
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
          store.set('notifyList',[])
        },
      },
      {
        type: 'separator'
      },
      {
        label: 'BTC',
        type: 'radio',
        checked: true,
        click() {
          changeType('BTC')
        },
      },
      {
        label: 'ETH',
        type: 'radio',
        click() {
          changeType('ETH')
        },
      },
      {
        label: 'LTC',
        type: 'radio',
        click() {
          changeType('LTC')
        },
      },
      {
        type: 'separator'
      },
      {
        label: 'USD',
        type: 'radio',
        checked: true,
        click() {
          changeCurrency('USD')
        }
      },
      {
        label: 'EUR',
        type: 'radio',
        click() {
          changeCurrency('EUR')
        }
      },
      {
        label: 'GBP',
        type: 'radio',
        click() {
          changeCurrency('GBP')
        }
      },
      {
        label: 'BRL',
        type: 'radio',
        click() {
          changeCurrency('BRL')
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        accelerator: 'CommandOrControl+Q',
        click() {
          app.quit()
        }
      }
    ])

    globalShortcut.register('CommandOrControl+D', () => {
      createDefaultWindow()
    })

    let newAlert = () =>{
      prompt({
        title: 'Set New Price Alert',
        label: 'Rule:',
        type: 'input', // 'select' or 'input, defaults to 'input'
    })
    .then((r) => {
      if(r !== null && r.split(' ').length == 4){
        let oldList = store.get('notifyList') || []
        let options = r.split(' ')
        oldList.push ({type:options[0].toUpperCase(),rule:options[1],target:options[2], currency:options[3].toUpperCase()})
        store.set('notifyList', oldList);
      }

    })
    .catch(console.error);

    }

    const updatePrice = async() => {
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

      notifyList = store.get('notifyList');

      let sendNotify = notifyList.filter(x=>{
        return x.rule === 'above' ? x.target < rate[x.type][x.currency] : x.target > rate[x.type][x.currency]
      })

      let notification;
      for(item of sendNotify){

        notification = new Notification({
          title: "Crypto price alert",
          body:`${item.type} is now ${item.rule} ${item.target} ${item.currency}`
        })
        notification.show()

        // notifier.notify({
        //   'title': `Crypto Price Alert`,
        //   'message': `${item.type} is now ${item.rule} ${item.target} ${item.currency}`,
        //   'icon': path.join(__dirname,  'assets/mac_icon.icns'),
        // });
        // remove item from notify list
        let index = notifyList.indexOf(item);
        notifyList.splice(index, 1);
      }
      store.set('notifyList',notifyList);
    }
    // First update
    updatePrice()
  
    // When currency is changed
    const changeCurrency = (newcurrency) => {
      currency = newcurrency
      updatePrice()
    }

    const changeType= (newType) => {
      type = newType
      updatePrice()
      switch (newType) {
        case 'BTC':
        tray.setImage(iconBtc)
          break;
        case 'ETH':
        tray.setImage(iconEth)
          break;
        case 'LTC':
        tray.setImage(iconLtc)
          break;          
        default:
          break;
      }
      
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


app.on('ready', function()  {
  autoUpdater.checkForUpdatesAndNotify();
});