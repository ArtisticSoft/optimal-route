'use strict';
//=============================================================================
/*
Ссылка-которой-можно-поделиться
Кнопка Поделиться + Поповер
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//known options
//.open_btn_id   .popover_id   .link_id   .copy_btn_id   

function LinkToShareClass(popover_engine, options, social_networks_options) {
  //this.C = this.constructor;
  this.C = LinkToShareClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  //--- Поповер. главный объект позволяющий открывать\закрывать поповеры
  this.popover_engine = popover_engine;
  
  //--- Ссылка. модель
  this.link = {
    value: false,
    status: 'init'
  };

  //--- Кнопка Поделиться. ключевой объект на странице
  this.open_btn = document.getElementById(options.open_btn_id);
  this.open_btn.addEventListener('click', this.open_btn_clickHandler.bind(this));
  this.open_btn.disabled = true;
  
  //--- Поповер и его дочерние эл-ты. ключевой объект на странице
  this.popover = {};
  this.popover.dom_element = document.getElementById(options.popover_id);
  this.popover.disable_overlay = this.popover.dom_element.querySelector('.popover-disable');

  //Поповер. ссылка
  var link_select_binding = this.link_select.bind(this);
  this.popover.link = {
    dom_element: document.getElementById(options.link_id),
    select: link_select_binding
  };
  
  //Поповер. кнопка Копировать
  this.popover.copy_btn = document.getElementById(options.copy_btn_id);
  this.popover.copy_btn.addEventListener('click', this.copy_btn_clickHandler.bind(this));
  
  //---социальные сети. суб-объект
  //options example {
  //  list_id: 'social-networks', 
  //  item_tag: 'a',
  //  attribute_name: 'name'
  //}
  this.SocialNetworks = new SocialNetworksClass(social_networks_options);
  this.SocialNetworks.log_enabled = options.log_enabled;

}

LinkToShareClass.prototype = new GenericBaseClass();//inherit from
LinkToShareClass.prototype.SuperClass = GenericBaseClass.prototype;

//-----------------------------------------------------------------------------
//Ссылка. модель
//-----------------------------------------------------------------------------

//callback для списка адресов. ссылка которой можно поделиться изменилась
//
//специальные значения
//  undefined - ссылка пустая но начата подготовка к получению валидной ссылки
//        можно разрешить кнопку поделиться
//  false - инициализация при загрузке страницы
//  null - получение валидной ссылки завершилось ошибкой

LinkToShareClass.prototype.link_changeHandler = function (link) {
  this.log_heading1('link_changeHandler. link['+link+']');
  
  //save link value
  this.link.value = link;
  //update link status
  var status = this.link.status = this.C.link_status_map[typeof link];
  this.log('status['+status+']');

  //кнопка Поделиться. обновить состояние
  //требование заказчика. как можно меньше запрещать кнопку Поделиться 
  this.open_btn.disabled = !['valid', 'updating'].includes(status);
  
  //if popover opened - update it
  if (!this.popover.dom_element.hidden) {
    this.popover_updateAndShow();
  }
};

//-----------------------------------------------------------------------------
//Кнопка Поделиться
//-----------------------------------------------------------------------------

LinkToShareClass.prototype.open_btn_clickHandler = function (e) {
  this.log('open_btn_clickHandler');
  
  //lose focus. this is the first step to make close by ESC
  this.saved_focus = myUtils.Document_Blur();
  
  this.popover_updateAndShow(true);
};

//-----------------------------------------------------------------------------
//Поповер
//-----------------------------------------------------------------------------

//кнопка Копировать
LinkToShareClass.prototype.copy_btn_clickHandler = function (e) {
  this.log_heading1('copy_btn_clickHandler');
  this.popover.link.select();
  document.execCommand('copy');
};

LinkToShareClass.prototype.link_select = function () {
  myUtils.Element_innerHTML_select(this.popover.link.dom_element);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//обновить значения эл-тов UI в поповере и опционально показать поповер
//может вызываться из наскольких мест: по кнопке Поделиться или при изменении ссылки
//show might =undefined
//  this = this.link_to_share

LinkToShareClass.prototype.popover_updateAndShow = function (show) {
  var popover = this.popover;
  var link = this.link.value;
  var status = this.link.status;
  
  if (status != 'error') {
    //обновить состояние эл-тов UI в поповере
    popover.copy_btn.disabled = (status != 'valid');
    //activate / remove the overlay
    popover.disable_overlay.hidden = (status == 'valid');
    popover.link.dom_element.innerHTML = (status == 'valid') ? link : 'подождите...';
    if (status == 'valid') {
      this.SocialNetworks.LinkToShare_BuildAll(link);
      //select link text
      popover.link.select();
    }
    if (show) {
      //show the popover
      this.popover_engine.popoverShow(popover.dom_element);
    }
  } else {
    //если произошла ошибка то скрыть поповер
    this.popover_engine.popoverHide(popover.dom_element);
  }
};

//-----------------------------------------------------------------------------

LinkToShareClass.prototype._static_properties_init = function () {
  this.log('LinkToShareClass._static_properties_init');
  
  this.C.link_status_map = {
    'boolean': 'init',  //assumed =false always
    'undefined': 'updating',
    'string': 'valid',  //assumed length > 0 always
    'object': 'error'   //assumed =null always
  };

};

//=============================================================================
