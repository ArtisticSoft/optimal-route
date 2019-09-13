'use strict';
//=============================================================================
//Главный объект = Приложение. 
//методы опрелены в стиле, допускаемом только для объекта существующего в одном экземпляре
//
//id html-элементов передаются конструкторам объектов а не являются константами внутри объектов 
//для возможности создания нескольких экземпляров

function RouteAppClass() {

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//глобальные переменные

  this.overlay = document.getElementById('overlay');

  this.notificaitons_wrapper = document.getElementById('notificaitons-wrapper');
  //this can't be done with simple .childNodes[0]
  this.notificaiton_template = this.notificaitons_wrapper.getElementsByClassName('error-message')[0];

  this.popover_link_share = document.getElementById('popover-link-share');
  this.link_to_share = document.getElementById('link-to-share');
  
  this.overlaid_onClick = function (e) {
    console.log('overlaid_onClick');
    
    //кнопка Закрыть в поп-овере
    var classes = e.currentTarget.classList;
    if (e.target.classList.contains('close-icon')) {
      if (classes.contains('popover')) {
        e.currentTarget.hidden = true;
        this.overlay.hidden = true;
      } else if (classes.contains('error-message')) {
        e.currentTarget.parentNode.removeChild(e.currentTarget);
      }
      e.preventDefault();
    }
  };
  this.popover_link_share.addEventListener('click', this.overlaid_onClick.bind(this));

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//кнопка Копировать в поп-овере

  this.link_copy_btn_onClick = function (e) {
    console.log('link_copy_btn_onClick');
    window.getSelection().selectAllChildren(this.link_to_share);
		document.execCommand('copy');
  };
  this.link_copy_btn = document.getElementById('link-copy-btn');
  this.link_copy_btn.addEventListener('click', this.link_copy_btn_onClick.bind(this));

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//кнопка Поделиться. открывает поп-овер

  this.link_to_share_btn_onClick = function (e) {
    console.log('link_to_share_btn_onClick');
    
    //lose focus. this is the first step to make close by ESC
    this.saved_focus = myUtils.Document_Blur();
    
    this.SocialNetworks.LinkToShare_BuildAll(this.link_to_share.innerHTML);
    
    //select link text
    window.getSelection().selectAllChildren(this.link_to_share);
    
    this.overlay.hidden = false;
    this.popover_link_share.hidden = false;
  };
  this.link_to_share_btn = document.getElementById('share-link-btn');
  this.link_to_share_btn.addEventListener('click', this.link_to_share_btn_onClick.bind(this));
  this.link_to_share_btn.disabled = true;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//-----ключевые объекты

  //---BackEnd  - должен быть первым
  this.BackEnd = new BackEndClass();
  this.BackEnd.log_enabled = true;
  
  this.backend_onReject = function (xhr_obj, txt) {
    //-- new Notification = template.Clone
    var notification = this.notificaiton_template.cloneNode(true);
    //console.log('notification.constructor.name['+notification.constructor.name+']');
    var error_text = notification.getElementsByClassName('error-text')[0];
    error_text.innerHTML = txt;
    notification.hidden = false;
    //this.overlay.hidden = false;//this is for pop-ups only
    //the first Notification will be appended below the Template
    this.notificaitons_wrapper.appendChild(notification);
    notification.addEventListener('click', this.overlaid_onClick.bind(this));
    
    //-- prevent overflow
    var wrapper_style = window.getComputedStyle(this.notificaitons_wrapper);
    //Note: getComputedStyle.height has String format '150px'
    console.log('wrapper_style.height['+wrapper_style.height +'] window.innerHeight['+window.innerHeight+'] window.outerHeight['+window.outerHeight+']');
    if (parseFloat(wrapper_style.height, 10) > window.innerHeight) {
      //remove the Topmost child except the Template
      var notifications = this.notificaitons_wrapper.getElementsByClassName('error-message');
      this.notificaitons_wrapper.removeChild(notifications[1]);
    }
  };
  this.BackEnd.onReject = this.backend_onReject.bind(this);

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//---навигация адаптивная
//должна быть перед картой чтобы инициализация карты не задерживала адаптивное размщение навигации

  this.NavigationOnDemand = new NavigationOnDemandClass({
  });
  this.NavigationOnDemand.log_enabled = true;
  this.NavigationOnDemand.NavPlaceResponsive();
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//---поиск адресов - должен быть перед 'список адресов'

  //console.log('SearchWithSuggestons creating...');
  this.SearchWithSuggestons = new SearchWithSuggestonsClass({
    back_end: this.BackEnd,
    input_id: 'address-input', suggestion_dropdown_id: 'address-suggestions', 
    length_min: 3, delay_to_xhr_start: 1000
  });
  this.SearchWithSuggestons.log_enabled = true;
  //this.SearchWithSuggestons.test_inp_val();
  //console.log('ok');
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//---список адресов
  
  //callback для списка адресов
  //ссылка которой можно поделиться изменилась
  this.link_to_share_onChange = function (link) {
    //console.log('link_to_share_onChange. link['+link+']');
    
    if (link && link.length) {
      this.link_to_share.innerHTML = link;
      this.link_to_share_btn.disabled = false;
    } else {
      this.link_to_share_btn.disabled = true;
      //требование заказчика
      //не использовать
      //this.link_to_share.innerHTML = window.location.href;//fallback
    }
  };
  //задать значение по умолчанию для ссылки которой можно поделиться
  this.link_to_share_onChange(false);

  //console.log('MapWithMarkerList creating...');
  this.MapWithMarkerList = new MapWithMarkerListClass({
    back_end: this.BackEnd,
    
    //--- zoom levels
    //20 very zoomed. streets are clearly visible
    //10 city-scale zoom. large city and it's outskirts are visible
    //5 region-scale zoom. nearby cities are visible

    map: {id: 'map', zoom_default: 10},
    address_list_id: 'address-list', route_optimize_btn_id: 'route-optimize-btn'
  });
  this.MapWithMarkerList.onLinkToShareChanged = this.link_to_share_onChange.bind(this);
  this.MapWithMarkerList.log_enabled = true;
  //console.log('ok');

  //-- test cases
  //=[?testtest_add_files=1]
  //console.log('document.location.search ['+document.location.search+']');
  if (document.location.search.includes('testtest_add_files=1')) {
    this.MapWithMarkerList.test_AddSeveralMarkersD('Peterburg');
    //this.MapWithMarkerList.test_AddSeveralMarkersD('Moscow');
    //this.MapWithMarkerList.test_AddSeveralMarkersD('London');
  }
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
  //---социальные сети
  this.SocialNetworks = new SocialNetworksClass({
    list_id: 'social-networks', 
    item_tag: 'a',
    attribute_name: 'name'
  });
  this.SocialNetworks.log_enabled = true;
  //this.SocialNetworks.LinkToShare_BuildAll('!!!test!!!');

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//кнопка Добавить адрес
//передаёт данные между объектами SearchWithSuggestons => MapWithMarkerList

  this.address_add_btn_onClick = function (e) {
    console.log('address_add_btn_onClick');
    
    if (this.SearchWithSuggestons.state == 'value_from_suggestion') {
      //console.log('SearchWithSuggestons.state  OK');
      //console.log('SearchWithSuggestons.getValue ['+this.SearchWithSuggestons.getValue()+']');
      this.MapWithMarkerList.Address_AppendFromString(this.SearchWithSuggestons.getValue());
      
      //вернуть фокус в поле ввода адреса
      this.SearchWithSuggestons.focus();
      
      //требование заказчика
      //очистить поле ввода
      this.SearchWithSuggestons.setValue('');
      
      //ссылка которой можно поделиться становится не-валидной
      this.link_to_share_onChange(false);
    }
  }
  this.address_add_btn = document.getElementById('address-add-btn');
  this.address_add_btn.addEventListener('click', this.address_add_btn_onClick.bind(this));
  //some browsers remember the Enabled state for buttons so make sure it is Disabled
  this.address_add_btn.disabled = true;
  
  this.Search_onStateChange = function(state) {
    this.address_add_btn.disabled = (state != 'value_from_suggestion');
    
    if (state == 'value_from_suggestion') {
      this.MapWithMarkerList.Address_Append_earlyPeek(this.SearchWithSuggestons.getValue());
    }
    
  };
  this.SearchWithSuggestons.onStateChange = this.Search_onStateChange.bind(this);
}
//-----------------------------------------------------------------------------
//когда загрузка документа завершена - выполнить onDocumentLoaded
/*
The DOMContentLoaded event fires when the initial HTML document has been completely loaded and parsed, 
without waiting for stylesheets, images, and subframes to finish loading.

A different event, [load], should be used only to detect a fully-loaded page. 
It is a common mistake to use load where DOMContentLoaded would be more appropriate.

---events sequence:
  readystate: interactive
  DOMContentLoaded
  readystate: complete
  load
*/

var Application;

function onDocumentLoaded() {
  console.log('-----onDocumentLoaded');
  Application = new RouteAppClass();
}

if (document.readyState !== 'complete') {  // Loading hasn't finished yet
  //ждать загрузки всех элементов страницы включая CSS img
  window.addEventListener('load', onDocumentLoaded);
  //ждать только загрузки и парсинга HTML, не ждать загрузки CSS img
  //document.addEventListener('DOMContentLoaded', doSomething);
} else {
  onDocumentLoaded();
}

//=============================================================================
