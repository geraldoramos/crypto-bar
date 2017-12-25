'use babel';

import React from 'react';
import {ipcRenderer, remote} from 'electron'
import { Circle } from 'better-react-spinkit'
import Select from 'react-select'
import VirtualizedSelect from 'react-virtualized-select'
import formatCurrency from 'format-currency'
const main = remote.require('./main.js')
const Config = require('../config.json')
const Socket = require('../pricing_service')
const iconColor = {color:'#675BC0'}
let prices;

export default class Main extends React.Component {

  constructor() {
    super()
    this.state = {
      version:null,
      data:[],
      updateAvailable:false,
      updateInfo:'',
      loading:true,
      page:'home',
      subpage:'main',
      prefSubPageData:null,
      currentSettings: {},
      selectedBox: main.store.get('preferences').currencies.filter(x=>x.default).map(x=>x.from+x.to+x.exchange)[0],
      internetOffline: false

    };
    this.handleBox = this.handleBox.bind(this)
    this.handleAppUpdate = this.handleAppUpdate.bind(this)
    this.handlePrefUpdate = this.handlePrefUpdate.bind(this)
    this.handlePageUpdate = this.handlePageUpdate.bind(this)
    this.handleRefreshPref = this.handleRefreshPref.bind(this)
    this.handleOpen = this.handleOpen.bind(this)
    this.handlePrefPageUpdate = this.handlePrefPageUpdate.bind(this)
    this.handleSocket = this.handleSocket.bind(this)
    this.handleOffline = this.handleOffline.bind(this)
  }

  handleBox(from, to, price, exchange, prefix){
    main.tray.setImage(main.getImage(from));
    main.tray.setTitle(`${prefix}${formatCurrency(price)}`)
    this.setState({selectedBox:from+to+exchange})
  }

  handleOpen(url){
    main.open(url)
  }

  handleAppUpdate(){
    main.restart();
  }

  handlePrefUpdate(e,i,option){
    let newSettings = main.store.get('preferences')
    newSettings.currencies[i][option] = e.label
    main.store.set('preferences', newSettings)
    this.setState({currentSettings:main.store.get('preferences')})
  }

  handleRefreshPref(){
    Socket.disconnect()
    Socket.connect(main.store, main.tray, main.getImage, Config, this.handleSocket)
    this.setState({page:'home',internetOffline:false, selectedBox: main.store.get('preferences').currencies.filter(x=>x.default).map(x=>x.from+x.to+x.exchange)[0]})
  }

  handlePageUpdate(page){
    this.setState({page:page})
  }

  handleSocket(data){
    prices = Object.keys(data).map(key => {
      return {priceData:data[key], direction: data[key].flag ==='1' ? 'up' : 'down'}
      })
    this.setState({data:prices})

    if(prices.length == 1){
      this.setState({loading:false})
    }

    // Handle changes in the selected currency for the tray
    let selectedTray = data[this.state.selectedBox] || data[main.store.get('preferences').currencies.filter(x=>x.default).map(x=>x.from+x.to+x.exchange)[0]]
    main.tray.setImage(main.getImage(selectedTray.from));
    main.tray.setTitle(`${selectedTray.prefix}${formatCurrency(selectedTray.price)}`)
  
  }

  handleOffline(){
    this.setState({internetOffline:true})
  }

  handlePrefPageUpdate(destination, data){
    this.setState({subpage:destination,prefSubPageData:data})
  }

  componentWillMount(){
    window.addEventListener('online',  this.handleRefreshPref)
    window.addEventListener('offline',  this.handleOffline)

    this.setState({currentSettings:main.store.get('preferences')})
    // Websocket data
    Socket.connect(main.store, main.tray, main.getImage, Config, this.handleSocket)
    
    ipcRenderer.on('update' , function(event , result) {
        this.setState({updateAvailable:result.updateAvailable,updateInfo:result.updateInfo})
        console.log(result)
    }.bind(this))

    this.setState({version:main.app.getVersion()})
  }

