'use strict';
//=============================================================================
//Главный объект = Приложение. 
//методы опрелены в стиле, допускаемом только для объекта существующего в одном экземпляре
//
//id html-элементов передаются конструкторам объектов а не являются константами внутри объектов 
//для возможности создания нескольких экземпляров

function RouteAppClass() {

  this.log_enabled = true;
  this.log = function (msg) {
    if (this.log_enabled) {
      console.log(msg);
    }
  };

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//глобальные переменные

  this.overlay = document.getElementById('overlay');

  this.popover_link_share = document.getElementById('popover-link-share');
  this.link_to_share = document.getElementById('link-to-share');
  
  //открыть поп-овер
  this.overlaid_Show = function (overlaid_elem) {
    this.overlay.hidden = false;
    overlaid_elem.hidden = false;
  };
  
  //поповер \ сообщение. обработчик кликов общего назначения
  this.overlaid_onClick = function (e) {
    this.log('overlaid_onClick');
    
    //кнопка Закрыть в поп-овере
    var classes = e.currentTarget.classList;
    if (e.target.classList.contains('close-icon')) {
      if (classes.contains('popover')) {
        e.currentTarget.hidden = true;
        this.overlay.hidden = true;
      } else if (classes.contains('error-message')) {
        this.notification_close(e.currentTarget);
      }
      e.preventDefault();
    }
  };
  this.popover_link_share.addEventListener('click', this.overlaid_onClick.bind(this));
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//кнопка Копировать в поп-овере

  this.link_copy_btn_onClick = function (e) {
    this.log('link_copy_btn_onClick');
    window.getSelection().selectAllChildren(this.link_to_share);
		document.execCommand('copy');
  };
  this.link_copy_btn = document.getElementById('link-copy-btn');
  this.link_copy_btn.addEventListener('click', this.link_copy_btn_onClick.bind(this));

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//кнопка Поделиться. открывает поп-овер

  //this.link_to_share_debug = true;

  this.link_to_share_btn_onClick = function (e) {
    this.log('link_to_share_btn_onClick');
    
    //lose focus. this is the first step to make close by ESC
    this.saved_focus = myUtils.Document_Blur();
    
    this.SocialNetworks.LinkToShare_BuildAll(this.link_to_share.innerHTML);
    
    //select link text
    window.getSelection().selectAllChildren(this.link_to_share);
    
    this.overlaid_Show(this.popover_link_share);
  };
  this.link_to_share_btn = document.getElementById('share-link-btn');
  this.link_to_share_btn.addEventListener('click', this.link_to_share_btn_onClick.bind(this));
  this.link_to_share_btn.disabled = !this.link_to_share_debug;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//сообщения об ошибках

  this.notificaitons_wrapper = document.getElementById('notificaitons-wrapper');
  //this can't be done with simple .childNodes[0]
  this.notificaiton_template = this.notificaitons_wrapper.getElementsByClassName('error-message')[0];
  this.notification_close_delay = myUtils.datasetValConvert('int', this.notificaitons_wrapper.dataset.closeDelay);

  this.notification_new = function (title, txt) {
    title = title || 'Ошибка';
    //-- new Notification = template.Clone
    var notification = this.notificaiton_template.cloneNode(true);
    //this.log('notification.constructor.name['+notification.constructor.name+']');

    var notification_title = notification.getElementsByClassName('notification-title')[0];
    notification_title.innerHTML = title;
    var notification_text = notification.getElementsByClassName('notification-text')[0];
    notification_text.innerHTML = txt;

    notification.hidden = false;
    //the first Notification will be appended below the Template
    this.notificaitons_wrapper.appendChild(notification);
    notification.addEventListener('click', this.overlaid_onClick.bind(this));
    
    //-- prevent overflow
    var wrapper_style = window.getComputedStyle(this.notificaitons_wrapper);
    //Note: getComputedStyle.height has String format '150px'
    this.log('wrapper_style.height['+wrapper_style.height +'] window.innerHeight['+window.innerHeight+'] window.outerHeight['+window.outerHeight+']');
    if (parseFloat(wrapper_style.height, 10) > window.innerHeight) {
      //remove the Topmost child except the Template
      var notifications = this.notificaitons_wrapper.getElementsByClassName('error-message');
      this.notificaitons_wrapper.removeChild(notifications[1]);
    }
    
    //требование заказчика
    //После появления ошибки, скрыть ее через 3 секунды
    window.setTimeout(
      this.notification_close.bind(this, notification),
      this.notification_close_delay 
    );
  };

  //notification. close
  this.notification_close = function (notification) {
    notification.parentNode.removeChild(notification);
  };
  
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//-----ключевые объекты

  //---OSRM BackEnd
  //this.OSRMBackEnd = new OSRMBackEndClass();
  //this.OSRMBackEnd.log_enabled = true;

  //---BackEnd  - должен быть первым
  this.BackEnd = new BackEndClass();
  this.BackEnd.log_enabled = true;
  
  this.backend_onReject = function (xhr_obj, txt) {
    this.notification_new('', txt);
  };
  this.BackEnd.onReject = this.backend_onReject.bind(this);
  //this.OSRMBackEnd.onReject = this.backend_onReject.bind(this);

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//---навигация адаптивная
//должна быть перед картой чтобы инициализация карты не задерживала адаптивное размeщение навигации

  this.NavigationOnDemand = new NavigationOnDemandClass({
  });
  //this.NavigationOnDemand.log_enabled = true;
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
      this.overlaid_Show(document.getElementById(popover_id));
    }
  };
  var keys = Object.keys(this.navigation_items);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    document.getElementById(k).addEventListener('click', this.navigation_item_onClick.bind(this));
    var popover_id = this.navigation_items[k];
    if (popover_id && popover_id.length) {
      document.getElementById(popover_id).addEventListener('click', this.overlaid_onClick.bind(this));
    }
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
    this.overlaid_Show(document.getElementById('popover-help'));
  };
  this.nav_help_ref = document.getElementById('nav-help');
  this.nav_help_ref.addEventListener('click', this.navigation_help_onClick.bind(this));
  this.popover_help = document.getElementById('popover-help');
  //attach the standard listener to have proper [X] behavior
  this.popover_help.addEventListener('click', this.overlaid_onClick.bind(this));
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
  this.SearchWithSuggestons = new SearchWithSuggestonsClass({
    back_end: this.BackEnd,
    input_id: 'address-input', suggestion_dropdown_id: 'address-suggestions', 
    length_min: 3, delay_to_xhr_start: 1000
  });
  this.SearchWithSuggestons.log_enabled = true;
  //this.SearchWithSuggestons.test_inp_val();
  //this.log('ok');
  
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//---список адресов
  
  //callback для списка адресов
  //ссылка которой можно поделиться изменилась
  this.link_to_share_onChange = function (link) {
    this.log('link_to_share_onChange. link['+link+']');
    
    if (link && link.length) {
      this.link_to_share.innerHTML = link;
      this.link_copy_btn.disabled = false;
      //кнопкa Поделиться будет разрешена после формирования первой не-пустой ссылки
      this.link_to_share_btn.disabled = false;
    } else {
      if (!this.link_to_share_debug) {
        this.link_to_share.innerHTML = '';
      }
      this.link_copy_btn.disabled = true;
      //требование заказчика
      //не запрещать кнопку Поделиться
      //this.link_to_share_btn.disabled = true;
    }
  };
  //задать значение по умолчанию для ссылки которой можно поделиться
  this.link_to_share_onChange(false);

  //this.log('MapWithMarkerList creating...');
  this.MapWithMarkerList = new MapWithMarkerListClass({
    back_end: this.BackEnd,
    
    map: {id: 'map'},
    address_list_id: 'address-list', route_optimize_btn_id: 'route-optimize-btn'
  });
  this.MapWithMarkerList.onLinkToShareChanged = this.link_to_share_onChange.bind(this);
  this.MapWithMarkerList.UI_display_message_callback = this.notification_new.bind(this);
  this.MapWithMarkerList.log_enabled = true;
  //this.log('ok');

  //-- test cases
  //=[?testtest_add_files=1]
  //this.log('document.location.search ['+document.location.search+']');
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
