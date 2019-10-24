'use strict';
//=============================================================================
//Главный объект = Приложение. 
//методы опрелены в стиле, допускаемом только для объекта существующего в одном экземпляре
//
//id html-элементов передаются конструкторам объектов а не являются константами внутри объектов 
//для возможности создания нескольких экземпляров

function RouteAppClass() {

  this.log_enabled = document.location.search.includes('debug_log=1');
  this.log = function (msg) {
    if (this.log_enabled) {
      console.log(msg);
    }
  };

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//Поповеры

  this.PopoverEngine = new PopoverEngineClass({
    overlay_id: 'overlay',
    popover_class: 'popover',
    close_btn_class: 'close-icon'
  });
  this.PopoverEngine.log_enabled = this.log_enabled;
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//сообщения, в том числе об ошибках

  this.NotificationEngine = new NotificationEngineClass({
    wrapper_id: 'notificaitons-wrapper',
    notification_class: 'error-message',
    close_btn_class: 'close-icon',
    title_class: 'notification-title',
    title_default: 'Ошибка',
    text_class: 'notification-text'
  });
  this.NotificationEngine.log_enabled = this.log_enabled;
  
  if (document.location.search.includes('debug_notification=1')) {
    this.NotificationEngine.notificationNew('test title 1', 'test text 1');
    this.NotificationEngine.notificationNew('test title 2', 'test text 2');
  }
  
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//-----ключевые объекты

  //---OSRM BackEnd
  //this.OSRMBackEnd = new OSRMBackEndClass();
  //this.OSRMBackEnd.log_enabled = this.log_enabled;

  //---BackEnd - должен быть первым
  this.BackEnd = new BackEndClass();
  this.BackEnd.log_enabled = this.log_enabled;
  
  this.backend_onReject = function (xhr_obj, txt) {
    this.NotificationEngine.notificationNew('', txt);
  };
  this.BackEnd.onReject = this.backend_onReject.bind(this);
  //this.OSRMBackEnd.onReject = this.backend_onReject.bind(this);

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//---навигация адаптивная
//должна быть перед картой чтобы инициализация карты не задерживала адаптивное размeщение навигации

  this.NavigationOnDemand = new NavigationOnDemandClass({
  });
  //this.NavigationOnDemand.log_enabled = this.log_enabled;
  this.NavigationOnDemand.NavPlaceResponsive();
  
  this.navigation_items = {
    'nav-about': 'popover-about',
    'nav-contacts': ''
    //this pop-over contains an embedded video. it will requre some xtra listeners
    //,'nav-help': 'popover-help'
  };
  this.navigation_item_onClick = function (e) {
    this.log('navigation_item_onClick');
    var popover_id = this.navigation_items[e.target.id];
    if (popover_id && popover_id.length) {
      this.NavigationOnDemand.close();//close nav if it is opened as a popover
      this.PopoverEngine.popoverShow(popover_id);
    }
  };
  var keys = Object.keys(this.navigation_items);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    document.getElementById(k).addEventListener('click', this.navigation_item_onClick.bind(this));
  }

  //--- pop-over contains an embedded video. it will be handled individually
  //the pre-loaded way to start video
  //  + on page load: create player object with new YT.Player(...)
  //  + on NavItem click: show popover and start player
  //
  //the Hard way to start video
  //  + on NavItem click: show spinner and create player object with new YT.Player(...)
  //  + onPlayerReady: hide spinner, show popover and start player

  this.navigation_help_onClick = function (e) {
    this.log('navigation_help_onClick');
    
    this.NavigationOnDemand.close();//close nav if it is opened as a popover
    
    //start video. the 1st param = tag.ID to insert <iframe> into
    if (!this.help_video_player) {
      var video_element = document.getElementById('help-video');
      //create player. it will be started in onReady handler
      //regular size w640 h390 ratio = 
      this.log('creating video player');
      this.log('document.documentElement.clientWidth['+document.documentElement.clientWidth+']');
      var padding = 20;//cludge. must match the actual padding for popover
      var w = Math.min(document.documentElement.clientWidth - 2 * padding, 640);
      //kinida cludge. assume WH ratio always = 16:9
      var h = Math.min(Math.round(w * 9 / 16), document.documentElement.clientHeight - 2 * padding);
      this.help_video_player = new YT.Player('help-video', {
        height: Number(h).toString(),
        width: Number(w).toString(),
        videoId: video_element.dataset.helpVideoId,//'zBCbbXlVOhs' - test video
        events: {
          'onReady': this.onPlayerReady.bind(this),
          'onStateChange': this.onPlayerStateChange.bind(this)
        }
      });
    } else {
      this.log('video player already created. start it.');
      this.help_video_player.playVideo();
    }
    
    //show it
    this.PopoverEngine.popoverShow('popover-help');
  };
  
  this.nav_help_ref = document.getElementById('nav-help');
  this.nav_help_ref.addEventListener('click', this.navigation_help_onClick.bind(this));
  this.popover_help = document.getElementById('popover-help');
  //attach the custom [X] listener 
  this.popover_help_onClose = function (e) {
    this.log('stopping video...');
    this.help_video_player.stopVideo();
  }
  this.popover_help.querySelector('.close-icon').addEventListener('click', this.popover_help_onClose.bind(this));
  
  this.onPlayerReady = function (event) {
    //this.log('onPlayerReady() called');
    this.log('onPlayerReady. starting video...');
    event.target.playVideo();
  };
  
  this.onPlayerStateChange = function (event) {
    //this.log('onPlayerStateChange() called');
    //this.log('event.data String['+YTEventDataToName_Map[event.data]+'] raw['+event.data+']');
  };
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//---поиск адресов - должен быть перед 'список адресов'

  //this.log('SearchWithSuggestons creating...');
  var address_input = document.getElementById('address-input');
  this.SearchWithSuggestons = new SearchWithSuggestonsClass({
    back_end: this.BackEnd,
    input_id: 'address-input', suggestion_dropdown_id: 'address-suggestions', 
    length_min: myUtils.datasetValConvert('int', address_input.dataset.lengthMin), 
    debounce_delay: myUtils.datasetValConvert('int', address_input.dataset.debounceDelay)
  });
  this.SearchWithSuggestons.log_enabled = this.log_enabled;
  //this.SearchWithSuggestons.test_inp_val();
  //this.log('ok');
  
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//--- Ссылка-которой-можно-поделиться

  this.LinkToShare = new LinkToShareClass(
    this.PopoverEngine,
    {
      open_btn_id: 'share-link-btn',
      popover_id: 'popover-link-share',
      link_id: 'link-to-share',
      copy_btn_id: 'link-copy-btn'
    },
    {
      list_id: 'social-networks', 
      item_tag: 'a',
      attribute_name: 'name'
    }
  );
  this.LinkToShare.log_enabled = this.log_enabled;

