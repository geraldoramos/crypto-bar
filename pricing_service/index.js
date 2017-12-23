    let currentPrice = {};
    const formatCurrency = require('format-currency')
    let socket;

  //   const Pricing = {
  //     get: async (symbol,currency,exchange) => {
  //         const response = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=${currencies}&e=${exchange}`)
  //         return responses.data
  //     }
  // }

    let Socket = {
      connect: (store,mainWindow, tray, ipcMain, getImage, Config) => {
        socket = require('socket.io-client')('https://streamer.cryptocompare.com/');
        let selectedCurrencies = store.get('preferences').currencies
        let mainCurrency = selectedCurrencies.filter(x=>x.default).map(x=>x.from+x.to+x.exchange)[0]
        let data = {}
        let subscription = []
        let prefix
        for (let i of selectedCurrencies) {
          subscription.push(`2~${i.exchange}~${i.from}~${i.to}`)
          prefix = Config.currencies.filter(x=>x.label==i.to)[0].prefix
        }
        socket.emit('SubAdd', {
          subs: subscription
        });

        ipcMain.on('async', (event, arg) => {  
          if(arg.selected){
            tray.setImage(getImage(arg.selected[0]));
            tray.setTitle(`${arg.selected[4]}${formatCurrency(arg.selected[2])}`)
            mainCurrency = arg.selected[0]+arg.selected[1]+arg.selected[3]
          }
      
      });

        socket.on("m", message => {

          let messageArray = message.split('~')

          // console.log(message)
            subscription.map(x => {
                let xArray = x.split('~')
                if (xArray[2] === messageArray[2] && xArray[3] === messageArray[3]) {
                    let concatData = messageArray.concat(prefix)
                    if(concatData.length === 14){
                    data[concatData[2]+concatData[3]+concatData[1]] = {exchange:concatData[1],from:concatData[2],to:concatData[3],
                      flag:concatData[4],price:concatData[5],volume24h: concatData[10], prefix:concatData[13]}
                      
                    if(concatData[2]+concatData[3]+concatData[1] == mainCurrency){
                      tray.setImage(getImage(concatData[2]));
                      tray.setTitle(`${data[concatData[2]+concatData[3]+concatData[1]].prefix}${formatCurrency(data[concatData[2]+concatData[3]+concatData[1]].price)}`)
                    }
                  }
  
                }
              })
          
          mainWindow.webContents.send('socket', data);

        });

      },

      disconnect: () =>{
        socket.disconnect()
      }

    }

    module.exports = Socket