  render() {

    if(this.state.internetOffline){
      return (
        <div className="myarrow">
        <div className="page darwin">
          <div className="container">
            <div className="header">
            <div className="title"><h1><span className="main-title"><i style={iconColor} className="fas fa-signal"/> Dashboard</span>
            <div className="settings" onClick={() => this.handlePageUpdate('settings')}><i style={iconColor} className="fas fa-cog"/></div></h1></div>
            </div>
          <div className="inside">
              <br/>
              <center><i style={iconColor} className="fas fa-frown"/>
              <h2> No internet Connection </h2></center>
              </div>
              {Footer} 
          </div>
        </div>
        </div>
      )
    }
    
    let Footer = (<div className="footer">
    <h2><a onClick={() => this.handleOpen('https://github.com/geraldoramos/crypto-bar')}>Crypto Bar </a> 
    <span className="version">{this.state.version}</span>
    { this.state.updateAvailable ?
    <span>&nbsp;(Restart to Update)</span> : null}
    </h2>
    </div>)

    // Price direction icon
    if(this.state.page === 'home'){
      let preDirection = '1'
      let priceDirection = (dir) => {
        if(dir==="1"){
          preDirection = dir
          return <i className="fas fa-caret-up up"/>
        } else if(dir==="2"){
          preDirection = dir
          return <i className="fas fa-caret-down down"/>
        } else if (dir==='4' && preDirection === '1'){
          preDirection = '1'
          return <i className="fas fa-caret-up up"/>
        }else if (dir==='4' && preDirection === '2'){
          preDirection = '2'
          return <i className="fas fa-caret-down down"/>
        }
      }
      
      let currencyList = this.state.data.map (x =>{
          return (
            <div className="box" href="#" onClick={() => 
            this.handleBox(x.priceData.from,x.priceData.to,x.priceData.price,x.priceData.exchange,x.priceData.prefix)}>
            <div className="currency">{x.priceData.from} <span className="exchange">({x.priceData.exchangeFallback || x.priceData.exchange})</span> </div>
            <div className="price">{x.priceData.prefix}{formatCurrency(x.priceData.price)}&nbsp;
            {x.priceData.volume24h==0 ? null : priceDirection(x.priceData.flag)}</div>
            <div className="volume">{x.priceData.volume24h==0?'no volume data':`V:${formatCurrency(x.priceData.volume24h)}`}</div>
            {this.state.selectedBox === x.priceData.from+x.priceData.to+x.priceData.exchange?
            <div className={"tick"}><i className="fas fa-check"/></div>:null}
          </div>)
      })
    
      const n = 6 - this.state.data.length

      let loadBox = [...Array(n)].map((e, i) => {
        return (
        <div className="box"><br/>
        <center><Circle size={20} color="#675BC0"/>
        <h2>Waiting...</h2></center></div>)
    })

    return (
    <div className="myarrow">
      <div className="page darwin">
        <div className="container">
          <div className="header">
          <div className="title"><h1><span className="main-title"><i style={iconColor} className="fas fa-signal"/> Dashboard</span>
          <div className="settings" onClick={() => this.handlePageUpdate('settings')}><i style={iconColor} className="fas fa-cog"/></div></h1></div>
          </div>
        <div className="inside">
          <div className="row">
              {currencyList}
              {loadBox}
            </div>
            </div>
            {Footer} 
        </div>
      </div>
      </div>
    )
  }

  if(this.state.page === 'settings'){

    let SubOptions = this.state.currentSettings.currencies.map((x,i) => {
    return  (<div className="submenuRow">
    <VirtualizedSelect
    name="fromOptions"
    className={i > 2 ? 'open-top' : null}
    style={{width:'80px',margin:'2px'}}
    clearable={false}
    scrollMenuIntoView={true}
    value={{label:x.from,value:x.from}}
    onChange={(e) => this.handlePrefUpdate(e,i,'from')}
    options={Config.tickers.map(x=>{return {label:x.label,value:x.value}})}
  />
    <VirtualizedSelect
    name="toOptions"
    className={i > 2 ? 'open-top' : null}
    style={{width:'80px',margin:'2px'}}
    clearable={false}
    scrollMenuIntoView={false}
    value={{label:x.to,value:x.to}}
    onChange={(e) => this.handlePrefUpdate(e,i,'to')}
    options={Config.currencies.map(x=>{return {label:x.label,value:x.value}})}
  />
  <VirtualizedSelect
    name="exchange"
    className={i > 2 ? 'open-top' : null}
    style={{width:'80px',margin:'2px'}}
    clearable={false}
    scrollMenuIntoView={false}
    value={{label:x.exchange,value:x.exchange}}
    onChange={(e) => this.handlePrefUpdate(e,i,'exchange')}
    options={Config.exchanges.map(x=>{return {value:x,label:x}})}
  />
  {/* Implementation for alerts coming */}
  {/* <div onClick={(e) => this.handlePrefPageUpdate('alerts',{from:x.from, to:x.to, exchange:x.exchange})}><i className="fas fa-bell bell"/></div> */}
  </div>)

  })

  let prefOptions = () => {
    if(this.state.subpage==='main'){
      return (<div><div className="submenu-subtitle">Select the currencies to monitor (From, To, Exchange)</div>
      {SubOptions}
      <center><h2><a onClick={this.handleRefreshPref}>
      <i className="fas fa-sync-alt"/>&nbsp; Update</a></h2></center></div>)
    }
    if(this.state.subpage==='alerts'){
      return (<div><div className="submenu-subtitle">{`Add new alert for 
      ${this.state.prefSubPageData.from}/${this.state.prefSubPageData.to}/${this.state.prefSubPageData.exchange}`}</div>
        <div className="submenuRow">If value [rule] [target]</div>
        <hr/>
        <div className="submenu-subtitle">Current alerts for this combination:</div>

        </div>)
    }
  }
      
  return (
    <div className="myarrow">
      <div className="page darwin">
        <div className="container">
          <div className="header">
          <div className="title"><h1><span className="main-title"><i style={iconColor} className="fas fa-cog"/> Settings</span>
          <div className="settings" onClick={() => this.handlePageUpdate('home')}><i style={iconColor} className="fas fa-signal"/></div></h1></div>
          </div>
        <div className="inside">
          {prefOptions()}
        </div></div>
        {Footer}
      </div>
      </div>)
    }

  }
}
