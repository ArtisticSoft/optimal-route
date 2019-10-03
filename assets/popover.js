'use strict';
//=============================================================================
/*
Поповеры
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function PopoverEngineClass(options) {
  //this.C = this.constructor;
  this.C = PopoverEngineClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  //--- overlay. ключевой объект на странице
  //обычно полупрозрачный <div> по размеру окна, скрывающий страницу
  this.overlay = document.getElementById(options.overlay_id);
  
  //--- Popover. опции
  this.popover_options = {
    'class': options.popover_class,
    'close_btn_class': options.close_btn_class
  };

  //поповеры. найти их все на странице и назначить обработчик(и)
  var popover_arr = document.querySelectorAll('.' + this.popover_options.class);
  for (var i = 0; i < popover_arr.length; i++) {
    popover_arr[i].addEventListener('click', this.popoverClickHandler.bind(this));
  }
}

PopoverEngineClass.prototype = new GenericBaseClass();//inherit from
PopoverEngineClass.prototype.SuperClass = GenericBaseClass.prototype;

//-----------------------------------------------------------------------------
//Поповеры. методы для работы с ними
//-----------------------------------------------------------------------------
//popover - может быть или строкой = значение html id или ссылкой на html element

//поповер. открыть 
PopoverEngineClass.prototype.popoverShow = function (popover) {
  //this.log_heading4('popoverShow');
  
  this.popoverSetVisible(popover, true);
};

//поповер. закрыть 
PopoverEngineClass.prototype.popoverHide = function (popover) {
  //this.log_heading4('popoverHide');
  
  this.popoverSetVisible(popover, false);
};

PopoverEngineClass.prototype.popoverSetVisible = function (popover, visible) {
  this.log_heading5('popoverSetVisible');
  
  if (typeof popover == 'string') {
    popover = document.getElementById(popover);
  }
  
  popover.hidden = !visible;
  this.overlay.hidden = !visible;
};

//-----------------------------------------------------------------------------
//Поповеры. обработчики событий
//-----------------------------------------------------------------------------

//поповер. обработчик кликов общего назначения
PopoverEngineClass.prototype.popoverClickHandler = function (e) {
  this.log_heading2('popoverClickHandler');
  
  //кнопка Закрыть [X]
  if (e.target.classList.contains(this.popover_options.close_btn_class)) {
    this.popoverHide(e.currentTarget);
    e.preventDefault();
  }
};
  
//-----------------------------------------------------------------------------

PopoverEngineClass.prototype._static_properties_init = function () {
  this.log('PopoverEngineClass._static_properties_init');
  
};

//=============================================================================
