const axios = require('axios')
const Config = require('../config.json');

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

    update: async (currency,type) => {
        rate = await Pricing.get()
        const prefix = Config.currencies
            .filter(c => c.symbol === currency)
            .map(c => c.prefix)[0] || '';
        
        return {prefix: prefix, rates: rate}

        // tray.setTitle(`${prefix}${rate[type][currency]}`)        
    
    }
}

module.exports = Pricing;
