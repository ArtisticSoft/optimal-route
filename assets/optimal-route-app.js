'use strict';
//=============================================================================
//Главный объект = Приложение. 
//методы опрелены в стиле, допускаемом только для объекта существующего в одном экземпляре
//
//id html-элементов передаются конструкторам объектов а не являются константами внутри объектов 
//для возможности создания нескольких экземпляров

function RouteAppClass() {

//ключевые объекты
  this.BackEnd = new BackEndClass();
  this.BackEnd.log_enabled = true;

  this.MapWithMarkerList = new MapWithMarkerListClass({
    back_end: this.BackEnd,
    map: {id: 'map', zoom_default: 10},
    address_list_id: 'address-list', route_optimize_btn_id: 'route-optimize-btn'
  });
  this.MapWithMarkerList.log_enabled = true;
  this.MapWithMarkerList.test_AddSeveralMarkersB();
  //this.MapWithMarkerList.test_AddSeveralMarkers();

  this.SearchWithSuggestons = new SearchWithSuggestonsClass({
    back_end: this.BackEnd,
    input_id: 'address-input', suggestion_dropdown_id: 'address-suggestions', 
    length_min: 3, delay_to_xhr_start: 1000
  });
  this.SearchWithSuggestons.log_enabled = true;
  //this.SearchWithSuggestons.test_inp_val();
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//навигация адаптивная

  this.nav_icon = document.getElementById('nav-icon');
  this.nav_responsive = document.getElementById('nav-responsive');
  //@media (min-width: 576px) {
  if (document.documentElement.clientWidth >= 576 ) {
    this.nav_icon.parentNode.replaceChild(this.nav_responsive, this.nav_icon);
  }

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//глобальные переменные

  this.overlay = document.getElementById('overlay');
  this.popup_link_share = document.getElementById('popup-link-share');

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//кнопка Добавить адрес
//передаёт данные между объектами SearchWithSuggestons => MapWithMarkerList

  this.address_add_btn_onClick = function (e) {
    console.log('address_add_btn_onClick');
    
    if (this.SearchWithSuggestons.state == 'value_from_suggestion') {
      //console.log('SearchWithSuggestons.state  OK');
      //console.log('SearchWithSuggestons.getValue ['+this.SearchWithSuggestons.getValue()+']');
      this.MapWithMarkerList.MarkerAddFromAddress(this.SearchWithSuggestons.getValue());
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
//кнопка Поделиться. открывает поп-ап

  this.share_link_btn_onClick = function (e) {
    console.log('share_link_btn_onClick');
    
    this.overlay.style.display = 'block';
    this.popup_link_share.style.display = 'block';
  }
  this.share_link_btn = document.getElementById('share-link-btn');
  this.share_link_btn.addEventListener('click', this.share_link_btn_onClick.bind(this));
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//кнопка Копировать в поп-апе

  this.link_copy_btn_onClick = function (e) {
    console.log('link_copy_btn_onClick');
    this.popup_link_share.style.display = 'none';
    this.overlay.style.display = 'none';
  }
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
