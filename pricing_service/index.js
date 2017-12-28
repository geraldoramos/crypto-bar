    let currentPrice = {};
    const formatCurrency = require('format-currency')
    const axios = require('axios')
    const _ = require('underscore')
    let socket;

    // HTTP API is used as the primary source of prices
    const HTTP = async(data, Config) => {
      const requests = data.map(async(x) => {
        let url = `https://min-api.cryptocompare.com/data/price?fsym=${x.from}&tsyms=${x.to}&e=${x.exchange}`
        let res = await axios.get(url)
        let exchange = x.exchange
        let exchangeFallback = false

        if (res.data[x.to] == undefined) {
          url = `https://min-api.cryptocompare.com/data/price?fsym=${x.from}&tsyms=${x.to}`
          res = await axios.get(url)
          exchangeFallback = 'CCCAGG'
        }

        let uniqueId = x.from + x.to + x.exchange
        let from = x.from
        let to = x.to
        return {
          uniqueId,
          exchange,
          exchangeFallback,
          from,
          to,
          data: res.data
        }
      });
      const responses = await axios.all(requests)

      return responses.reduce((accum, res) => {
        let prefix = Config.currencies.filter(x => x.label === res.to)[0].prefix
        accum[res.uniqueId] = {
          exchange: res.exchange,
          exchangeFallback: res.exchangeFallback,
          from: res.from,
          to: res.to,
          flag: 4,
          price: res.data[res.to],
          volume24h: 0,
          prefix: prefix
        }
        return accum
      }, {})
    }
    let refreshIntervalId;

    let Socket = {

      connect: (store, tray,  getImage, Config, state) => {
        socket = require('socket.io-client')('https://streamer.cryptocompare.com/');
        let selectedCurrencies = store.get('preferences').currencies
        let data = {}
        let dataBkp = {}
        let dataFallback = {}
        let subscription = []
        for (let i of selectedCurrencies) {
          subscription.push(`2~${i.exchange}~${i.from}~${i.to}`)
        }

        socket.emit('SubAdd', {
          subs: subscription
        });

        HTTP(selectedCurrencies, Config).then(result => {
          dataBkp = result
        })

        // remove previous interval if existing
        if(refreshIntervalId){
          clearInterval(refreshIntervalId);
        }

        // create new interval for pooling
        refreshIntervalId = setInterval(() => {
          HTTP(selectedCurrencies, Config).then(result => {
            dataBkp = result
          })
        }, 30000);

        state(Object.assign(dataBkp, data))

        // throttle state updates to prevent performance degradation
        let throttle = _.throttle(state,5000)

        socket.on("m", message => {
           
          let messageArray = message.split('~')

          subscription.map(x => {
            let xArray = x.split('~')
            if (xArray[2] === messageArray[2] && xArray[3] === messageArray[3]) {
              let prefix = Config.currencies.filter(x => x.label === messageArray[3])[0].prefix
              let concatData = messageArray.concat(prefix)
              if (concatData.length === 14) {
                data[concatData[2] + concatData[3] + concatData[1]] = {
                  exchange: concatData[1],
                  from: concatData[2],
                  to: concatData[3],
                  flag: concatData[4],
                  price: concatData[5],
                  volume24h: concatData[10],
                  prefix: concatData[13]
                }
              }
            }
          })
          throttle(Object.assign(dataBkp, data))
        });

      },

      disconnect: () => {
        socket.disconnect()
      }

    }

    module.exports = Socket