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
  this.popup_link_share = document.getElementById('popup-link-share');
  this.link_to_share = document.getElementById('link-to-share');

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//кнопка Поделиться. открывает поп-ап

  this.link_to_share_btn_onClick = function (e) {
    console.log('link_to_share_btn_onClick');
    
    //lose focus. this is the first step to make close by ESC
    this.saved_focus = myUtils.Document_Blur();
    
    //select link text
    window.getSelection().selectAllChildren(this.link_to_share);
    
    this.overlay.hidden = false;
    this.popup_link_share.hidden = false;
  };
  this.link_to_share_btn = document.getElementById('share-link-btn');
  this.link_to_share_btn.disabled = true;//! important
  this.link_to_share_btn.addEventListener('click', this.link_to_share_btn_onClick.bind(this));

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//ключевые объекты

  this.BackEnd = new BackEndClass();
  this.BackEnd.log_enabled = true;

  //список адресов
  
  //ссылка которой можно поделиться изменилась
  this.link_to_share_onChange = function (link) {
    if (link) {
      this.link_to_share.innerHTML = link;
      this.link_to_share_btn.disabled = false;
    } else {
      this.link_to_share_btn.disabled = true;
    }
  };

  this.MapWithMarkerList = new MapWithMarkerListClass({
    back_end: this.BackEnd,
    map: {id: 'map', zoom_default: 10},
    address_list_id: 'address-list', route_optimize_btn_id: 'route-optimize-btn'
  });
  this.MapWithMarkerList.onLinkToShareChanged = this.link_to_share_onChange.bind(this);
  this.MapWithMarkerList.log_enabled = true;
  this.MapWithMarkerList.test_AddSeveralMarkersB();
  //this.MapWithMarkerList.test_AddSeveralMarkers();

//поиск адресов
  this.SearchWithSuggestons = new SearchWithSuggestonsClass({
    back_end: this.BackEnd,
    input_id: 'address-input', suggestion_dropdown_id: 'address-suggestions', 
    length_min: 3, delay_to_xhr_start: 1000
  });
  this.SearchWithSuggestons.log_enabled = true;
  //this.SearchWithSuggestons.test_inp_val();
  
//навигация адаптивная
  this.NavigationOnDemand = new NavigationOnDemandClass({
  });
  this.NavigationOnDemand.log_enabled = true;
  this.NavigationOnDemand.NavPlaceResponsive();

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//кнопка Добавить адрес
//передаёт данные между объектами SearchWithSuggestons => MapWithMarkerList

  this.address_add_btn_onClick = function (e) {
    console.log('address_add_btn_onClick');
    
    if (this.SearchWithSuggestons.state == 'value_from_suggestion') {
      //console.log('SearchWithSuggestons.state  OK');
      //console.log('SearchWithSuggestons.getValue ['+this.SearchWithSuggestons.getValue()+']');
      this.MapWithMarkerList.AddressAddFromString(this.SearchWithSuggestons.getValue());
    }
  }
  this.address_add_btn = document.getElementById('address-add-btn');
  this.address_add_btn.addEventListener('click', this.address_add_btn_onClick.bind(this));
  //some browsers remember the Enabled state for buttons so make sure it is Disabled
  this.address_add_btn.disabled = true;
  
  this.Search_onStateChange = function() {
    this.address_add_btn.disabled = this.SearchWithSuggestons.state != 'value_from_suggestion';
  };
  this.SearchWithSuggestons.onStateChange = this.Search_onStateChange.bind(this);
  

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//кнопка Закрыть в поп-апе

  this.popup_close_btn_onClick = function (e) {
    console.log('popup_close_btn_onClick');
    this.popup_link_share.hidden = true;
    this.overlay.hidden = true;
  };
  this.popup_close_btn = document.getElementById('popup-link-share-close-icon');
  this.popup_close_btn.addEventListener('click', this.popup_close_btn_onClick.bind(this));
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//кнопка Копировать в поп-апе

  this.link_copy_btn_onClick = function (e) {
    console.log('link_copy_btn_onClick');
    window.getSelection().selectAllChildren(this.link_to_share);
  };
  this.link_copy_btn = document.getElementById('link-copy-btn');
  this.link_copy_btn.addEventListener('click', this.link_copy_btn_onClick.bind(this));

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
