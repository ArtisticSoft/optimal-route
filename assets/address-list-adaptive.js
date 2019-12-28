'use strict';
//=============================================================================
/*
список адресов. чтобы прокрутка работала необходимо установить max-height
сделать это можно рассчитав место в родительском эл-те 
которое останется за вычетом высот других дочерних эл-тов

попутно сначала устанавливается max-height родительского эл-та
с таким расчётом чтобы его нижний край не выходил за пределы экрана 

depends on: screen-orientation-service
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//список. скроллбар по вертикали. 
//чтобы всё работало - должна быть задана фиксированная высота height или max-height. 
//в данном случае высота квази-адаптивная = свободное место в родительском эл-те
//= parent.height - (address-input-wrapper.height + address-list-wrapper.header.height + address-buttons-wrapper.height) 
//
//Trouble: другие дочерние эл-ты - ввод адреса и блок кнопок внизу 
// принимают разную высоту для разной ориентации (так устроена вёрстка)
// размеры этих эл-тов сразу после event-a orientationchange старые, какие были при предыдущей ориентации
// пришлось сделать polling-style ожидание изменений  +кэшировать сумму высот
//
//--- до того как будет установлена max-height списка
//необходимо установить parent.max-height так чтобы нижний блок кнопок не выходил зв пределы экрана
//
//для этой же цели действуют CSS стили устанавливающие max-height в % от высоты экрана
//но это относительно хорошо работает только для больших экранов
//на смартфонах погрешности серъёзные. на одном и том-же экране смартфона в зависимости от ориентации
//может быть снизу или обрезано пол-кнопки или пустого места на пол-кнопки
//потому что header страницы занимает разный % высоты экрана > указанного в CSS max-height
//
function AddressListAdaptiveClass(options) {
  //this.C = this.constructor;
  this.C = AddressListAdaptiveClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.log_enabled = options.log_enabled;
  
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  options.ScreenOrientationService.event.addEventListener("orientationchange", this.onOrientationchange.bind(this));
  
  //ключевые эл-ты на странице
  this.html = {
    'header': document.getElementById("header-row"),
    'parent': document.getElementById("address-section"),
    'scrollable': document.getElementById("address-list-scrollable")
  };
  //will be used to scroll to the last item from JS
  this.html.list = this.html.scrollable.querySelector('ul');
  
  //height cache
  this.height_list = {
    'header': {val: undefined, option: 'fullHeight'},
    'parent': {val: undefined, option: 'height'},
    'scrollable': {val: undefined, option: 'fullHeight'},
    'all_children_minus_scrollable': {val: undefined, option: ''}
  };
  
  //init for the first time
  // this.children_h_sum_shadow = this.ChildrenGetHeightSum();//makes things worse
  this.onOrientationchange();
}

AddressListAdaptiveClass.prototype = new GenericBaseClass();//inherit from
AddressListAdaptiveClass.prototype.SuperClass = GenericBaseClass.prototype;

//-----------------------------------------------------------------------------
//Внешний интерфейс
//-----------------------------------------------------------------------------

AddressListAdaptiveClass.prototype.ScrollToEnd = function () {
  var offset = this.html.list.lastChild.offsetTop;
  this.log('ScrollToEnd [' + offset + ']');
  this.html.scrollable.scrollTop = offset;
};

//-----------------------------------------------------------------------------
// Skeleton
//-----------------------------------------------------------------------------

AddressListAdaptiveClass.prototype.onOrientationchange = function (evt) {
  this.log_heading1('AddressListAdaptiveClass_onOrientationchange');
  
  this.HeightList_Update();
  
  //--- установить max-height всей секции с адресами
  this.ParentSectionSetMaxHeight();
    
  //--- установить max-height списка адресов
  var children_h_sum = this.ChildrenGetHeightSum();
  
  //check if the Target value changed since the last Detect
  if (children_h_sum != this.children_h_sum_shadow) {
    this.log('target val differ at the moment of the event! val['+children_h_sum+'] shadow['+this.children_h_sum_shadow+']');
    this.children_h_sum_shadow = children_h_sum;
    this.payload(children_h_sum);
  } else {
    // this.log('fall back to polling-style change detect children_h_sum['+children_h_sum+'] = shadow');
    //fall back to polling-style change detect
    //get the current Target value
    this.children_h_sum_shadow = children_h_sum;
    this.tick_cnt = 0;
    this.timer = window.setInterval(
      this.TimerTick.bind(this), this.C.timer.interval
    );
  }
};

AddressListAdaptiveClass.prototype.TimerTick = function () {
  this.log_heading2('AddressListAdaptiveClass_TimerTick');
  
  this.tick_cnt++;

  //get the current Target value
  var children_h_sum = this.ChildrenGetHeightSum();

  //if the Target_value changed...
  if (children_h_sum != this.children_h_sum_shadow) {
    this.log('polling: target val changed. val['+children_h_sum+'] shadow['+this.children_h_sum_shadow+']');
    window.clearInterval(this.timer);
    this.children_h_sum_shadow = children_h_sum;
    this.payload(children_h_sum);
  } else {
    if (this.tick_cnt >= this.C.timer.timeout) {
      this.log('Warning: timeout waiting for value change. val shadow['+this.children_h_sum_shadow+']');
      window.clearInterval(this.timer);
    }
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

AddressListAdaptiveClass.prototype._static_properties_init = function () {
  this.log('AddressListAdaptiveClass._static_properties_init');
  
  var tmr = this.C.timer = {};
  tmr.interval = 100;
  tmr.timeout = 10;//=1000ms / interval
};

//-----------------------------------------------------------------------------
// Payload
//-----------------------------------------------------------------------------

//assumed page header have height = const , not changed at "orientationchange" evt
//if in the future header will change it's height, 
// polling should be used to track the end-of-change
AddressListAdaptiveClass.prototype.ParentSectionSetMaxHeight = function () {
  //--- установить max-height всей секции с адресами
  var h = document.documentElement.clientHeight;
  // this.log(`clientHeight [${h}]`);
  
  h = h - this.height_list.header.val;
  // this.log(`clientHeight - header.height [${h}]`);
  
  this.html.parent.style.maxHeight = h + 'px';
};

AddressListAdaptiveClass.prototype.payload = function (children_h_sum) {
  this.log_heading3('payload called. children height sum [' + children_h_sum + ']');
  
  //desktop: 790.4px
  //smartphone: 337.5
  this.log('parent.height [' + this.height_list.parent.val + ']');

  var h = this.html.parent.style.maxHeight.replace('px', '') - children_h_sum;
  this.log('parent.maxHeight - children height sum [' + h + ']');
  h = Math.floor(h);
  this.html.scrollable.style.maxHeight = h + 'px';
};

//the value to be tracked = children height sum - adr list height
AddressListAdaptiveClass.prototype.ChildrenGetHeightSum = function () {
  this.HeightList_Update(['scrollable', 'all_children_minus_scrollable']);
  return this.height_list.all_children_minus_scrollable.val;
};

AddressListAdaptiveClass.prototype.HeightList_Update = function (keys) {
  // this.log_heading4(`HeightList_Update keys [${JSON.stringify(keys)}]`);
  keys = keys || Object.keys(this.height_list);
  
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var element = this.html[k];
    if (element) {//only if element found by key
      switch (this.height_list[k].option) {
        case 'height': 
          this.height_list[k].val = myUtils.Element_getComputedProperty(this.html[k], 'height');
          break;
          
        case 'fullHeight': 
          this.height_list[k].val = myUtils.Element_getFullHeight(this.html[k]);
          break;
      }
    }
  }
  
  k = 'all_children_minus_scrollable';
  if (keys.includes(k)) {
    //sample
    // children [0]computed h=[28px] 
    // children [1]computed h=[46px] 
    // children [2]computed h=[36px]
    var h = myUtils.Element_getChildrenFullHeightSum(this.html.parent)
    this.log('children height sum [' + h + ']');
    h = h - this.height_list.scrollable.val;
    this.log('children height sum - current adr_list.height [' + h + ']');
    this.height_list[k].val = h;
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

//this moved to optimal-route-app.js
// var AddressListAdaptive = new AddressListAdaptiveClass();

//=============================================================================
