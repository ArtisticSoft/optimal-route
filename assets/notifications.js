'use strict';
//=============================================================================
/*
Cообщения, в том числе об ошибках 
внешне отдалённо напоминают Windows SysTray Notifications
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function NotificationEngineClass(options) {
  //this.C = this.constructor;
  this.C = NotificationEngineClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  //--- wrapper. ключевой объект на странице
  //является якорем для сообщений. содержит шаблон сообщения. 
  //содержит настройки сообщений в атрибутах data-...
  this.wrapper = document.getElementById(options.wrapper_id);
  
  //--- опции
  this.options = {
    'notification_class': options.notification_class,
    'close_btn_class': options.close_btn_class,
    'title_class': options.title_class,
    'title_default': options.title_default,
    'text_class': options.text_class,
    'close_delay': myUtils.datasetValConvert('int', this.wrapper.dataset.closeDelay)
  };

  //--- шаблон сообщения
  //this can't be done with simple .childNodes[0]
  this.template = this.wrapper.getElementsByClassName(this.options.notification_class)[0];
}

NotificationEngineClass.prototype = new GenericBaseClass();//inherit from
NotificationEngineClass.prototype.SuperClass = GenericBaseClass.prototype;

//-----------------------------------------------------------------------------
//Cообщения. методы для работы с ними
//-----------------------------------------------------------------------------
//popover - может быть или строкой = значение html id или ссылкой на html element

//сообщениe. создать 
NotificationEngineClass.prototype.notificationNew = function (title, txt) {
  title = title || this.options.title_default;
  
  //-- new Notification = template.Clone
  var notification = this.template.cloneNode(true);
  //this.log('notification.constructor.name['+notification.constructor.name+']');

  var title_elem = notification.getElementsByClassName(this.options.title_class)[0];
  title_elem.innerHTML = title;
  var text_elem = notification.getElementsByClassName(this.options.text_class)[0];
  text_elem.innerHTML = txt;

  notification.hidden = false;
  //new Notification will appear below the existing notifications
  //the first Notification will be appended below the Template
  this.wrapper.appendChild(notification);
  notification.addEventListener('click', this.notificationClickHandler.bind(this));

  //-- prevent overflow
  var wrapper_style = window.getComputedStyle(this.wrapper);
  //Note: getComputedStyle.height has String format '150px'
  this.log('wrapper_style.height['+wrapper_style.height +'] window.innerHeight['+window.innerHeight+'] window.outerHeight['+window.outerHeight+']');

  if (parseFloat(wrapper_style.height, 10) > window.innerHeight) {
    //remove the Topmost child except the Template
    var notifications = this.wrapper.getElementsByClassName(this.options.notification_class);
    this.wrapper.removeChild(notifications[1]);
  }
  
  //требование заказчика
  //После появления ошибки, скрыть ее через 3 секунды
  //если задержка =0 или отсутствует то не скрывать
  if (this.options.close_delay > 0) {
    window.setTimeout(
      this.notificationСlose.bind(this, notification),
      this.options.close_delay
    );
  }
};

//-----------------------------------------------------------------------------
//Cообщения. обработчики событий
//-----------------------------------------------------------------------------

//сообщениe. обработчик кликов общего назначения
NotificationEngineClass.prototype.notificationClickHandler = function (e) {
  this.log('notificationClickHandler');
  
  //кнопка Закрыть [X]
  if (e.target.classList.contains(this.options.close_btn_class)) {
    this.notificationСlose(e.currentTarget);
    e.preventDefault();
  }
};

//сообщениe. закрыть
NotificationEngineClass.prototype.notificationСlose = function (notification) {
  notification.parentNode.removeChild(notification);
};

//-----------------------------------------------------------------------------

NotificationEngineClass.prototype._static_properties_init = function () {
  this.log('NotificationEngineClass._static_properties_init');
  
};

//=============================================================================
