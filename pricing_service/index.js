const axios = require('axios')
const Config = require('../config.json');
const {Notification} = require('electron');

const Pricing = {
    get: async () => {
        const currencies = Config.currencies.map(c => c.symbol).join(',');
        const requests = Config.tickers.map(async ({ symbol }) => {
            const url = `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=${currencies}`;
            const res = await axios.get(url);
            return { symbol, data: res.data };
        });
        const responses = await axios.all(requests)
        return responses.reduce((accum, res) => {
            accum[res.symbol] = res.data;
            return accum;
        }, {});
    },

    update: async (currency,type,tray,store) => {
        rate = await Pricing.get()
        const prefix = Config.currencies
            .filter(c => c.symbol === currency)
            .map(c => c.prefix)[0] || '';
        tray.setTitle(`${prefix}${rate[type][currency]}`)        
    
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
}

module.exports = Pricing;
