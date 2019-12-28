'use strict';
//=============================================================================
/*
смартфон. отслеживание поворота экрана
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function ScreenOrientationServiceClass(options) {
  //this.C = this.constructor;
  this.C = ScreenOrientationServiceClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  //ключевой объект. клиенты должны подписываться на события через этот объект
  //example 
  //Service.event.addEventListener("orientationchange", client.onOrientationchange.bind(client));
  //client.onOrientationchange();
  //
  //what is the 2nd line for: each client will most likely need the first-time init
  //But this service does not provide such initalization feature
  //
  this.event = new EventTarget();
  
  //Portrait\Landscape orientation change events
  window.addEventListener("orientationchange", this.window_onOrientationchange.bind(this));
  
  //init screen size fingerprint for the first time
  //to avoid the false difference condition, then
  //current fingerprint - not yet changed != fingerprint shadow = undefined
  this.fingerprint_shadow = this.screen_fingerprint_get();

}

ScreenOrientationServiceClass.prototype = new GenericBaseClass();//inherit from
ScreenOrientationServiceClass.prototype.SuperClass = GenericBaseClass.prototype;

//-----------------------------------------------------------------------------
/*
поддержка адаптивности при повороте экрана Portrait\Landscape
оказалась не совсем  проста
существует непредсказуемая задержка между событием Orientationchange
и выставлением браузером правильных значений для 
document.documentElement.clientWidth  window.screen.width  window.screen.availWidth
иногда правильные значения 
выставлены к моменту Orientationchange
иногда выставляются позже

здесь реализован polling-style механизм 
отслеживания изменений document.documentElement.clientWidth

для страховки, если изменений не последовало в течении 1000мс после Orientationchange 
то таймер останавливается. в теории так не должно случиться

--- after switch to Portrait
ScreenOrientation
​angle: 0
​onchange: null
​type: "portrait-primary"
​
--- after switch to Landscape
ScreenOrientation
​angle: 90
​onchange: null
​type: "landscape-primary"
​

--- Abandoned
screen.orientation 
- the support is Poor among browsers. Safari on iOS known not-supporter
- not very useful

  //this.log('screen.orientation');
  //this.log(screen.orientation);

  if (window.screen  && window.screen.orientation && window.screen.orientation.type) {
    var t = window.screen.orientation.type;
    if (t != this.orientation_type_shadow) {
      this._NavPlaceResponsiveDetermine();
      this.orientation_type_shadow = t;
    }
  }
*/

//Note: e might == null
ScreenOrientationServiceClass.prototype.window_onOrientationchange = function (e) {
  this.log_heading1('window_onOrientationchange');

  //get the current Target value
  var v = this.screen_fingerprint_get();
  
  //check if the Target value changed since the last Detect
  if (v != this.fingerprint_shadow) {
    this.log('target val differ at the moment of the event! val['+v+'] shadow['+this.fingerprint_shadow+']');
    //remember the new value. might be used next time window.Orientationchange fired
    this.fingerprint_shadow = v;
    //call the payload
    this.payload();
  } else {
    //fall back to polling-style change detect
    //get the current Target value
    this.fingerprint_shadow = v;
    this.tick_cnt = 0;
    this.timer = window.setInterval(
      this.TimerTick.bind(this), this.C.timer.interval
    );
  }
};

ScreenOrientationServiceClass.prototype.TimerTick = function () {
  this.log_heading2('window_Orientationchange_TimerTick');
  
  this.tick_cnt++;

  //get the current Target value
  var v = this.screen_fingerprint_get();

  //if the Target_value changed...
  if (v != this.fingerprint_shadow) {
    this.log('polling: target val changed. val['+v+'] shadow['+this.fingerprint_shadow+']');
    window.clearInterval(this.timer);
    //remember the new value. might be used next time window.Orientationchange fired
    this.fingerprint_shadow = v;
    //call the payload
    this.payload();
  } else {
    if (this.tick_cnt >= this.C.timer.timeout) {
      this.log('Warning: timeout waiting for value change. val shadow['+this.fingerprint_shadow+']');
      window.clearInterval(this.timer);
    }
  }
};

ScreenOrientationServiceClass.prototype.screen_fingerprint_get = function () {
  //! important: this must be the same value used for screen size detect
  //several values (W,H) might be concatenated
  return document.documentElement.clientWidth;
};

ScreenOrientationServiceClass.prototype.payload = function () {
  this.event.dispatchEvent(new Event("orientationchange"));
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

ScreenOrientationServiceClass.prototype._static_properties_init = function () {
  this.log('ScreenOrientationServiceClass._static_properties_init');
  
  var tmr = this.C.timer = {};
  tmr.interval = 100;
  tmr.timeout = 10;//=1000ms / interval
};

//=============================================================================
