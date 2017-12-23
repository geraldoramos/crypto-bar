const {Notification} = require('electron');
const Store = require('electron-store');
const store = new Store();

const Notify = {
  send: (allRates) => {
    return new Promise((resolve) => {
      let notifyList = store.get('notifyList') || [];
      let sendNotify = notifyList.filter(x => {
        return x.rule === 'above' ? x.target < allRates[x.type][x.currency] : x.target > allRates[x.type][x.currency]
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
      if (sendNotify.length > 0) {
        resolve(`Notification: Sent on ${new Date()}`)
      } else {
        resolve(`Notification: Nothing to send`)
      }

    });
  },
  reset: () => {
    store.set('notifyList', [])
  },
  set: options => {
    let oldList = store.get('notifyList') || []
    oldList.push({
      type: options[0].toUpperCase(),
      rule: options[1],
      target: options[2],
      currency: options[3].toUpperCase()
    })
    store.set('notifyList', oldList);
  }
}

module.exports = Notify