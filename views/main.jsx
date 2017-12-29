'use babel';

import React from 'react';
import {ipcRenderer, remote} from 'electron'
import { Circle } from 'better-react-spinkit'
import Select from 'react-select'
import VirtualizedSelect from 'react-virtualized-select'
import formatCurrency from 'format-currency'
import { Scrollbars } from 'react-custom-scrollbars';
const {Menu, MenuItem} = remote
const main = remote.require('./main.js')
const Config = require('../config.json')
const Socket = require('../pricing_service')
const iconColor = {color:'#675BC0'}
const menu = new Menu()
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
      currentSettings: {},
      selectedBox: main.store.get('preferences').currencies.filter(x=>x.default)
      .map(x=>x.from+x.to+x.exchange)[0],
      internetOffline: false,
      pairDropdownFrom: null,
      pairDropdownTo: null,
      pairDropdownExchange: null
    };

    this.handleBox = this.handleBox.bind(this)
    this.handlePairAdd = this.handlePairAdd.bind(this)
    this.handlePairDropdownFrom = this.handlePairDropdownFrom.bind(this)
    this.handlePairDropdownTo = this.handlePairDropdownTo.bind(this)
    this.handlePairDropdownExchange = this.handlePairDropdownExchange.bind(this)
    this.handlePairDelete = this.handlePairDelete.bind(this)
    this.handlePageUpdate = this.handlePageUpdate.bind(this)
    this.handleRefreshPref = this.handleRefreshPref.bind(this)
    this.handleOpen = this.handleOpen.bind(this)
    this.handleSettingsButton = this.handleSettingsButton.bind(this)
    this.handleSocket = this.handleSocket.bind(this)
    this.handleOffline = this.handleOffline.bind(this)
    this.handleSubpage = this.handleSubpage.bind(this)
  }

  handleBox(from, to, price, exchange, prefix){
    let newSettings = main.store.get('preferences')
    newSettings['currencies'] = newSettings['currencies'].map(x=>{
      if(x.from === from && x.to === to && x.exchange === exchange){
        return {
          "exchange": x.exchange,
          "from": x.from,
          "to": x.to,
          "default": true
        }} else{
        return {
          "exchange": x.exchange,
          "from": x.from,
          "to": x.to,
          "default": false
          }
        }
    })
    main.store.set('preferences', newSettings)
    main.tray.setImage(main.getImage(from));
    main.tray.setTitle(`${prefix}${formatCurrency(price)}`)
    this.setState({currentSettings:newSettings,subpage:'main'})
    this.setState({selectedBox:from+to+exchange})
  }

  handleOpen(url){
    main.open(url)
  }

  handlePairDropdownFrom(e){
    this.setState({pairDropdownFrom:e})
  }
  handlePairDropdownTo(e){
    this.setState({pairDropdownTo:e})
  }
  handlePairDropdownExchange(e){
    this.setState({pairDropdownExchange:e})
  }

  handlePairDelete(item){
    let newSettings = main.store.get('preferences')
    newSettings['currencies'] = newSettings.currencies
    .filter((x,index)=>{return item !== index})
    main.store.set('preferences', newSettings)
    this.setState({currentSettings:newSettings})
    Socket.disconnect()
    Socket.connect(main.store, main.tray, main.getImage, Config, this.handleSocket)
  }

  handlePairAdd(e){
    e.preventDefault();
    let newSettings = main.store.get('preferences')
    let newItem = [{
      "exchange": this.state.pairDropdownExchange.value,
      "from": this.state.pairDropdownFrom.value,
      "to": this.state.pairDropdownTo.value,
      "default": false
    }]
    newSettings['currencies'] = newSettings['currencies'].concat(newItem)
    main.store.set('preferences', newSettings)
    this.setState({currentSettings:newSettings,subpage:'main'})
    Socket.disconnect()
    Socket.connect(main.store, main.tray, main.getImage, Config, this.handleSocket)
  }

  handleRefreshPref(){
    Socket.disconnect()
    Socket.connect(main.store, main.tray, main.getImage, Config, this.handleSocket)
    this.setState({page:'home',internetOffline:false})
  }

  handlePageUpdate(page){
    this.setState({page:'currencies'})
  }

  handleSubpage(e){
    this.setState({subpage:e})
    this.setState({pairDropdownExchange:null,pairDropdownFrom:null,pairDropdownTo:null})

  }

  handleSocket(data) {
    if (main.store.get('preferences').currencies.length !== 0) {
      prices = Object.keys(data).map(key => {
        return {
          priceData: data[key],
          direction: data[key].flag === '1' ? 'up' : 'down'
        }
      })
      this.setState({data: prices})

      if (prices.length > 0) {
        this.setState({loading: false})
      }

      if (prices.length == 0) {
        this.setState({loading: true})
      }

      try {
        // Handle changes in the selected currency for the tray
        let selectedTray = main.store.get('preferences').currencies.filter(x => x.default)[0] || main.store.get('preferences').currencies[0]
        let trayData = data[selectedTray.from + selectedTray.to + selectedTray.exchange]
        main.tray.setImage(main.getImage(selectedTray.from));
        main.tray.setTitle(`${trayData.prefix}${formatCurrency(trayData.price)}`)
      } catch (error) {
        console.log("Couldn't change the tray image")
      }
    } else {
      this.setState({
        data: [],
        loading: false
      })
        // No currency being monitored
        main.tray.setImage(main.getImage('blank'));
        main.tray.setTitle(`Empty`)

    }
  }

  handleOffline(){
    this.setState({internetOffline:true})
  }

  handleSettingsButton(){
    if(this.state.subpage == 'main'){
      this.setState({page:'home'})
    }else{
      this.setState({subpage:'main'})
    }
  }

  componentWillMount(){
    // right click menu
    let changePage= page=>{
      this.setState({page:page})
    }
    menu.append(new MenuItem({label: 'About Crypto Bar', click() { main.open('https://github.com/geraldoramos/crypto-bar') }}))
    menu.append(new MenuItem({type: 'separator'}))
    menu.append(new MenuItem({label: 'Currencies', click() { changePage('currencies') }}))
    menu.append(new MenuItem({type: 'separator'}))
    menu.append(new MenuItem({label: 'Quit',accelerator:'CommandOrControl+Q', click() { main.app.quit() }}))

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      menu.popup(remote.getCurrentWindow())
    }, false)

    // Detect internet connection state
    window.addEventListener('online',  this.handleRefreshPref)
    window.addEventListener('offline',  this.handleOffline)

    // Get current settings
    this.setState({currentSettings:main.store.get('preferences')})
    this.setState({version:main.app.getVersion()})

    // Websocket data
    try {
      Socket.connect(main.store, main.tray, main.getImage, Config, this.handleSocket)
    } catch (error) {
      this.setState({loading:true})
      Socket.disconnect()
      Socket.connect(main.store, main.tray, main.getImage, Config, this.handleSocket)
    }
    

    // Handle main events
    ipcRenderer.on('update' , function(event , result) {
        this.setState({updateAvailable:result.updateAvailable,updateInfo:result.updateInfo})
        if(result.updateAvailable){
          console.log(result)
        }
    }.bind(this))

    ipcRenderer.on('suspend' , function(event , result) {
      this.handleOffline()
    }.bind(this))

    ipcRenderer.on('resume' , function(event , result) {
      this.handleRefreshPref()
    }.bind(this))

  }

  render() {

    if(this.state.internetOffline){
      return (
        <div className="myarrow">
        <div className="page darwin">
          <div className="container">
            <div className="header">
            <div className="title"><h1><span className="main-title">
            <i style={iconColor} className="fas fa-signal"/> Dashboard</span>
            <div className="settings" onClick={() => this.handlePageUpdate('settings')}>
            <i style={iconColor} className="fas fa-cog"/></div></h1></div>
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

    if(this.state.loading){
      return (
        <div className="myarrow">
        <div className="page darwin">
          <div className="container">
            <div className="header">
            <div className="title"><h1><span className="main-title">
            <i style={iconColor} className="fas fa-signal"/> Dashboard</span>
            <div className="settings" onClick={() => this.handlePageUpdate('settings')}>
            <i style={iconColor} className="fas fa-cog"/></div></h1></div>
            </div>
          <div className="inside">
              <br/>
              <center><Circle size={20} color="#675BC0"/>
              <h2> Fetching data </h2></center>
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
      
      let currencyList = this.state.data.map ((x,i) =>{
          return (
            <div className="box" href="#" key={i} onClick={() => 
            this.handleBox(x.priceData.from, x.priceData.to, x.priceData.price, x.priceData.exchange, x.priceData.prefix)}>
            <div className="currency">{x.priceData.from} <span className="exchange">
            ({x.priceData.exchangeFallback || x.priceData.exchange})</span> </div>
            <div className="price">{x.priceData.prefix}{formatCurrency(x.priceData.price)}&nbsp;
            {x.priceData.volume24h==0 ? null : priceDirection(x.priceData.flag)}</div>
            <div className="volume">
            {x.priceData.volume24h==0?'no volume data':`V:${formatCurrency(x.priceData.volume24h)}`}</div>
            {this.state.selectedBox === x.priceData.from + x.priceData.to + x.priceData.exchange ?
            <div className={"tick"}><i className="fas fa-check"/></div>:null}
          </div>)
      })

    return (
    <div className="myarrow">
      <div className="page darwin">
        <div className="container">
          <div className="header">
          <div className="title"><h1><span className="main-title">
          <i style={iconColor} className="fas fa-signal"/> Dashboard</span>
          <div className="settings" onClick={() => this.handlePageUpdate('settings')}>
          <i style={iconColor} className="fas fa-cog"/></div></h1></div>
          </div>
        <div className="inside">
        {currencyList.length == 0 ? <center><h2> Empty List, add some pairs! </h2></center>:null}
        {currencyList.length > 6 ? <Scrollbars autoHeight autoHide autoHeightMin={340}>
          <div className="row">
              {currencyList}
            </div>
            </Scrollbars>:
            <div className="row">
            {currencyList}
            </div>}
            </div>
            {Footer} 
        </div>
      </div>
      </div>
    )
  }

  if(this.state.page === 'currencies'){

  let SubOptions = this.state.currentSettings.currencies.map((x,i) => {
    return  (<div className="currencies-list" key={i}><div className="currencies-item">
      {x.from} &nbsp;
      <i style={{color:'#C6CED4'}} className="fas fa-angle-right"/>&nbsp;
      {x.to}&nbsp;
      <i style={{color:'#C6CED4'}} className="fas fa-angle-right"/>&nbsp;
       {x.exchange}
       <div className="erase" onClick={() => this.handlePairDelete(i)}><i className="fas fa-minus-circle"/></div>
  </div></div>)

  })

  let subPage = () => {
    if(this.state.subpage==='main'){
      return (<div><div className="submenu-subtitle"><strong>Currently monitored pairs</strong></div>
      <Scrollbars autoHide autoHeight autoHeightMin={265}>
      {SubOptions.length==0?<div className="empty-list">The list is empty, add a pair below.</div>:SubOptions}
      </Scrollbars>
      <div onClick={() => this.handleSubpage('add')} className="add-pair">
      <i className="fas fa-2x fa-plus-circle"/></div>
      </div>)
    }
    if(this.state.subpage==='add'){
      return (<div><div className="submenu-subtitle"><strong>Add new pair </strong><br/>If there is no data 
      available for selected exchange, <a onClick={()=> {this.handleOpen('http://bit.ly/2pH6R7N')}}>
      CryptoCompare</a> Index is used</div>
        <form onSubmit={this.handlePairAdd}>
        <div className="submenuRow">
          <VirtualizedSelect
          required
          name="fromOptions"
          style={{width:'70px',margin:'2px'}}
          value={this.state.pairDropdownFrom}
          clearable={false}
          scrollMenuIntoView={true}
          placeholder="From"
          onChange={this.handlePairDropdownFrom}
          options={Config.tickers.map(x=>{return {label:x.label,value:x.label}})}
        />
          <VirtualizedSelect
          required
          name="toOptions"
          style={{width:'70px',margin:'2px'}}
          value={this.state.pairDropdownTo}
          clearable={false}
          scrollMenuIntoView={false}
          placeholder="To"
          onChange={this.handlePairDropdownTo}
          options={Config.currencies.map(x=>{return {label:x.label,value:x.label}})}
        />
        <VirtualizedSelect
          required
          name="Exchange"
          style={{width:'90px',margin:'2px'}}
          value={this.state.pairDropdownExchange}
          clearable={false}
          scrollMenuIntoView={false}
          placeholder="Exchange"
          onChange={this.handlePairDropdownExchange}
          options={Config.exchanges.map(x=>{return {value:x,label:x}})}
        />
        </div>
        <center>
        <div className="button-inline">
        <input className='button' type="submit" value="Add"/>
        </div></center></form>
        </div>)
    }
  }
      
  return (
    <div className="myarrow">
      <div className="page darwin">
        <div className="container">
          <div className="header">
          <div className="title"><h1>
          <span className="main-title"><i style={iconColor} className="fas fa-list-ul"/> Currencies</span>
          <div className="settings" onClick={this.handleSettingsButton}>
          <i style={iconColor} className="fas fa-arrow-circle-left"/></div></h1></div>
          </div>
        <div className="inside">
          {subPage()}  
        </div></div>
        {Footer}
      </div>
      </div>)
    }

  }
}
