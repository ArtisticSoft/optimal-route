'use strict';
//=============================================================================
/*
навигация появляющаяся из-за края экрана
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function NavigationOnDemandClass(options) {
  //this.C = this.constructor;
  this.C = NavigationOnDemandClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  //-- ключевой объект на странице. кнопка Показать навигацию
  this.nav_show_btn = document.getElementById('nav-show-btn');
  this.nav_show_btn.removeAttribute('href');
  this.nav_show_btn.addEventListener('click', this.nav_show_btn_onClick.bind(this));
  
  //-- ключевой объект на странице. кнопка Скрыть навигацию - обычно расположена в самой навигации
  this.nav_hide_btn = document.getElementById('nav-hide-btn');
  this.nav_hide_btn.removeAttribute('href');
  this.nav_hide_btn.addEventListener('click', this.nav_hide_btn_onClick.bind(this));

  //-- ключевой объект на странице. сама Навигация
  this.navigation_elt = document.getElementById('nav-responsive');
  this.navigation_visible;//подсказака что делать при завершении анимации
  this.navigation_elt.addEventListener('animationend', this.navigation_onAnimationend.bind(this));

  //-- ключевой объект на странице. обёртка для Навигации
  //nav-wrapper содержит стили для flex item,
  //это позволяет легко 
  //+ перенести навигацию в fly-out убрав её из nav-wrapper
  //+ перенести навигацию в header вместе с nav-wrapper, скрыв иконку-гамбургер
  this.navigation_wrapper = document.getElementById('nav-wrapper');
  //по умолчанию nav-wrapper расположен в footer
  //лучше перенести его в header- это норамльное положение для широкого экрана
  //это упростит дальнейшую адаптивность например при повороте смартфона на 90
  //но пока скрыть т.к. нет уверенности насколько широк экран
  this.navigation_wrapper.hidden = true;
  //flex-item обёртка для Навигации. переместить в header
  this.nav_show_btn.parentNode.appendChild(this.navigation_wrapper);
  
  //-- ключевой объект на странице. parent для навигации когда она динамическая
  this.nav_anchor = document.getElementById('nav-anchor');
  //обёртка позволяющая задавать % смещения навигации исходя из её размера а не размера nav-anchor
  this.nav_wrapper_offscreen = document.getElementById('nav-wrapper-offscreen');
  
  //Portrait\Landscape orientation change events
  window.addEventListener("orientationchange", this.window_onOrientationchange.bind(this));
  this.orientationchange= {};
}

NavigationOnDemandClass.prototype = new GenericBaseClass();//inherit from
NavigationOnDemandClass.prototype.SuperClass = GenericBaseClass.prototype;

//-----------------------------------------------------------------------------
//Внешний интерфейс
//-----------------------------------------------------------------------------

//interface for external calls
//the call Not included in the Constructor
//to be able to Enable and See log messages
NavigationOnDemandClass.prototype.NavPlaceResponsive = function () {
  this.window_onOrientationchange();
};

//close Navigation if it is opened as a popover
NavigationOnDemandClass.prototype.close = function () {
  if (!this.nav_hide_btn.hidden) {
    this.nav_hide_btn_onClick();
  }
};

//-----------------------------------------------------------------------------
//адаптивность: расположить навигацию в зависимости от ширины viewport
//-----------------------------------------------------------------------------
//Note: здесь изменяется только положение меню вцелом
//  многие стили влияющие на содержание меню
//  меняются не здесь а в CSS

NavigationOnDemandClass.prototype._NavPlaceResponsiveDetermine = function () {
  this.log('NavPlaceResponsive');
  this.log('document.documentElement.clientWidth['+document.documentElement.clientWidth+'] clientHeight['+document.documentElement.clientHeight+']');
  this.log('window.screen.width['+window.screen.width+'] height['+window.screen.height+']');
  this.log('window.screen.availWidth['+window.screen.availWidth+'] availHeight['+window.screen.availHeight+']');
  
  var screen_size_name = (document.documentElement.clientWidth >= this.C.Breakpoints.small) ? 'regular' : 'small';
  this.log('screen_size_name['+screen_size_name+']');
  
  if (screen_size_name != this.screen_size_name_shadow) {
    this._NavPlaceResponsiveDoActions(screen_size_name);
    this.screen_size_name_shadow = screen_size_name;
  }
};

NavigationOnDemandClass.prototype._NavPlaceResponsiveDoActions = function (screen_size_name) {
  switch (screen_size_name) {
    case 'regular':
      this.log('screen W: regular');
      //----------широкий экран. 
      //скрыть иконку-гамбургер
      this.nav_show_btn.hidden = true;

      //отменить изменения которые (возможно) были сделаны для небольшого экрана
      //  кнопка закрыть. скрыть
      this.nav_hide_btn.hidden = true;
      //Навигация. убрать inline style и класс overlaid
      this.navigation_elt.classList.remove('overlaid');
      this.navigation_elt.removeAttribute('style');
      //this.navigation_elt.style.width = null;
      //this.navigation_elt.style.height = null;
      //Навигация. переместить во flex-item обёртку
      if (this.navigation_elt.parentNode != this.navigation_wrapper) {
        this.navigation_wrapper.appendChild(this.navigation_elt);
      }
      //заменить иконку-гамбургер на flex-item обёртка Навигации. Poor way
      //this.nav_show_btn.parentNode.replaceChild(this.navigation_wrapper, this.nav_show_btn);
      
      //навигация. показать
      this.navigation_elt.hidden = false;
      //flex-item обёртка Навигации. показать
      this.navigation_wrapper.hidden = false;
      
      break;
      
    case 'small':
      this.log('screen W: small');
      //----------узкий экран 
      //  навигация. 
      //      сделать невидимой иначе когда она окажется за пределами экрана появится горизонтальная прокрутка
      //      переместить за пределы экрана рядом с кнопкой открыть
      //      добавить стиль размещающий навигацию поверх(z-order) и показывающий бордюр
      //  кнопка закрыть. сделать видимой
      
      //навигация. установить Ширину+Высоту = актуальным значениям 
      //чтобы они не изменились после перемешения навигации в другое место страницы
      //Note: this is only possible then Nav is in the DOM

      //first, make nav styles for it final look as a flyout
      //this required to get the correct computed WH
      this.navigation_elt.classList.add('overlaid');
      this.nav_hide_btn.hidden = false;
    
      var nav_style = getComputedStyle(this.navigation_elt);
      //this.log('nav_style.width['+nav_style.width+'] nav_style.height['+nav_style.height+']');
      this.navigation_elt.style.width = nav_style.width;
      this.navigation_elt.style.height = nav_style.height;
      
      //flex-item обёртка Навигации. скрыть. 
      //на узком экране эта обёртка точно не нужна
      //но убирать её совсем не нужно на случай если экран повернётся в альбомную ориентацию
      //скорее всего в данный момент Навигация является child flex-item обёртки
      this.navigation_wrapper.hidden = true;
      
      //навигация. скрыть и убрать со страницы
      this.navigation_elt.hidden = true;
      this.navigation_elt.parentNode.removeChild(this.navigation_elt);
      
      if (this.C.Options.animation_enable) {
      
        //--- с анимацией
        //обёртка расположенная за экраном. задать размер и положение
        this.nav_wrapper_offscreen.style.width = nav_style.width;
        this.nav_wrapper_offscreen.style.right = '-' + nav_style.width;
        
        //навигация. вставить в страницу как flyout
        this.navigation_elt.style.top = 0;
        //this.navigation_elt.style.right = '0%';//this is Evil! cancels the animation effect
        this.navigation_elt.style.position = 'absolute';
        
        this.nav_wrapper_offscreen.appendChild(this.navigation_elt);
        
      } else {
      
        //--- без анимации
        
        //навигация. вставить в страницу в фиксированном положении 
        this.navigation_elt.style.top = 0;
        this.navigation_elt.style.right = 0;
        this.navigation_elt.style.position = 'absolute';
        this.nav_anchor.appendChild(this.navigation_elt);
      }
      //показать иконку-гамбургер
      this.nav_show_btn.hidden = false;
      
      break;
      
    default:
      this.log('Warning: screen_size_name unknown ['+screen_size_name+']');
  }

};

//-----------------------------------------------------------------------------
//показать \ скрыть навигацию
//-----------------------------------------------------------------------------

NavigationOnDemandClass.prototype.nav_show_btn_onClick = function (e) {
  this.log('nav_show_btn_onClick');
  
  if (this.C.Options.animation_enable) {
    //--- с анимацией
    this.navigation_visible = true;
    this.h_scroll_enable(false);
    this.navigation_elt.hidden = false;
    myUtils.Element_animation_start(this.navigation_elt, 'nav-fly-in');
    //this.navigation_elt.style.right = '100%';//rough
  } else {
    //--- без анимации
    this.navigation_elt.hidden = false;
  }
};

NavigationOnDemandClass.prototype.nav_hide_btn_onClick = function (e) {
  this.log('nav_hide_btn_onClick');
  
  if (this.C.Options.animation_enable) {
    //--- с анимацией
    this.navigation_visible = false;
    myUtils.Element_animation_start(this.navigation_elt, 'nav-fly-out');
    //this.navigation_elt.style.right = '0%';//rough
  } else {
    //--- без анимации
    this.navigation_elt.hidden = true;
  }
};

NavigationOnDemandClass.prototype.navigation_onAnimationend = function (e) {
  this.log('navigation_onAnimationend');
  var v = this.navigation_visible ? '100%' : '0%';
  this.navigation_elt.style.right = v;
  if (!this.navigation_visible) {
    this.navigation_elt.hidden = !this.navigation_visible;
    this.h_scroll_enable(!this.navigation_visible);
  }
};

NavigationOnDemandClass.prototype.h_scroll_enable = function (enable) {
  var v = enable ? null : 'hidden';
  document.documentElement.style.overflowX = v;
  document.body.style.overflowX = v;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
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
NavigationOnDemandClass.prototype.window_onOrientationchange = function (e) {
  this.log_heading1('window_onOrientationchange');

  //a shortcut to the context
  var a = this.orientationchange;
  
  //get the current Target value
  var v = this.screen_size_detect_value();
  
  //check if the Target value changed since the last Detect
  if (v != a.target_val_shadow) {
    this.log('target val differ at the moment of the event! val['+v+'] shadow['+a.target_val_shadow+']');
    //remember the new value. might be used next time window.Orientationchange fired
    a.target_val_shadow = v;
    //call the payload
    this._NavPlaceResponsiveDetermine();
  } else {
    //fall back to polling-style change detect
    //get the current Target value
    a.target_val_shadow = v;
    a.tick_cnt = 0;
    a.timer = window.setInterval(
      this.window_Orientationchange_TimerTick.bind(this), this.C.orientationchange.interval
    );
  }
};

NavigationOnDemandClass.prototype.window_Orientationchange_TimerTick = function () {
  this.log_heading2('window_Orientationchange_TimerTick');
  
  //a shortcut to the context
  var a = this.orientationchange;
  a.tick_cnt++;

  //get the current Target value
  var v = this.screen_size_detect_value();

  //if the Target_value changed...
  if (v != a.target_val_shadow) {
    this.log('polling: target val changed. val['+v+'] shadow['+a.target_val_shadow+']');
    window.clearInterval(a.timer);
    //remember the new value. might be used next time window.Orientationchange fired
    a.target_val_shadow = v;
    //call the payload
    this._NavPlaceResponsiveDetermine();
  } else {
    if (a.tick_cnt >= this.C.orientationchange.timeout) {
      this.log('Warning: timeout waiting for value change. val shadow['+a.target_val_shadow+']');
      window.clearInterval(a.timer);
    }
  }
};

NavigationOnDemandClass.prototype.screen_size_detect_value = function () {
  //! important: this must be the same value used for screen size detect
  //several values (W,H) might be concatenated
  return document.documentElement.clientWidth;
};
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

NavigationOnDemandClass.prototype._static_properties_init = function () {
  this.log('NavigationOnDemandClass._static_properties_init');
  
  //constants related to suggestions HTML 
  var brk = this.C.Breakpoints = {};
  //@media (min-width: 576px) {
  brk.small = 576;
  
  var opt = this.C.Options = {};
  opt.animation_enable = false;
  //opt.animation_enable = true;
  
  var orient = this.C.orientationchange = {};
  orient.interval = 100;
  orient.timeout = 10;//=1000ms / interval
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//=============================================================================