//--- список адресов
  this.MapWithMarkerList = new MapWithMarkerListClass({
    back_end: this.BackEnd,
    map: {id: 'map'},
    address_list_id: 'address-list', route_optimize_btn_id: 'route-optimize-btn'
  });
  this.MapWithMarkerList.onLinkToShareChanged = this.LinkToShare.link_changeHandler.bind(this.LinkToShare);
  this.MapWithMarkerList.UI_display_message_callback = this.NotificationEngine.notificationNew.bind(this.NotificationEngine);
  this.MapWithMarkerList.log_enabled = this.log_enabled;
  //this.log('ok');

  //-- test cases
  this.test_ListFillFinish = function () {
    this.MapWithMarkerList.route_optimize_btn_onClick();
    this.LinkToShare.open_btn_clickHandler();
  };
  //this.log('document.location.search ['+document.location.search+']');
  if (document.location.search.includes('test_fill_list=1')) {
    if (document.location.search.includes('test_link_to_share=1')) {
      this.MapWithMarkerList.test_ListFillFinish_callback = this.test_ListFillFinish.bind(this);
    }
    this.MapWithMarkerList.test_AddSeveralMarkersD('Peterburg');
    //this.MapWithMarkerList.test_AddSeveralMarkersD('Moscow');
    //this.MapWithMarkerList.test_AddSeveralMarkersD('London');
  }
  
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//кнопка Добавить адрес
//передаёт данные между объектами SearchWithSuggestons => MapWithMarkerList

  this.address_add_btn_onClick = function (e) {
    this.log('address_add_btn_onClick');
    
    if (this.SearchWithSuggestons.state == 'value_from_suggestion') {
      //this.log('SearchWithSuggestons.state  OK');
      //this.log('SearchWithSuggestons.getValue ['+this.SearchWithSuggestons.getValue()+']');
      this.MapWithMarkerList.Address_AppendFromString(this.SearchWithSuggestons.getValue());
      
      this.address_add_after();//требование заказчика
    }
  }
  this.address_add_btn = document.getElementById('address-add-btn');
  this.address_add_btn.addEventListener('click', this.address_add_btn_onClick.bind(this));
  //some browsers remember the Enabled state for buttons so make sure it is Disabled
  this.address_add_btn.disabled = true;
  
  //поле ввода. состояние изменилось. 
  //самый интересный случай - было выбрано значение из списка предположений
  this.Search_onStateChange = function(state) {
    this.address_add_btn.disabled = (state != 'value_from_suggestion');
    
    if (state == 'value_from_suggestion') {
      this.MapWithMarkerList.Address_Append_earlyPeek(this.SearchWithSuggestons.getValue());
      
      this.address_add_after();//требование заказчика
    }
    
  };
  this.SearchWithSuggestons.onStateChange = this.Search_onStateChange.bind(this);

  this.address_add_after = function() {
    //очистить поле ввода
    this.SearchWithSuggestons.setValue('');

    //вернуть фокус в поле ввода адреса
    this.SearchWithSuggestons.focus();
  };
}
//-----------------------------------------------------------------------------

//syntax error. keys can be only Consts
//function YTEventDataToString(data) {
//  if (YT.PlayerState && !window.YTEventDataToString_Map) {
//    window.YTEventDataToString_Map = {
//      YT.PlayerState.ENDED :        'ENDED',
//      YT.PlayerState.PLAYING :      'PLAYING',
//      YT.PlayerState.PAUSED :       'PAUSED',
//      YT.PlayerState.BUFFERING :    'BUFFERING',
//      YT.PlayerState.CUED :         'CUED'
//    };
//  }
//  return window.YTEventDataToString_Map[data];
//} 

/*
    -1 (unstarted)
    0 (ended)
    1 (playing)
    2 (paused)
    3 (buffering)
    5 (video cued).
*/
var YTEventDataToName_Map = {
  '-1': 'UNSTARTED',
  0:  'ENDED',
  1:  'PLAYING',
  2:  'PAUSED',
  3:  'BUFFERING',
  5:  'CUED'
};



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
  //console.log('-----onDocumentLoaded');
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
