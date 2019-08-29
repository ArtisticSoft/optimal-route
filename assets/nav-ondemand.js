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
  
  //this.debug_all = false;
  this.debug_all = true;
  
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
  
  //ключевой объект на странице. parent для навигации когда она динамическая
  this.nav_anchor = document.getElementById('nav-anchor');
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
    //широкий экран - переместить навигацию в header
    this.nav_show_btn.parentNode.replaceChild(this.navigation_elt, this.nav_show_btn);
  } else {
    if (!this.debug_all) {

    this.log('screen W: small');
    //узкий экран 
    //  переместить навигацию за пределы экрана рядом с кнопкой которая её показывает
    //  показать кнопку закрытия
    this.navigation_elt.parentNode.removeChild(this.navigation_elt);
    this.nav_hide_btn.hidden = false;
    this.navigation_elt.classList.add('overlaid');
    
    //set WH = computed. FAILED
    //var nav_style = getComputedStyle(this.navigation_elt);
    //nearly all props are empty!
    //this.log('nav_style');
    //this.log(nav_style);
    //empty!
    //this.log('nav_style.width['+nav_style.getPropertyValue('width')+'] nav_style.height['+nav_style.getPropertyValue('height')+']');
    //empty!
    //this.log('nav_style.width['+nav_style.width+'] nav_style.height['+nav_style.height+']');
    
    //this.navigation_elt.style.width = nav_style.width;
    //this.navigation_elt.style.height = nav_style.height;

    //---stick the Navigation to the anchor's right
    
    //width = clientW
    //this.navigation_elt.style.position = 'sticky';
    
    //FAILED
    //  if anchor.overflow: hidden; 
    //    menu not visible at all offstes 
    //  if anchor.overflow: <not specified>; 
    //    menu visible But Hscroll appear then it flyes off-page 
    //this.navigation_elt.style.top = 0;
    //this.navigation_elt.style.left = 0;
    //this.navigation_elt.style.right = 0;
    //this.navigation_elt.style.right = '-20px';
    //this.navigation_elt.style.position = 'absolute';
    
    this.nav_anchor.appendChild(this.navigation_elt);
    
    }
  }
};

//-----------------------------------------------------------------------------
//показать \ скрыть навигацию
//-----------------------------------------------------------------------------

NavigationOnDemandClass.prototype.nav_show_btn_onClick = function (e) {
  this.log('nav_show_btn_onClick');
};

NavigationOnDemandClass.prototype.nav_hide_btn_onClick = function (e) {
  this.log('nav_hide_btn_onClick');
};

//-----------------------------------------------------------------------------
//
//-----------------------------------------------------------------------------
/*
*/

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
