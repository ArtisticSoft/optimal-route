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
  
  this.debug_all = false;
  //this.debug_all = true;
  
  //ключевой объект на странице. кнопка Показать навигацию
  this.nav_show_btn = document.getElementById('nav-show-btn');
  
  if (!this.debug_all) {
  this.nav_show_btn.removeAttribute('href');
  this.nav_show_btn.addEventListener('click', this.nav_show_btn_onClick.bind(this));
  //ключевой объект на странице. кнопка Скорыть навигацию - обычно расположена в самой навигации
  this.nav_hide_btn = document.getElementById('nav-hide-btn');
  this.nav_hide_btn.removeAttribute('href');
  this.nav_hide_btn.addEventListener('click', this.nav_hide_btn_onClick.bind(this));
  }

  //ключевой объект на странице. сама Навигация
  this.navigation_elt = document.getElementById('nav-responsive');
  this.navigation_visible;//подсказака что делать при завершении анимации
  this.navigation_elt.addEventListener('animationend', this.navigation_onAnimationend.bind(this));
  //ключевой объект на странице. обёртка для Навигации
  //nav-wrapper содержит стили для flex item,
  //это позволяет легко 
  //+ перенести навигацию в fly-out убрав её из nav-wrapper
  //+ перенести навигацию в header убрав сам nav-wrapper
  this.navigation_wrapper = document.getElementById('nav-wrapper');
  
  //ключевой объект на странице. parent для навигации когда она динамическая
  this.nav_anchor = document.getElementById('nav-anchor');
  //обёртка позволяющая задавать % смещения навигации исходя из её размера а не размера nav-anchor
  this.nav_wrapper_offscreen = document.getElementById('nav-wrapper-offscreen');
  
}

NavigationOnDemandClass.prototype = new GenericBaseClass();//inherit from
NavigationOnDemandClass.prototype.SuperClass = GenericBaseClass.prototype;

//-----------------------------------------------------------------------------
//адаптивность: расположить навигацию в зависимости от ширины viewport
//-----------------------------------------------------------------------------

NavigationOnDemandClass.prototype.NavPlaceResponsive = function () {
  this.log('NavPlaceResponsive');
  
  if (document.documentElement.clientWidth >= this.C.Breakpoints.small) {
    this.log('screen W: regular');
    //----------широкий экран. 
    //flex-item обёртка для Навигации. переместить в header
    this.nav_show_btn.parentNode.replaceChild(this.navigation_wrapper, this.nav_show_btn);
  } else {
    if (!this.debug_all) {

    this.log('screen W: small');
    //----------узкий экран 
    //  навигация. 
    //      сделать невидимой иначе когда она окажется за пределами экрана появится горизонтальная прокрутка
    //      переместить за пределы экрана рядом с кнопкой открыть
    //      добавить стиль размещающий навигацию сверху и показывающий бордюр
    //  кнопка закрыть. сделать видимой
    
    //навигация. установить Ширину+Высоту = актуальным значениям 
    //чтобы они не изменились после перемешения навигации в ругое место страницы
    //Note: this is only possible then Nav is in the DOM

    //first, make nav styles for it final look as a flyout
    //this required to get the correct computed WH
    this.navigation_elt.classList.add('overlaid');
    this.nav_hide_btn.hidden = false;
  
    var nav_style = getComputedStyle(this.navigation_elt);
    //this.log('nav_style.width['+nav_style.width+'] nav_style.height['+nav_style.height+']');
    this.navigation_elt.style.width = nav_style.width;
    this.navigation_elt.style.height = nav_style.height;
    //обёртка расположенная за экраном. задать размер и положение
    this.nav_wrapper_offscreen.style.width = nav_style.width;
    this.nav_wrapper_offscreen.style.right = '-' + nav_style.width;
    
    //навигация. скрыть и убрать со страницы
    this.navigation_elt.hidden = true;
    this.navigation_elt.parentNode.removeChild(this.navigation_elt);
    
    //навигация. вставить в страницу как flyout
    this.navigation_elt.style.top = 0;
    //this.navigation_elt.style.right = '0%';//this is Evil! cancels the animation effect
    this.navigation_elt.style.position = 'absolute';
    
    this.nav_wrapper_offscreen.appendChild(this.navigation_elt);
    
    }
  }
};

//-----------------------------------------------------------------------------
//показать \ скрыть навигацию
//-----------------------------------------------------------------------------

NavigationOnDemandClass.prototype.nav_show_btn_onClick = function (e) {
  this.log('nav_show_btn_onClick');
  this.navigation_visible = true;
  this.h_scroll_enable(false);
  this.navigation_elt.hidden = false;
  myUtils.Element_animation_start(this.navigation_elt, 'nav-fly-in');
  //this.navigation_elt.style.right = '100%';//rough
};

NavigationOnDemandClass.prototype.nav_hide_btn_onClick = function (e) {
  this.log('nav_hide_btn_onClick');
  this.navigation_visible = false;
  myUtils.Element_animation_start(this.navigation_elt, 'nav-fly-out');
  //this.navigation_elt.style.right = '0%';//rough
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

NavigationOnDemandClass.prototype._static_properties_init = function () {
  this.log('NavigationOnDemandClass._static_properties_init');
  
  //constants related to suggestions HTML 
  var brk = this.C.Breakpoints = {};
  //@media (min-width: 576px) {
  brk.small = 576;
  
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//=============================================================================
