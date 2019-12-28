'use strict';
//=============================================================================
/*
карта и список маркеров
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function MapWithMarkerListClass(options) {
  //this.log_enabled = true;//debug the constructor
  
  //this.C = this.constructor;
  this.C = MapWithMarkerListClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  //для тестов
  this.test_ListFillFinish_callback = null;
  
  //для вывода сообщений в UI
  this.UI_display_message_callback = null;
  
  this.back_end = options.back_end;
  
  //--- Карта. ключевой объект на странице
  //опции отображения карты
  this.map_options = {
    //--- zoom levels
    //20 very zoomed. streets are clearly visible
    //10 city-scale zoom. large city and it's outskirts are visible
    //5 region-scale zoom. nearby cities are visible
    zoom_default: 10,
    marker: {
      on_publish: {
        pan: true
      }
    },
    
    //могут использоваться различные engine для рисования маркеров и маршрутов
    //
    //possible values 'routing-lib'  'crafted'
    //renderer: 'routing-lib'
    renderer: 'crafted'
  };
  this.map_obj = null;//главный объект карты
  this.MapCreate(options.map.id);
  
  //plugin for Leaflet
  this.LeafletRoutingMachine = null;
  
  //иконки маркерами с нарисованным номером 0..99
  this.map_icons_pool = {};
  this.MapIconsPool_Create(this.C.Map.marker.icon.color.default);
  this.MapIconsPool_Create(this.C.Map.marker.icon.color.active);
  
  //Линии маршрутов, глобальный список. используется для удаления всех линий
  this.polylines_pool = [];

  //--- Список адресов. ключевой объект на странице
  //from console Application.MapWithMarkerList.address_list_html.childNodes.length
  this.address_list_html = document.getElementById(options.address_list_id);
  this.PageAddressList_Remove();
  
  //homebrewed DnD 
  this.DragAndDrop = {
    dragged_node: null,
    initial_offset: {x: 0, y: 0},
    placeholder: null,
    saved: {
      focus: null,
      parent: null,
      style: null,
      nextSibling: null
    },
    droppable_moved_over: null, //используется для определения входа\выхода мыши из droppable
    touch: {
      //ref-to-object Might be non-reliable because touch objects re-created in some browsers
      tracked_id: null
    }
  };
  //the following handler might be assigned to either the Draggable element or the whole page 
  //{passive: false} requred to be able to call preventDefault
  //without passive: false preventDefault will be ignored:
  //Ignoring ‘preventDefault()’ call on event of type ‘touchmove’ from a listener registered as ‘passive’.
  this.address_list_html.addEventListener('mousedown', this.draggable_onMouseDown.bind(this));
  this.address_list_html.addEventListener('touchstart', this.draggable_onTouchStart.bind(this), {passive: false});
  //the following handlers must be assigned to the whole page
  document.addEventListener('mousemove', this.document_onMouseMove.bind(this));
  document.addEventListener('touchmove', this.document_onTouchMove.bind(this), {passive: false});
  document.addEventListener('mouseup', this.document_onMouseUp.bind(this));
  document.addEventListener('touchend', this.document_onTouchEnd.bind(this), {passive: false});
  document.addEventListener('touchcancel', this.document_onTouchCancel.bind(this), {passive: false});
  
  //Abandoned
  //the following handler(s) must be assigned to Droppable.
  //this is a special handler, for synthetic events generated in the page's onMouseMove
  //it is nearly equal to a sub-routine for the page's onMouseMove
  //this.address_list_html.addEventListener('mousemove', this.droppable_onMouseMove.bind(this));

  //DnD native. draggable. prevent it
  this.address_list_html.addEventListener('dragstart', this.draggable_onDragstart.bind(this));
  //prevent some default behaviors
  this.address_list_html.addEventListener('click', this.draggable_onClick.bind(this));
  this.address_list_html.addEventListener('dblclick', this.draggable_onDblClick.bind(this));
  this.address_list_html.addEventListener('contextmenu', this.draggable_onContextMenu.bind(this));
  
  //---ключевой объект на странице. кнопка Оптимизировать маршрут
  this.route_optimize_btn = document.getElementById(options.route_optimize_btn_id);
  this.route_optimize_btn.disabled = true;
  this.route_optimize_btn.addEventListener('click', this.route_optimize_btn_onClick.bind(this));
  //early draft for native routes support
  this.route_data = {
    json: null,
    polyline: null
  };
  
  //вызывается до и после оптимизации маршрута
  this.onRouteOptimize = null;
  
  //вызывается не только после оптимизации маршрута но и после других изменений списка адресов
  this.onLinkToShareChanged = null;

  //--- ключевой ассоциативный массив 
  //внутренняя модель адресов из списка
  //отсюда данные будут отображаться одновременно на карте как маркеры и на странице
  //
  //для распечатки в консоли
  //Application.MapWithMarkerList.address_list

  this.address_list = {};
  
  //самый свежий хэш списка адресов. используется для формирования ссылки которой можно поделиться
  //обновляется после любых изменений списка
  //  Оптимизации маршрута - backEnd сразу возвращает новый хэш
  //  Перемещения\Добавления\Удаления адреса вручную
  this.address_list_uid = '';
  
  //--- вспомогательный индекс для внутренней модели списка адресов
  //массив ID адресов упорядоченный в том порядке 
  //как они в последний раз отображались в представлениях
  //индекс массива начинается с 0
  //используется для оптимизированного обновления представлений
  //
  //для распечатки в консоли
  //Application.MapWithMarkerList.address_list_index.actual
  //Application.MapWithMarkerList.address_list_index.shadow
  this.address_list_index = {actual:[], shadow: null};

  //--- вспомогательная структура данных для ускорения backend.geocode 
  this.geocode = {count: 0, cache: []};
  
}

MapWithMarkerListClass.prototype = new GenericBaseClass();//inherit from
MapWithMarkerListClass.prototype.SuperClass = GenericBaseClass.prototype;

//-----------------------------------------------------------------------------
//вывод сообщений в UI
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.UI_warning = function (msg) {
  this.UI_display_message('Обратите внимание', msg);
};

MapWithMarkerListClass.prototype.UI_display_message = function (title, msg) {
  if (this.UI_display_message_callback) {
    this.UI_display_message_callback(title, msg);
  }
};

//-----------------------------------------------------------------------------
//Добавить Адрес вручную
//-----------------------------------------------------------------------------
/*
ранее добавление адреса выполнялось только после завершения backend.geocode
когда все данные Адреса - и для карты и для страницы готовы

но потребовалось ускорить процесс. для ускорения 

+ на страницу Адрес добавляется сразу, на карту- после завершения backend.geocode 
  если backend.geocode завершён неудачно - Адрес должен быть удалён со страницы
  
+ backend.geocode теперь может запускаться заранее, до добавления адреса
  в момент когда пользователь делает выбор из списка предположений
  
*/
MapWithMarkerListClass.prototype.Address_AppendFromString = function (addr_str) {
  this.log_heading2('Address_AppendFromString');

  //защита от повторных кликов кнопки Добавить
  //сейчас эта защита не актуальна т.к. поле ввода очищается сразу после вызова данного метода
  //if (addr_str && addr_str.length && this.addr_str_to_add_shadow != addr_str) {

  if (addr_str && addr_str.length) {

    this.log('addr_str ['+addr_str+']');
    
    //защита от добавления дубля
    if (!this.AddressList_findId_byTitle(addr_str)) {

      //this.AddressIndex_debug_Dump();

      //информировать UI что ссылка недействительна
      this.LinkToShare_Set();
      
      //Модель. добавить полуготовый адрес
      //добавить неполные данные которые будут дополнены после завершения Backend.Geocode
      var addr_id = this.Address_AddFromLatLng(null, null, addr_str);
      this.log('addr_id assigned ['+addr_id+']');

      //Список на Странице. добавить адрес
      this.PageAddress_Publish(addr_id);
      
      //вспомогательный список. добавить ID 
      this.AddressIndex_Append(addr_id, 'actual');
      
      //проверить выполнилось ли ускоренное получение результата backend.geocode 
      //или возможно ещё не выполнилось но было запущено
      var cache_item = this.Backend_Geocode_cacheItemByAddrString(addr_str);
      if (cache_item) {
        //если результаты backend.geocode готовы то сразу дополнить полу-готовый адрес
        if (cache_item.json) {
          this.log('feeling lucky! the GeoCode result is already available');
          this.Backend_Geocode_AddrFulfill(addr_id, cache_item.json);
        } else {
          //получение результата backend.geocode было запущено но пока ещё не выполнилось
          //отметить что нужно дополнить адрес
          cache_item.addr_id = addr_id;
        }
      } else {
        this.Backend_Geocode_start(addr_str, addr_id);
      }
    } else {
      this.log('ignored. address Title already exists');
      this.UI_warning('такой адрес уже присутствует');
    }
    this.addr_str_to_add_shadow = addr_str;
    
  } else {
    this.log('ignored. input data is either empty or looks the same as the previous one');
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//запускается в момент когда пользователь делает выбор из списка предположений
//  addr_str служит уникальным идентификатором запроса к backEnd

MapWithMarkerListClass.prototype.Address_Append_earlyPeek = function (addr_str) {
  this.log_heading2('Address_Append_earlyPeek. addr_str['+addr_str+']');
  
  //требование заказчика от 22.09.2019
  //Добавить действие «Добавить адрес» при клике на адрес из авто-подбора адреса. 
  //Текущий сценатрий: 
  //а) Пользователь ввел адрес, б) Кликнул по адресу из списка, в) Нажал на кнопку Добавить адрес, г) Адрес добавился в список. 
  //Как должно быть: 
  //а) Пользователь ввел адрес б) Кликнул по адресу из списка в) Адрес добавился в список.
  this.Address_AppendFromString(addr_str);
  
  //по старинке. ранний запуск Geocode
  //this.Backend_Geocode_start(addr_str);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//backend geocode. start
//  addr_id - необязательный параметр. используется для вызова из Address_AppendFromString 
//  обычно эта ф-я вызывается из Address_Append_earlyPeek. передаётся только addr_str

MapWithMarkerListClass.prototype.Backend_Geocode_start = function (addr_str, addr_id) {
  this.log_heading3('Backend_Geocode_start. addr_str ['+addr_str+'] addr_id['+addr_id+']');

  var cache_id = this.Backend_Geocode_cacheAppend(addr_str);
  if (addr_id) {
    this.geocode.cache[cache_id].addr_id = addr_id;
  }
  
  //backend.geocode - старт
  this.back_end.XHR_Start(
    this.back_end.AddressGeocode, 
    {address: addr_str}, 
    this.Backend_Geocode_onFulfill.bind(this, cache_id),
    this.Backend_Geocode_onReject.bind(this, cache_id)
  )
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//backend.geocode завершён успешно
//дополнить адрес из структуры данных возвращённой из BackEnd

MapWithMarkerListClass.prototype.Backend_Geocode_onFulfill = function (cache_id, json) {
  this.log_heading2('Backend_Geocode_onFulfill cache_id['+cache_id+']');

  this.log('json');
  this.log(json);

  //this.AddressIndex_debug_Dump();
  
  //запомнить результат geocode. это необходимо независимо от того присутствует ли addr_id
  var cache_item = this.geocode.cache[cache_id];
  cache_item.json = json;
  
  //если присутствует addr_id 
  //дополнить данные адреса и отобразить недостающие представления
  if (cache_item.addr_id) {
    this.Backend_Geocode_AddrFulfill(cache_item.addr_id, json);
  }
};

//дополнить полу-готовый адрес
//  возможно адрес был удалён вручную(например) пока выполнялся запрос к backEnd
//  это значит что дополнять полу-готовый адрес необходимо мягко, проверяя сначала его наличие

MapWithMarkerListClass.prototype.Backend_Geocode_AddrFulfill = function (addr_id, json) {
  this.log_heading3('Backend_Geocode_AddrFulfill. addr_id['+addr_id+']');
  
  //Модель. дополнить данные
  var merge_status = this.Address_merge_GeoCode(addr_id, json.address_md, json.lat, json.lng);
  switch (merge_status) {
    case 'ok':
      var addr = this.address_list[addr_id];

      //карта. добавить адрес
      this.MapUpdate_AddressAppend(addr_id);
      
      //this.AddressIndex_debug_Dump();
      
      this.AddressList_AfterChange();
      break;

    case 'not_found':
      break;

    case 'duplicate':
      break;
  }
  
  //если дополнение данных неуспешно - удалить полуготовый адрес
  if (merge_status != 'ok') {
    this.log('Warning: Address_merge_GeoCode went wrong. status['+merge_status+']');
    //удалить полу-готовый адрес
    this.Backend_Geocode_AddrRollback(addr_id);
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//backend.geocode завершён неудачно

MapWithMarkerListClass.prototype.Backend_Geocode_onReject = function (cache_id) {
  this.log_heading2('Backend_Geocode_onReject cache_id['+cache_id+']');

  var cache_item = this.geocode.cache[cache_id];
  
  //удалить полу-готовый адрес, если есть
  if (cache_item.addr_id) {
    this.Backend_Geocode_AddrRollback(cache_item.addr_id);
  }
  
  //удалить эл-т cache
  this.Backend_Geocode_cacheRemove(cache_id);
};

//удалить полу-готовый адрес
//  возможно адрес был удалён вручную(например) пока выполнялся запрос к backEnd
//  это значит что удалять полу-готовый адрес необходимо мягко, проверяя сначала его наличие

MapWithMarkerListClass.prototype.Backend_Geocode_AddrRollback = function (addr_id) {
  this.log_heading3('Backend_Geocode_AddrRollback. addr_id['+addr_id+']');
  
  //Список на Странице. удалить из
  //  особый случай. объект возможно уже удалён из модели данных
  //  по этой причине нельзя использовать обычное удаление по объекту addr
  var elem = this.PageAddress_ElementById(addr_id);
  if (elem) {
    elem.parentNode.removeChild(elem);
  }

  //вспомогательный список. удалить ID
  this.AddressIndex_Remove(addr_id, 'actual');//addr_id existance is checked here

  //Модель. удалить
  this.AddressList_Remove(addr_id);//addr_id existance is checked here
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//cache для запросов Geocode
//
//  эл-ты идентифицируются по индексу, по этой причине удаление из cache 
//  при помощи splice недопустимо, в том числе при добавлении нового эл-та
//
//  запуск Geocode может происходить в 2х местах
//  + при выборе пользователем адреса из drop-down списка
//    в этом случае эл-т кэша будет содержать только title в качестве идентификатора
//    позже может быть добавлен addr_id, в том числе и до завршения запроса
//  + при клике Добавить адрес
//    в этом случае эл-т кэша будет содержать только title + addr_id
//
//  если запрос завершился неуспешно, эл-т кэша заменяется undefined
//    это необходимо учитывать например при поиске эл-тов

//Geocode cache. добавить эл-т и вернуть его индекс
MapWithMarkerListClass.prototype.Backend_Geocode_cacheAppend = function (addr_str) {
  this.log_heading6('Backend_Geocode_cacheAppend. addr_str['+addr_str+']');
  
  var item = {addr_str: addr_str};
  var cache = this.geocode.cache;
  
  cache.push(item);
  this.geocode.count++;
  
  //TODO: if too many elements - delete the oldest

  return cache.length - 1;//return the appended item's index
};

//Geocode cache. удалить эл-т по индексу
MapWithMarkerListClass.prototype.Backend_Geocode_cacheRemove = function (cache_id) {
  this.log_heading6('Backend_Geocode_cacheRemove cache_id['+cache_id+']');
  
  //удалить эл-т cache. в cache останется пустота вместо удалённого эл-та
  //splice в данном случае неприменимо
  delete this.geocode.cache[cache_id];
  this.geocode.count--;
  if (this.geocode.count == 0) {
    //playing safe. check if all entries are actually undefined
    var is_all_undefined = true;
    for (var i = 0; i < this.geocode.cache.length; i++) {
      if (this.geocode.cache[i]) {
        is_all_undefined = false;
        break;
      }
    }
    if (!is_all_undefined) {
      this.log('warning: Geocode cache. not all entries are empty then they expected to be');
    }
    this.geocode.cache = [];
  }
};

//найти в cache определённый address.title
MapWithMarkerListClass.prototype.Backend_Geocode_cacheItemByAddrString = function (addr_str) {
  this.log_heading6('Backend_Geocode_cacheFindTitle');
  
  var item = null;
  var cache = this.geocode.cache;

  for (var i = 0; i < cache.length; i++) {
    if (cache[i] && cache[i].addr_str == addr_str) {
      item = cache[i];
    }
  }
  return item;
};

//-----------------------------------------------------------------------------
//Адрес - удаление вручную
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.address_delete_onClick = function (e) {
  this.log_heading2('address_delete_onClick');
  
  //получить ID из эл-та представления
  var addr_id = this.PageAddress_IdFromEvent(e);
  var addr = this.address_list[addr_id];
  
  //представление на карте. удалить. До удаления из модели
  this.MapUpdate_AddressRemoveBefore(addr_id);
  
  //удалить из представления на странице
  this.PageAddress_Remove(addr);

  //удалить из модели
  delete this.address_list[addr_id];
  
  //перенумеровать список адресов
  this.AddressList_LabelsRefresh();
  
  //представление на карте. обновить
  this.MapUpdate_AddressRemoveAfter(addr_id);

  this.AddressList_AfterChange();//здесь будет обновлено состояние кнопки Оптимизировать
};

//-----------------------------------------------------------------------------
//Адрес в списке Перемещён вручную
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.crafted_DnD_DragStartNotify = function (element) {
  //if dragged is an Address, indicate this on the map
  if (element.classList.contains('address')) {
    var addr = this.PageAddress_getAddrObj(element);
    this.MapAddress_setState(addr, 'active');
    this.MapAddress_PanTo(addr);
    //animation Will restart on each Node remove\append. stop the animaiton to prevent restarts
    //animation might be in progress if the corresponding marker is clicked shortly before
    this.PageAddress_AnimationStop(addr);
  }
};

MapWithMarkerListClass.prototype.crafted_DnD_DropNotify = function (element) {
  this.log_heading2('crafted_DnD_DropNotify');
  
  //проверить изменился ли порядок эл-тов
  //бывает что эл-т был перемещён в ту-же самую позицию
  this.AddressIndex_ActualUpdate();
  if (!this.AddressIndex_ActualEqShadow()) {
    var addr_id = this.PageAddress_getId(element);
    
    //карта. удалить
    this.MapUpdate_AddressMoveBefore(addr_id);
    
    //перенумеровать список адресов
    this.AddressList_LabelsRefresh();
    
    //карта. добавить 
    this.MapUpdate_AddressMoveAfter(addr_id);
    
    this.AddressList_AfterChange();
  }
};

//-----------------------------------------------------------------------------
//Оптимизировать маршрут
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.route_optimize_btn_onClick = function (e) {
  this.log_heading2('route_optimize_btn_onClick');
  
  var addr_lst_joined = this.AddressList_getDbIdsJoined();
//  var addr_lst_sorted = this.AddressList_getDbIdsJoined(true);//rejected by customer
  
  //защита от повторных кликов кнпоки Оптимизировать
  if (addr_lst_joined.length && this.address_lst_to_optimize_shadow != addr_lst_joined) {
    this.log('addr_lst_joined ['+addr_lst_joined+']');
    
    //информировать приложение что ссылка недействительна
    this.LinkToShare_Set();
    
    //информировать приложение что сортировка списка адресов началась 
    this.onRouteOptimizeCall(true);
    
    //запустить сортировку списка адресов. процесс включает в себя promise resolve
    //по завершении будет сформирована новая ссылка
    var query = {address: addr_lst_joined};
    this.Query_includeListUID(query);
    
    this.back_end.XHR_Start(
      this.back_end.DistributionAddress, 
      query, 
      this.Backend_OptimizeRoute_onFulfill.bind(this),
      this.Backend_OptimizeRoute_onReject.bind(this)
    )
    
    //требование заказчика
    //пока не завершён запрос к backEnd
    //холодить и менять текст «Расчёт маршрута...»
    this.route_optimize_btn.disabled = true;
    this.route_optimize_btn_caption = this.route_optimize_btn.innerHTML;//save the current caption
    this.route_optimize_btn.innerHTML = this.route_optimize_btn.dataset.captionDisabled;
    
    this.address_lst_to_optimize_shadow = addr_lst_joined;
  } else {
    this.log('ignored. input data looks the same as previous one');
  }
};

MapWithMarkerListClass.prototype.onRouteOptimizeCall = function (inProgress = false) {
  if (this.onRouteOptimize) {
    this.onRouteOptimize(inProgress);
  }
};

//некоторые методы back-end имеют необязательный параметр md_list, по смыслу UID списка адресов
//включить этот параметр в запрос, если имеется валидное значение
MapWithMarkerListClass.prototype.Query_includeListUID = function (query) {
  if (this.address_list_uid && this.address_list_uid.length) {
    query.md_list = this.address_list_uid;
  }
};

/*
json sample 
{
  "result":1,
  "address":{
  "1":"38af2f6336175c317199a69a6ed517ad",
  "2":"b5742034fa159d987c9bd4974b17c9b4",
  "3":"dc2c4a85b13973866d70f2318204c6a0",
  "4":"d2977a0e452f1dcc632812db409e3054"
  },
  "route":{
    "overview_polyline":"gkylJ_``xDkAdRGPMHo@Ia@OcAUe@?[PwAfCeClEaClE[k@Uk@w@uC_Ka`@WmAoBuHe@kBq@kDiAyFZa@zCiDt@o@nB_C~@{AnBuCLQb@kAJs@Bg@b@cLP_E?W?WxDjAtInCvBn@fCp@pGpB\JDm@|@eQrBk]t@iLBk@`Ct@~DrA`@XjAb@xA`@XyC~HtC|Aj@LJIZE|@H|@JZLPNFNARILQJYF]@cAE_@I[NWH_@~@yD|Lfc@fF|QhCdKlB~GdCdInGvU~@xD`@fBZ~BvBjObDjUxB~N`BvLvIbm@`CrP`BjLLjA?bAK|G]dTU~Sa@pWEpGnHdDnFjCnKhFfAd@xGdDpBfAb@Pj@R^C~FgBr@Yv@c@n@g@z@q@Rp@lAbE`@lA^t@TTJFd@NxHbAvAN|Cf@l@J?P@`@Jl@R^LFX?PIb@g@~CsDlBoBbB}AhGuEXOTCd@BpDj@|Ex@zAR`F|@\NTN`C`C|I`Jh@b@fCpCvAxA~GbHpGnGpCvCdA~@rAnAdAjA~K|KbSdSbDhDrGdHlA`AxAtAL`@F`@Ab@BdAN|@Zn@RPLH\@XIZ]Na@Lg@D_@@}Ad@}@PGxJqBlCa@dGwAbI{AtFy@`KqBrHyA|AKbA@^BhATp@Vt@ZtAz@xArApAbBpB`DjAxBjCvF~BvFzExKtDnJbDxI|BrGhEzMtE|NxArFtCtKzCpKf@hBV^jEtNnDfLxBhI`BtGfCpLPz@nAbJ~A`MdCdPfA`Hz@nGXdEz@lRThH?|@fDrFhK~PlGjKrJ|NnQbXpUt]GzjAfFE@oB?m@cBEAcFu@?SjKy@@?jE@pQ?pO?zD?{D?qOA{Jx@??T",
    "points_gps":[
      {
      "lat":59.93668,
      "lng":30.31568
      },
      {
      "lat":59.93706,
      "lng":30.31261
      }
    ]
  },
"md_list":"3y6x430"
*/
MapWithMarkerListClass.prototype.Backend_OptimizeRoute_onFulfill = function (json) {
  this.log_heading2('Backend_OptimizeRoute_onFulfill');

  this.log(json);
  //this.debug_addr_id_list_pair_compare(this.AddressIndex_getList('shadow'), json.address);

  this.route_data.json = json;
  
  //карта. удалить
  this.MapUpdate_AllSortBefore();
  
  //пере-сортировать список адресов. при этом label не изменяются, только переставляются адреса 
  this.PageAddressList_ReorderByDbIdAssociativeArray(json.address);
  
  //перенумеровать список адресов
  this.AddressList_LabelsRefresh();
  
  //карта. добавить 
  this.MapUpdate_AllSortAfter();
  
  //md_list из json будет сохранён
  this.AddressList_AfterChange(json);

  //sorta hack. set last-memorized address_lst to the just optimized 
  //to avoid Optimize button to react at the first click right after optimization
  //watch glosely: if value saved in route_optimize_btn_onClick changed
  //it should be changed here too
  this.address_lst_to_optimize_shadow = this.AddressList_getDbIdsJoined();

  //test case. Works
  //window.setTimeout(this.Backend_OptimizeRoute_onReject.bind(this), 2000);
  
  //common actions
  this.Backend_OptimizeRoute_onSettle();
};

//обновить состояние кнопки Оптимизировать
MapWithMarkerListClass.prototype.route_optimize_btn_state_update = function () {
  //должно быть как минимум 2 адреса чтобы был маршрут
  //не исключено что Оптимизировать имеет смысл только если имеется 3 адреса
  this.route_optimize_btn.disabled = this.address_list_html.childNodes.length < 2;
};

//оптимизация завершилась ошибкой
//информировать UI об этом. если открыт поповер со ссылкой то он должен быть авто-закрыт
//сообщение об ошибке появится в любом случае благодаря BackEnd.onReject
MapWithMarkerListClass.prototype.Backend_OptimizeRoute_onReject = function () {
  //информировать приложение что формирование ссылки завершилось ошибкой
  this.LinkToShare_Set(null);
  
  //common actions
  this.Backend_OptimizeRoute_onSettle();
};

//оптимизация завершилась. то что должно быть выполнено независимо от успешности
MapWithMarkerListClass.prototype.Backend_OptimizeRoute_onSettle = function () {
  //требование заказчика
  //пока не завершён запрос к backEnd
  //холодить и менять текст «Расчёт маршрута...»
  this.route_optimize_btn.disabled = false;
  this.route_optimize_btn.innerHTML = this.route_optimize_btn_caption;//restore the caption from saved
  
  //информировать приложение что сортировка списка адресов завершена 
  this.onRouteOptimizeCall();
};

//-----------------------------------------------------------------------------
//Ссылка-которой-можно-поделиться
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.LinkToShare_BuildFromJson = function (json) {
  this.address_list_uid = json.md_list;
  this.LinkToShare_Set(this.back_end.LinkToShareFromJson(json));
};

//внешний интерфейс для обновления эл-тов управления например кнопки Поделиться ссылкой
MapWithMarkerListClass.prototype.LinkToShare_Set = function (link) {
  if (this.onLinkToShareChanged) {
    this.onLinkToShareChanged(link);
  }
};

//-----------------------------------------------------------------------------
//Список адресов - Модель
//-----------------------------------------------------------------------------
//Добавить Адрес в модель по координатам (+ Строка + Метка)
//
//label_idx - для меток списка адресов
//  начинается с 0
//  отображается в текстовую метку добавлением 1
//  напрямую, без преобразования отображается в индекс иконки маркера на карте
//
//  в будущем возможно отображение этого инекса на символы например A B C
//
//  может изменяться произвольно после оптимизации маршрута
//
//title - адрес или часть адреса, 
//  на карте будет отображаться в ToolTip или PopUp

MapWithMarkerListClass.prototype.Address_AddFromLatLng = function (lat, lng, title, db_id, label_idx) {
  //this.log('Address_AddFromLatLng lat lng['+lat+']['+lng+'] title['+title+']');
  
  var addr_id = this.C.address_factory.id_prefix + this.C.address_factory.id_num;
  label_idx = label_idx || Object.keys(this.address_list).length;
  
  if (this.address_list[addr_id]) {
    throw 'addr_id ['+addr_id+'] already exists'
  }
  
  var addr = {
    lat: lat,
    lng: lng,
    label_idx: label_idx, 
    title: title,
    //DB ref
    db_id: db_id || null,
    //Map refs
    map_marker: null,
    map_routes: {prev: {}, next: {}},
    //Page refs
    page_element: null
  };
  
  this.address_list[addr_id] = addr;
  
  this.C.address_factory.id_num++;

  //this.log('addr_id=['+addr_id+']');
  //this.log(addr);
  
  return addr_id;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//дополнить незавершённый адрес результатом выполнения backend.geocode 
//
//при этом учесть что 
//  - такой DB_ID может уже существовать. такое возможно если один и тот-же адрес добавляется второй раз
//  - addr_id может быть не найден. такое возможно если пока выполялся запрос объект был удалён

MapWithMarkerListClass.prototype.Address_merge_GeoCode = function (addr_id, addr_db_id, lat, lng) {
  var status = 'ok';
  var addr = this.address_list[addr_id];

  //пока выполнялся метод BackEnd, данные которого переданы данной ф-ии
  //адрес мог быть удалён. проверка на это
  if (addr) {
    //проверить существует ли уже такой DB_ID который требуется merge
    var maybe_duplicate_id = this.AddressList_findId_byDbId(addr_db_id);
    if (maybe_duplicate_id) {
      status = 'duplicate';
      //this.log('Warning: addr_db_id duplicate ['+addr_db_id+'] addr_id['+addr_id+']');
    } else {
      //дополнить данные
      addr.db_id = addr_db_id;
      addr.lat = lat;
      addr.lng = lng;
    }
  } else {
    status = 'not_found';
    //this.log('Warning: address not found in this.address_list by addr_id['+addr_id+']');
  }
  return status;
};

//найти адрес по DB_ID
MapWithMarkerListClass.prototype.AddressList_findId_byDbId = function (addr_db_id) {
  var addr_id = null;

  var keys = Object.keys(this.address_list);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (this.address_list[k].db_id == addr_db_id) {
      addr_id = k;
      break;
    }
  }
  return addr_id;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//Модель. удалить адрес по id
MapWithMarkerListClass.prototype.AddressList_Remove = function (addr_id) {
  if (this.address_list[addr_id]) {
    delete this.address_list[addr_id];
  }
};

//адрес. имеются ли координаты? если geocode не завершён - координаты пустые (=0 или =null)
MapWithMarkerListClass.prototype.Address_hasLatLng = function (addr) {
  return addr ? (addr.lat && addr.lng) : false;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.Address_debug_Id_ToStrMin = function (addr_id) {
  var s = '';
  if (addr_id) {
    if (this.address_list[addr_id]) {
      s = 'addr_id['+addr_id+'] title['+this.address_list[addr_id].title+']\n';
    } else {
      s = 'addr_id['+addr_id+'] Not found in address_list\n';
    }
  }
  return s;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//перенумеровать список адресов
//в том порядке как они расположены на странице
//после любого изменения списка - Удаление \ Перемещение эл-та \ Сортировка списка
//Добавление эл-та не требует перенумерования
//
//оптимизация: используется сохранённый предыдущий порядок
//label изменяются только для адресов у которых поменялось место в списке

MapWithMarkerListClass.prototype.AddressList_LabelsRefresh = function () {
  this.log_heading4('AddressList_LabelsRefresh');
  
  var id_lst = this.AddressIndex_ActualUpdate();
  var id_lst_shadow = this.address_list_index.shadow;
  
  //this.log('id_lst');
  //this.log(id_lst);
  //this.log('id_lst_shadow');
  //this.log(id_lst_shadow);
  
  for (var i = 0; i < id_lst.length; i++) {
    var addr_id = id_lst[i];

    //this.log('i['+i+'] page addr_id['+addr_id+'] shadow addr_id['+id_lst_shadow[i]+']');
    if (addr_id != id_lst_shadow[i]) {
      //this.log('addr_id mismatch. update label...');
      var addr = this.address_list[addr_id];

      //обновить Модель
      addr.label_idx = i;
      //обновить представление на странице
      this.PageAddress_setLabel(addr, i);
      //обновить представление на карте
      this.MapUpdate_MarkerSetLabel(addr, i);
    }
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//список изменился - эл-т добавлен \ перемещён \ удалён и т.д.
//  json - этот параметр передаётся если есть готовый UID списка адресов 
//    и его не требуется формировать отдельно
//    так бывает после некоторых операций например Оптимизация 

MapWithMarkerListClass.prototype.AddressList_AfterChange = function (json) {
  this.log_heading4('AddressList_AfterChange');
  
  this.route_optimize_btn_state_update();
  
  //запомнить текущий порядок адресов на странице
  this.address_list_index.shadow = this.address_list_index.actual;
  
  if (!json) {
    //информировать приложение что ссылка недействительна
    this.LinkToShare_Set();
    //обновить Unique ID списка адресов. процесс включает в себя promise resolve
    //по завершении будет сформирована новая ссылка
    this.AddressList_UniqueID_Refresh_Require();
  } else {
    //сформировать ссылку которой можно поделиться
    this.LinkToShare_BuildFromJson(json);
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//обновить Unique ID списка адресов. в BackEnd это поле md_list 

MapWithMarkerListClass.prototype.AddressList_UniqueID_Refresh_Require = function () {
  window.clearTimeout(this.unique_id_timeout);//Passing an invalid ID to clearTimeout() silently does nothing; no exception is thrown.
  this.unique_id_timeout = window.setTimeout(
    this.Backend_DistributionHand_Start.bind(this),
    this.C.unique_id_timeout_delay
  );
};

MapWithMarkerListClass.prototype.Backend_DistributionHand_Start = function () {
  this.log_heading5('Backend_DistributionHand_Start');
  
  var addr_lst_joined = this.AddressList_getDbIdsJoined();
  
  if (addr_lst_joined.length) {
    var query = {address: addr_lst_joined};
    this.Query_includeListUID(query);
    
    this.back_end.XHR_Start(
      this.back_end.DistributionHand, 
      query, 
      this.Backend_DistributionHand_onFulfill.bind(this)
    )
  }
};

/*
json sample
  {
    "result":1,
    "address":{
    "1":"87365a03d2013fd966f90011021fd297",
    "2":"d4abbd70fa959bcbdf39b1185728ec3f",
    "3":"33ca68b2f84e30afcf6768ed9090e6b6"
  },
  "md_list":"e7b145c8d01f4ee3f1c65357b60c727d"
*/
MapWithMarkerListClass.prototype.Backend_DistributionHand_onFulfill = function (json) {//json должен быть последним
  this.log_heading5('Backend_DistributionHand_onFulfill');
  this.log(json);
  
  //сформировать ссылку которой можно поделиться
  this.LinkToShare_BuildFromJson(json);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//получить список DB ID адресов 
//в виде строки 'idA,idB, ...'
//используется как аргумент для некоторых методов back-end
//порядок адресов 
//по умолчанию = как они расположены на странице
//если do_sort = true то сортировка по DB ID
//сортировка требуется для защиты от повторных обращений к back-end
//c тем-же набором адресов
MapWithMarkerListClass.prototype.AddressList_getDbIdsJoined = function (do_sort) {
  var id_lst = this.AddressIndex_getList('actual');
  var db_id_lst = [];
  
  for (var i = 0; i < id_lst.length; i++) {
    var addr = this.address_list[id_lst[i]];
    db_id_lst.push(do_sort ? addr.db_id.toLowerCase() : addr.db_id);
  }
  
  if (do_sort) {
    db_id_lst.sort(function(a, b) {
      if (a > b) {
        return 1;
      }
      if (a < b) {
        return -1;
      }
      return 0;
    });
  }

  return db_id_lst.join(',');
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//label = метка сейчас 1 2 3...  в будущем может стать A B C или I II III IV...
//используется при
//  добавлении адреса в различные представления

MapWithMarkerListClass.prototype.Address_LabelIdx_toString = function (label_idx) {
  return label_idx + this.C.address_list.label.idx_base;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//найти ID адреса по строке
//можно использовать для предотвращения дубликатов

MapWithMarkerListClass.prototype.AddressList_findId_byTitle = function (title) {
  //this.log('AddressList_findId_byTitle');
  
  var id;
  var keys = Object.keys(this.address_list);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (title == this.address_list[k].title) {
      id = k;
      break;
    }
  }
  return id;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//у всех ли адресов есть координаты?
//эта проверка имеет смысл если используется отложенное добавление адреса
//используется например для рисования линий на карте

MapWithMarkerListClass.prototype.AddressList_AllHas_LatLng = function () {
  this.log_heading6('AddressList_AllHas_LatLng');
  
  var ok = true;
  var keys = Object.keys(this.address_list);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (!this.Address_hasLatLng(this.address_list[k])) {
      ok = false;
      break;
    }
  }
  return ok;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

MapWithMarkerListClass.prototype.debug_addr_id_list_pair_compare = function (addr_id_lst_old, addr_id_lst_new) {
  this.log('debug_addr_id_list_pair_compare');
  
  //авто-определить начальный индекс
  var idx_base = addr_id_lst_new[0] ? 0 : 1;
  this.log('addr_id_lst_old.length['+addr_id_lst_old.length+'] addr_id_lst_new.length['+addr_id_lst_new.length - idx_base+'] equal=['+(addr_id_lst_old.length == addr_id_lst_new.length - idx_base)+']');
  
  var is_diff = false;
  
  for (var i = 0; i < addr_id_lst_old.length; i++) {
    var old_id = addr_id_lst_old[i];
    var new_id = addr_id_lst_new[i + idx_base];
    if (old_id != new_id) {
      this.log('diff at i['+i+'] old['+this.address_list[old_id].title+']          new['+this.address_list[new_id].title+']');
      is_diff = true;
    }
    if (!is_diff) {
      this.log('old and new all items are equal');
    }
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Вспомогательные списки ID адресов
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//списки содержат ID адресов. по смыслу близки к DB index 
//
//как правило эти списки отражают порядок адресов на странице
//но эти списки могут меняться независимо
//
//списков два 
//+ 'actual' для текущего состояния (возможно незавершённого, как например при сортировке)
//+ 'shadow' для состояния сохранённого после предыдущей завершённой операции (Добавление\Удаление\Перемещение...)
//
//возможны другие реализации
//например к this.address_list[...] добавить св-ва .next .prev

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//получить ID предыдущего\следующего адреса по данному ID
//в том порядке как они расположены на странице
//
//для определения предыдущего\следующего используется 
//необязательный параметр where
//  по умолчанию = 'shadow'
//  можно передавать 'actual'

MapWithMarkerListClass.prototype.AddressIndex_getPrevId = function (addr_id, where) {
  return this.AddressIndex_getSiblingId(addr_id, -1, where);
};

MapWithMarkerListClass.prototype.AddressIndex_getNextId = function (addr_id, where) {
  return this.AddressIndex_getSiblingId(addr_id, 1, where);
};

MapWithMarkerListClass.prototype.AddressIndex_getLastId = function (where) {
  return this.AddressIndex_getSiblingId(null, -1, where);
};

MapWithMarkerListClass.prototype.AddressIndex_getIdx = function (addr_id, where) {
  return this.AddressIndex_getSiblingId(addr_id, 0, where);
};

MapWithMarkerListClass.prototype.AddressIndex_getSiblingId = function (addr_id, offset, where) {
  //this.log('Address_getSiblingId addr_id['+addr_id+'] offset['+offset+'] where['+where+']');
  
  var id_lst = this.AddressIndex_getList(where);
  var id;
  
  if (id_lst && id_lst.length) {
    if (addr_id) {
      var i = id_lst.indexOf(addr_id);
      id = id_lst[i + offset];
    } else {
      if (offset >= 0) {
        id = id_lst[offset];
      } else {
        id = id_lst[id_lst.length + offset];
      }
    }
  }
  return id;
};

MapWithMarkerListClass.prototype.AddressIndex_getList = function (where) {
  where = where || 'shadow';
  return this.address_list_index[where];
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//индекс. добавить ID
MapWithMarkerListClass.prototype.AddressIndex_Append = function (addr_id, where) {
  var id_lst = this.AddressIndex_getList(where);
  id_lst.push(addr_id);
};

//индекс. удалить ID 
MapWithMarkerListClass.prototype.AddressIndex_Remove = function (addr_id, where) {
  var result = true;
  var id_lst = this.AddressIndex_getList(where);
  var i = id_lst.indexOf(addr_id);
  if (i >= 0) {
    id_lst.splice(i, 1);
  } else {
    result = false;//addr_id not found
  }
  return result;
};

/*
Abandoned
//индекс. заменить ID
MapWithMarkerListClass.prototype.AddressIndex_Replace = function (addr_id_old, addr_id_new, where) {
  var id_lst = this.AddressIndex_getList(where);
  var i = id_lst.indexOf(addr_id_old);
  id_lst[i] = addr_id_new;
};
*/

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//обновить текущий индекс. вернуть ссылку на обновлённый список
MapWithMarkerListClass.prototype.AddressIndex_ActualUpdate = function () {
  return this.address_list_index.actual = this.PageAddressList_getIdArray();
};

//сравнить текущий индекс с shadow
MapWithMarkerListClass.prototype.AddressIndex_ActualEqShadow = function () {
  var equal = false;
  var actual = this.AddressIndex_getList('actual');
  var shadow = this.AddressIndex_getList('shadow');
  if (actual && shadow && actual.length == shadow.length) {
    equal = true;
    for (var i = 0; i < actual.length; i++) {
      if (actual[i] != shadow[i]) {
        equal = false;
        break;
      }
    }
  }
  return equal;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//debug

MapWithMarkerListClass.prototype.AddressIndex_debug_Dump = function () {
  this.log('AddressList_debug_Dump');
  
  var id_lst = this.AddressIndex_getList('actual');
  var id_lst_shadow = this.AddressIndex_getList('shadow');
  
  //this.AddressIndex_debug_DumpLength('actual', id_lst);
  //this.AddressIndex_debug_DumpLength('shadow', id_lst_shadow);

  var concat1 = '';
  var concat2 = '';
  var s;
  var len_arr = [
    id_lst ? id_lst.length : 0, 
    id_lst_shadow ? id_lst_shadow.length : 0
  ];

  for (var i = 0; i < Math.max(len_arr[0], len_arr[1]); i++) {
    var id = id_lst ? id_lst[i] : '';
    var id_shadow = id_lst_shadow ? id_lst_shadow[i] : '';
    var le = Math.max(id.length, id_shadow.length);

    s = id;
    s += (le != s.length) ? ' '.repeat(le - s.length) : '';
    id = s;

    s = id_shadow;
    s += (le != s.length) ? ' '.repeat(le - s.length) : '';
    id_shadow = s;
    
    s = concat1;
    s += s.length ? ', ' : '';
    s += id;
    concat1 = s;
    
    s = concat2;
    s += s.length ? ', ' : '';
    s += id_shadow;
    concat2 = s;
    
  }
  this.log('actual id_list len['+len_arr[0]+'] ['+concat1+']');
  this.log('shadow id_list len['+len_arr[1]+'] ['+concat2+']');
};

MapWithMarkerListClass.prototype.AddressIndex_debug_DumpLength = function (name, list) {
  if (list) {
    this.log(''+name+'.length['+list.length+']');
  } else {
    this.log(''+name+' looks =null or undefined. length n\a');
  }
};

//-----------------------------------------------------------------------------
//Список адресов на странице - представление
//-----------------------------------------------------------------------------
//добавить адрес в представление на странице
//marker - внутреннее представление маркера = элемент this.address_list

MapWithMarkerListClass.prototype.PageAddress_Publish = function (addr_id) {
  var addr = this.address_list[addr_id];
  var li = document.createElement('li');
  addr.page_element = li;
  this.PageAddress_setId(li, addr_id);
  li.classList.add('address');
  li.dataset.craftedDragAndDrop = 'draggable';

  //<span>1. </span>
  var label = document.createElement('span');
  label.innerHTML = this.PageAddress_LabelIdx_Format(addr.label_idx);
  li.appendChild(label);
  
  var txt = document.createTextNode(addr.title);
  li.appendChild(txt);

  var spacer = document.createElement('span');
  spacer.classList.add('spacer-r');
  spacer.innerHTML = '&nbsp;';
  li.appendChild(spacer);

  var img = document.createElement('img');
  img.dataset.craftedDragAndDrop = 'exclude';
  img.src = "./assets/images/close-gray.svg";
  img.alt = "x";
  img.addEventListener('click', this.address_delete_onClick.bind(this));

  //img.src = "./assets/images/hamburger-gray.svg";
  //img.alt = "=";
  li.appendChild(img);

  this.address_list_html.appendChild(li);
};

MapWithMarkerListClass.prototype.PageAddress_LabelIdx_Format = function (label_idx) {
  return this.Address_LabelIdx_toString(label_idx) + '&nbsp;.&nbsp;';
};

MapWithMarkerListClass.prototype.PageAddress_setLabel = function (addr, label_idx) {
  var label_elem = addr.page_element.childNodes[0];
  label_elem.innerHTML = this.PageAddress_LabelIdx_Format(label_idx);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.PageAddress_AnimationStart = function (addr) {
  myUtils.Element_animation_start(addr.page_element, 'item-active-anim');
  //item_html.classList.add('item-active-anim');
};

MapWithMarkerListClass.prototype.PageAddress_AnimationStop = function (addr) {
  addr.page_element.classList.remove('item-active-anim');
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//удалить все адреса из представления на странице

MapWithMarkerListClass.prototype.PageAddressList_Remove = function () {
  myUtils.Element_Clear(this.address_list_html);
};

//удалить адрес из представления на странице

MapWithMarkerListClass.prototype.PageAddress_Remove = function (addr) {
  this.address_list_html.removeChild(addr.page_element);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//получить внутренний ID адреса по событию, 
//произошедшему в одном из дочерних эл-тов Адреса
MapWithMarkerListClass.prototype.PageAddress_IdFromEvent = function (evt) {
  return this.PageAddress_getId(this.PageAddress_ElementFromEvent(evt));
};

//получить объект Модели из эл-та представления
MapWithMarkerListClass.prototype.PageAddress_getAddrObj = function (element) {
  return this.address_list[this.PageAddress_getId(element)];
};

//получить внутренний ID адреса из эл-та представления
MapWithMarkerListClass.prototype.PageAddress_getId = function (element) {
  return element ? element.dataset.id : null;
};

//записать внутренний ID адреса в эл-т представления
MapWithMarkerListClass.prototype.PageAddress_setId = function (element, addr_id) {
  element.dataset.id = addr_id;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//получить HTML элемент адреса по событию, 
//произошедшему в одном из дочерних эл-тов Адреса

MapWithMarkerListClass.prototype.PageAddress_ElementFromEvent = function (evt) {
  //known work for: [X] button
  return evt.target.parentNode;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//получить массив ID всех адресов из списка
//в том порядке как адреса расположены на странице
//используется для обновления представлений
//
//так же используется для backEnd как аргумент
//если результат объединить методом join

MapWithMarkerListClass.prototype.PageAddressList_getIdArray = function () {
  var children = this.address_list_html.childNodes;
  var id_arr = [];
  
  for (var i = 0; i < children.length; i++) {
    var addr_id = this.PageAddress_getId(children[i]);
    id_arr.push(addr_id);
  }
  
  return id_arr;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//найти эл-т на странице по ID

MapWithMarkerListClass.prototype.PageAddress_ElementById = function (addr_id) {
  var elem = null;
  var children = this.address_list_html.childNodes;
  
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (addr_id = this.PageAddress_getId(child)) {
      elem = child;
      break;
    }
  }
  
  return elem;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//изменить порядок адресов на странице в соотвествии с массивом ID
//например после сортировки списка адресов
//предполагается что кол-во эл-тов в массиве и на странице совпадает
//индексы массива могут начинаться не с 0 а с 1
//
//address_list index shadow здесь не используется т.к список изменяется динамически
//и shadow станет неактуальным уже после первого изменения

//обёртка конвертирующая объект-ассоциативный массив в простой массив
//внимание: иногда BackEnd возвращает не ассоциативный а простой массив, необходима проверка на это
MapWithMarkerListClass.prototype.PageAddressList_ReorderByDbIdAssociativeArray = function (associative_array) {
  this.log_heading5('PageAddressList_ReorderByDbIdAssociativeArray');
  
  if (associative_array instanceof Object) {
    this.PageAddressList_ReorderByDbIdArray(Object.values(associative_array));//not work in IE
    
    //var id_lst = [];
    //var keys = Object.keys(associative_array);
    //for (var i = 0; i < keys.length; i++) {
    //  id_lst.push(associative_array[keys[i]]);
    //}
    //this.PageAddressList_ReorderByDbIdArray(id_lst);
  } else if (associative_array instanceof Array) {
    this.PageAddressList_ReorderByDbIdArray(associative_array);
  } else {
    this.log('Warning: argument has an unknown type');
  }
};

MapWithMarkerListClass.prototype.PageAddressList_ReorderByDbIdArray = function (addr_db_id_arr) {
  this.log_heading5('PageAddressList_ReorderByDbIdArray');
  
  //this.log('addr_db_id_arr');
  //this.log(addr_db_id_arr);
  
  if (addr_db_id_arr.length) {
    //авто-определить начальный индекс
    var idx_base = addr_db_id_arr[0] ? 0 : 1;
    //=live nodes list
    var children = this.address_list_html.childNodes;
    
    for (var i = idx_base; i < addr_db_id_arr.length; i++) {
      var addr_id = this.AddressList_findId_byDbId(addr_db_id_arr[i]);
      var existing_elem = children[i - idx_base];
      //this.log('existing_elem');
      //this.log(existing_elem);
      var existing_id = this.PageAddress_getId(existing_elem);
      //this.log('i['+i+'] addr_id['+addr_id+'] existing_id['+existing_id +']');
      if (addr_id != existing_id) {
        var new_elem = this.address_list[addr_id].page_element;
        //this.log('new_elem');
        //this.log(new_elem);
        //переместить в текущую позицию адрес полученный по ID
        this.address_list_html.insertBefore(new_elem, existing_elem);
      } else {
        //this.log('new_id == existing_id');
      }
    }
  } else {
    this.log('Warning: addr_db_id_arr is empty');
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//DnD crafted
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
/*
---MouseEvent 
MouseEvent.button Read only
    The button number that was pressed (if applicable) when the mouse event was fired.
MouseEvent.buttons Read only
    The buttons being depressed (if any) when the mouse event was fired.
    
0: Main button pressed, usually the left button or the un-initialized state
1: Auxiliary button pressed, usually the wheel button or the middle button (if present)
2: Secondary button pressed, usually the right button

MouseEvent.clientX Read only
    The X coordinate of the mouse pointer in local (DOM content) coordinates.
MouseEvent.clientY Read only
    The Y coordinate of the mouse pointer in local (DOM content) coordinates.
    
MouseEvent.movementX Read only
    The X coordinate of the mouse pointer relative to the position of the last mousemove event.
MouseEvent.movementY Read only
    The Y coordinate of the mouse pointer relative to the position of the last mousemove event.
*/

MapWithMarkerListClass.prototype.draggable_onMouseDown = function (e) {
  this.log_heading1('draggable_onMouseDown');
  if (e.button == myUtilsClass.mouse.button.main) {
    var dragged = this.crafted_DnD_getDraggable(e.target);
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();//not sure this is neceassary
      this.crafted_DnD_onDragStart(e, dragged);
    }
  }
};

MapWithMarkerListClass.prototype.crafted_DnD_onDragStart = function (e, dragged) {
  this.log_heading2('crafted_DnD_onDragStart');
  
  //lose focus, if any. focus IS interfer with DnD
  var dnd = this.DragAndDrop;
  dnd.saved.focus = myUtils.Document_Blur();
  
  //get a ref to the Dragged
  dnd.dragged_node = dragged;
  var parent = dnd.saved.parent = dragged.parentNode;
  dnd.saved.nextSibling = dragged.nextSibling;
  //save the current inline style props, if any
  var saved_style = dnd.saved.style = {};
  saved_style.position = dragged.style.position;
  saved_style.left = dragged.style.left;
  saved_style.top = dragged.style.top;
  saved_style.width = dragged.style.width;
  saved_style.height = dragged.style.height;
  
  //notify the main app
  this.crafted_DnD_DragStartNotify(dnd.dragged_node);
  
  //read the curent Dragged style. this is useful to 
  //  copy styles to a placeholder
  //  to set fixed WH so WH will not be affected by a new parent
  var dragged_style = window.getComputedStyle(dragged);
  dragged.style.width = dragged_style.width;
  dragged.style.height = dragged_style.height;

  //latch the initial offset between mouse and TL corner. 
  //this helps avoid Dragged to "jump" on the start-drag
  var rect = dragged.getBoundingClientRect();
  this.DragAndDrop.initial_offset = myUtils.xy_subtract(
    {x: rect.left, y: rect.top}, {x: e.clientX, y: e.clientY}
  );
  
  //create a placeholder
  var placeholder = dnd.placeholder = document.createElement('li');
  placeholder.classList.add('placeholder');
  placeholder.style.height = dragged_style.height;
  
  //replace Dragged with Placeholder and attach Dragged to the whole Document
  var new_parent = document.body;
  parent.replaceChild(placeholder, dragged);
  new_parent.appendChild(dragged);

  //set some inline styles
  dragged.style.position = 'absolute';
  this.Dragged_setPos(dragged, e);

  dragged.classList.add('dragged');
  
  //this.log('this.DragAndDrop.dragged_node['+this.DragAndDrop.dragged_node+']');
  //this.log('this.DragAndDrop.saved.parent['+this.DragAndDrop.saved.parent+']');
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.document_onMouseMove = function (e) {
  this.log_heading1('document_onMouseMove');
  //! important to check isTrusted. this prevents infinite recursion 
  //because synthetic 'mousemove' event is created in this handler
  if (this.crafted_DnD_isDragging() && e.isTrusted) {
    e.preventDefault();
    this.crafted_DnD_onDragMove(e);
  }
};

//closest native method named 'DragOver' but it has different meaning
MapWithMarkerListClass.prototype.crafted_DnD_onDragMove = function (e) {
  //this.log_heading2('crafted_DnD_onDragMove');//!uncomment this only for debug
  
  var dnd = this.DragAndDrop;

  //e.preventDefault();//this must be done outside because this can't be done for synthetic evt
    
  var dragged = dnd.dragged_node;
  this.Dragged_setPos(dragged, e);
  
  //---synthetic event for the element below the Mouse = potential drop target
  dragged.hidden = true;//without this elementFromPoint will always return Draggable

  //DAMNED e.clientX\Y = undefined in FireFox. let's fallback
  var x = e.clientX || e.x;
  var y = e.clientY || e.y;

  var below = document.elementFromPoint(x, y);
  if (below) {
    //this event can be easy dintinguished from native events by .isTrusted = undefined = false
    var mouseEventInit = {
      bubbles:  true,
      target:   below,

      screenX:  e.screenX,
      screenY:  e.screenY, 
      clientX:  x, 
      clientY:  y, 
      ctrlKey:  e.ctrlKey, 
      shiftKey: e.shiftKey,
      altKey:   e.altKey,
      metaKey:  e.metaKey,
      button:   e.button, 
      buttons:  e.buttons
    };
    
    //this way not works :(
    //var mouseEventInit = {};
    //myUtils.Object_AppendFrom(mouseEventInit, e);
    //mouseEventInit.clientX = mouseEventInit.clientX || e.x;
    //mouseEventInit.clientY = mouseEventInit.clientY || e.y; 
    //mouseEventInit.bubbles = true;
    
    //this.log('mouseEventInit');
    //this.log(mouseEventInit);
    
    //Abanodoned
    //var synth_event = new MouseEvent('mousemove', mouseEventInit);
    //below.dispatchEvent(synth_event);
    
    //прямой вызов без dispatch
    this.crafted_DnD_Droppable_onDragOver(mouseEventInit);
  }
  dragged.hidden = false;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.document_onMouseUp = function (e) {
  this.log_heading1('document_onMouseUp');
  if (this.crafted_DnD_isDragging()) {
    e.preventDefault();
    this.crafted_DnD_onDragEnd(e);
  }
};

//created specially to call from touchCancel
MapWithMarkerListClass.prototype.crafted_DnD_onDragCancel = function (e) {
  if (this.crafted_DnD_isDragging()) {
    e.preventDefault();
    this.crafted_DnD_onDragEnd(e, true);
  }
};

//several native methods exists 'DragEnd' 'Drop' etc
MapWithMarkerListClass.prototype.crafted_DnD_onDragEnd = function (e, is_cancelled) {
  this.log_heading2('crafted_DnD_onDragEnd');
  var dnd = this.DragAndDrop;

  //e.preventDefault();//this must be done outside because this can't be done for synthetic evt
  
  //if dragged is an Address, indicate this on the map
  if (dnd.dragged_node.classList.contains('address')) {
    var addr = this.PageAddress_getAddrObj(dnd.dragged_node);
    this.MapAddress_setState(addr, 'default');
  }
    
  if (is_cancelled) {
    //move placeholder to the original position where Drag was started
    dnd.saved.parent.insertBefore(dnd.placeholder, dnd.saved.nextSibling);
  }
  
  //replace Placeholder with Dragged
  var dragged = dnd.dragged_node;
  dnd.saved.parent.replaceChild(dragged, dnd.placeholder);

  //restore saved styles
  myUtils.Object_AppendFrom(dragged.style, dnd.saved.style);
  
  this.crafted_DnD_DropNotify(dragged);

  dragged.classList.remove('dragged');
  dnd.dragged_node = null;
  
  //требование заказчика
  //отключить (как минимум для смартфонов)
  //на десктопе (FireFox) фокус сам восстанавливается
  //восстановить фокус
  //dnd.saved.focus.focus();
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//utils 

//this might be used by another technologies for example Touch
MapWithMarkerListClass.prototype.crafted_DnD_getDraggable = function (target) {
  var draggable = null;

  var depth_max = 5;
  var level = 0;
  var elem = target;

  //search will break if attr value = 'exclude' encountered at any level
  do {
    var attr_val = elem ? elem.dataset.craftedDragAndDrop : false;
    var is_found = attr_val == 'draggable';
    
    if (!is_found) {
      elem = elem.parentNode;
      level++;
    }

  } while (!(is_found || level >= depth_max || attr_val == 'exclude') && elem);
    
  if (is_found) {
    draggable = elem;
  }
  return draggable;
};

//this might be used by another technologies for example Touch
MapWithMarkerListClass.prototype.crafted_DnD_isDragging = function (target) {
  return this.DragAndDrop.dragged_node !== null;
};

MapWithMarkerListClass.prototype.Dragged_setPos = function (dragged, e) {
  var pos = myUtils.xy_add(this.MouseEvent_getPos(e), this.DragAndDrop.initial_offset);
  myUtils.Element_styleTopLeft_from_xy(dragged, pos);
};
MapWithMarkerListClass.prototype.MouseEvent_getPos = function (e) {
  return {x: e.pageX, y: e.pageY};//relative to document?
  //return {x: e.clientX, y: e.clientY};//relative to window
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//prevent some default behaviors
//this Not prevents text selection by mouse

MapWithMarkerListClass.prototype.draggable_onClick = function (e) {
  this.log_heading1('draggable_onClick');
  e.preventDefault();
  return false;
};
MapWithMarkerListClass.prototype.draggable_onDblClick = function (e) {
  this.log_heading1('draggable_onDblClick');
  e.preventDefault();
  return false;
};
MapWithMarkerListClass.prototype.draggable_onContextMenu = function (e) {
  this.log_heading1('draggable_onContextMenu');
  e.preventDefault();
  e.stopPropagation();
  return false;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//DnD native. prevent it

MapWithMarkerListClass.prototype.draggable_onDragstart = function (e) {
  e.preventDefault();
  return false;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//DnD for target

/*
Abandoned
MapWithMarkerListClass.prototype.droppable_onMouseMove = function (e) {
  //this.log('droppable_onMouseMove');
  
  //isTrusted checked beacuse payload events will be non-truted
  if (this.DragAndDrop.dragged_node && !e.isTrusted) {
    //! important to stop propagation to avoid this event to be sent to document mousemove handler
    //this Will lead to infinite recusive events
    //alternative is to cancel any synthetic events in the document mousemove handler
    e.stopPropagation();
    e.stopImmediatePropagation();//not sure this is neceassary
    
    e.preventDefault();
    this.crafted_DnD_Droppable_onDragOver(e);
  }
};
*/

MapWithMarkerListClass.prototype.crafted_DnD_Droppable_onDragOver = function (e) {
  var dnd = this.DragAndDrop;
  var dragged = dnd.dragged_node;
  var placeholder = dnd.placeholder;
  var item_moved_over = e.target;
  //this.log_heading2('crafted_DnD_Droppable_onDragOver ');
  
  //TODO: make a better test
  if (item_moved_over.parentNode == this.address_list_html && item_moved_over != placeholder) {
  
    //--- detect at which half of item_moved_over the mouse is
    //.offsetTop is Wrong choice 
    //it returns Y _relative_ to the closest offsetParent while e.clientY relative to the window
    var parent = item_moved_over.parentNode;
    var height = item_moved_over.offsetHeight;
    var target_rect = item_moved_over.getBoundingClientRect();
    var placeholder_relY = placeholder.offsetTop - item_moved_over.offsetTop;
    var placeholder_place = placeholder_relY < 0 ? 'before' : 'after';

    var placement;
    if (
      //убедиться что курсор в пределах эл-та 
      e.clientX >= target_rect.left && e.clientX <= target_rect.right && 
      e.clientY >= target_rect.top && e.clientY <= target_rect.bottom
    ) {
      //принять решение в какой половине эл-та находится курсор
      var relY = e.clientY - target_rect.top;
      placement = (relY < height / 2) ? 'before' : 'after';
    }

    if (placement) {
      //this.log('placement['+placement +'] placeholder_place['+placeholder_place +']');

      if (placement != placeholder_place) {
      
        //переместить placeholder перед\после item_moved_over
        parent.removeChild(placeholder);
        if (placement == 'before') {
          parent.insertBefore(placeholder, item_moved_over);
        } else {
          //If referenceNode is null, the newNode is inserted at the end of the list of child nodes.
          parent.insertBefore(placeholder, item_moved_over.nextSibling);
        }
        
      }
    }

    //--- detect mouse enter\leave
    //var item_moved_over_old = this.DragAndDrop.item_moved_over_moved_over;
    //if (item_moved_over != item_moved_over_old) {
    //  if (item_moved_over_old) {
    //    item_moved_over_old.style.backgroundColor = '';
    //  }
    //  this.DragAndDrop.item_moved_over_moved_over = item_moved_over;
    //  item_moved_over.style.backgroundColor = 'violet';
    //}
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//DnD crafted. touch support
//используется прямой вызов обработчиков предназначенных для мыши
//с передачей искуственно скомпонованного Event-a напрямую
//без использования dispatchEvent(...), во избежание побочных эффектов

MapWithMarkerListClass.prototype.draggable_onTouchStart = function (e) {
  this.log_heading1('draggable_onTouchStart');
  //this.TouchEvent_dump(e);
  
  var touches = e.changedTouches;
  if (touches.length) {
    var dragged = this.crafted_DnD_getDraggable(e.target);
    if (dragged) {
      e.preventDefault();
      //this.log('about to call hadnler for mouse...');
      this.DragAndDrop.touch.tracked_id = touches[0].identifier;
      this.crafted_DnD_onDragStart(this.TouchEvent_toMouseEvent(e, this.DragAndDrop.touch.tracked_id), dragged);
    }
  }
  return false;
};

MapWithMarkerListClass.prototype.document_onTouchMove = function (e) {
  this.log_heading1('document_onTouchMove');
  //this.TouchEvent_dump(e);
  //=0
  //this.log('tracked_id['+this.DragAndDrop.touch.tracked_id+']');
  //=false
  //this.log('instanceof Number['+(this.DragAndDrop.touch.tracked_id instanceof Number)+']');
  //=number
  //this.log('typeof tracked_id['+(typeof this.DragAndDrop.touch.tracked_id )+']');

  if (myUtils.touch_isIdValid(this.DragAndDrop.touch.tracked_id)) {
    e.preventDefault();
    //this.log('about to call hadnler for mouse...');
    this.crafted_DnD_onDragMove(this.TouchEvent_toMouseEvent(e, this.DragAndDrop.touch.tracked_id));
  }
  return false;
};

MapWithMarkerListClass.prototype.document_onTouchEnd = function (e) {
  this.log_heading1('document_onTouchEnd');
  //this.TouchEvent_dump(e);

  if (myUtils.touch_isIdValid(this.DragAndDrop.touch.tracked_id)) {
    e.preventDefault();
    //this.log('about to call hadnler for mouse...');
    this.crafted_DnD_onDragEnd(this.TouchEvent_toMouseEvent(e, this.DragAndDrop.touch.tracked_id));
  }
  this.DragAndDrop.touch.tracked_id = null;
  return false;
};

MapWithMarkerListClass.prototype.document_onTouchCancel = function (e) {
  this.log_heading1('document_onTouchCancel');
  //this.TouchEvent_dump(e);

  if (myUtils.touch_isIdValid(this.DragAndDrop.touch.tracked_id)) {
    e.preventDefault();
    //this.log('about to call hadnler for mouse...');
    this.crafted_DnD_onDragCancel(this.TouchEvent_toMouseEvent(e, this.DragAndDrop.touch.tracked_id));
  }
  this.DragAndDrop.touch.tracked_id = null;
  return false;
};

/*
//---sample touch obj
clientX: 113
​​clientY: 176
​​force: 0
​​identifier: 0
​​pageX: 113
​​pageY: 176
​​radiusX: 1
​​radiusY: 1
​​rotationAngle: 0
​​screenX: 1051
​​screenY: 310
​​target: id="93c6c7590475e6ad865f3bd63e823319" js_draggable="">
​​*/
//this is Not 100% correct implementation
MapWithMarkerListClass.prototype.TouchEvent_toMouseEvent = function (e, touch_id) {
  var mouse_evt = null;

  //fetch the desired touch obj
  var touches = e.touches;
  var touch;
  for (var i = 0; i < touches.length; i++) {
    if (touches[i].identifier == touch_id) {
      touch = touches[i];
      break;
    }
  }
  //this.log('touch ['+touch+'] touch_id['+touch_id+']');

  //transform touch evt to mouse evt
  if (touch) {
    //this event can be easy dintinguished from native events by .isTrusted = undefined = false
    var mouseEventInit = {
      bubbles: true,
      button: myUtilsClass.mouse.button.main,
      
      target:   e.target,
      currentTarget: e.currentTarget,
      //--poor option for .target
      //the Element on which the touch point started when it was first placed on the surface, 
      //even if the touch point has since moved outside the interactive area of that element 
      //or even been removed from the document.
      //target:   touch.target, 

      screenX:  touch.screenX,
      screenY:  touch.screenY, 
      clientX:  touch.clientX, 
      clientY:  touch.clientY, 
      pageX:    touch.pageX, 
      pageY:    touch.pageY, 
    };
    
    //this.log('mouseEventInit');
    //this.log(mouseEventInit);
    
    //Abanodoned
    //var mouse_evt = new MouseEvent(
    //  myUtilsClass.touch.ToMouseEvent.TypeMap[e.type], 
    //  mouseEventInit
    //);
  }
  //this.log('e.target['+e.target+'] e.currentTarget['+e.currentTarget+']');
  //this.log('mouseEventInit.target['+mouseEventInit.target+'] mouseEventInit.currentTarget['+mouseEventInit.currentTarget+']');

  return mouseEventInit;
  //return mouse_evt;//Abanodoned
};

MapWithMarkerListClass.prototype.TouchEvent_dump = function (e) {
  this.log('---TouchEvent_dump');
  e.preventDefault();
  this.log('changedTouches.length['+e.changedTouches.length+']');
  this.log(e.changedTouches);
  this.log('targetTouches.length['+e.targetTouches.length+']');
  this.log(e.targetTouches);
  this.log('touches.length['+e.touches.length+']');
  this.log(e.touches);
  this.log('target.id['+e.target.id+'] target.tagName['+e.target.tagName+']');
};

//-----------------------------------------------------------------------------
//Карта powered by LeafLet - представление
//-----------------------------------------------------------------------------
//Интерфейс карты для внешних вызовов
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//note: only 'routing-lib' currently supported

MapWithMarkerListClass.prototype.MapUpdate_AddressAppend = function (addr_id) {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllPublish();
      break;
      
    case 'crafted':
      //карта. добавить маркер
      this.MapAddress_Publish(addr_id, {pan: true});
      //карта. добавить линии до предыдущего + следующего
      this.MapAddress_RoutePublish(addr_id);
      break;
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.MapUpdate_AddressRemoveBefore = function (addr_id) {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllRemove();
      break;
      
    case 'crafted':
      //реальный маршрут. более недействителен
      this.MapUpdate_RouteReal_Invalidate();
      
      //удалить из представления на карте. До удаления из модели
      this.MapAddress_MarkerRemove(this.address_list[addr_id]);
      this.MapAddress_RouteRemove(addr_id);
      break;
  }
};

MapWithMarkerListClass.prototype.MapUpdate_AddressRemoveAfter = function (addr_id) {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllPublish();
      break;
      
    case 'crafted':
      //реальный маршрут. если был то нарисовать что-нибудь взамен
      this.MapUpdate_RouteReal_needFallback();
      break;
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.MapUpdate_AddressMoveBefore = function (addr_id) {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllRemove();
      break;
      
    case 'crafted':
      //реальный маршрут. более недействителен
      this.MapUpdate_RouteReal_Invalidate();

      //удалить линии маршрутов
      this.MapAddress_RouteRemove(addr_id);
      break;
  }
};

MapWithMarkerListClass.prototype.MapUpdate_AddressMoveAfter = function (addr_id) {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllPublish();
      break;
      
    case 'crafted':
      //реальный маршрут. если ранее был но стал невалидным 
      //то нарисовать прямые взамен. если это отрабатывает как надо 
      //то рисовать отдельно прямые для перемещённого адреса не требуется
      if (!this.MapUpdate_RouteReal_needFallback()) {
        //добавить новые линии маршрутов
        this.MapAddress_RoutePublish(addr_id);
      }
      
      break;
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//реальный маршрут. более недействителен
//но если он был то вместо него нужно будет нарисовать прямые линии после изменения модели
MapWithMarkerListClass.prototype.MapUpdate_RouteReal_Invalidate = function (addr_id) {
  if (this.MapRouteReal_isAvailable()) {
    this.MapRouteReal_AllInvalidate();
    this.MapUpdate_RouteReal_rqFallback = true;
  }
};

//реальный маршрут. если был то нарисовать что-нибудь взамен
MapWithMarkerListClass.prototype.MapUpdate_RouteReal_needFallback = function (addr_id) {
  var rq = this.MapUpdate_RouteReal_rqFallback;
  if (rq) {
    //добавить все линии маршрутов
    this.MapRoute_AllPublish();
    this.MapUpdate_RouteReal_rqFallback = false;
  }
  return rq;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.MapUpdate_AllSortBefore = function () {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllRemove();
      break;
      
    case 'crafted':
      //удалить все линии маршрутов
      this.MapRoute_AllRemove();
      //реальный маршрут. более недействителен
      //удаление не требуется, он всё равно удалится перед новой отрисовкой
      //this.MapRouteReal_AllInvalidate();
      break;
  }
};

MapWithMarkerListClass.prototype.MapUpdate_AllSortAfter = function () {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllPublish();
      break;
      
    case 'crafted':
      if (this.MapRouteReal_isAvailable()) {
        //реальный маршрут. нарисовать
        this.MapRouteReal_AllPublish();
      } else {
        //добавить все линии маршрутов
        this.MapRoute_AllPublish();
      }
      break;
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.MapUpdate_MarkerSetLabel = function (addr, i) {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      //не обновлять Label для маркеров
      //предполагается что весь список маркеров будет
      //удалён перед изменением списка адресов
      //заново наполнен после изменения списка адресов
      break;
      
    case 'crafted':
      //обновить представление на карте
      this.MapAddress_setLabel(addr, i);
      break;
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//добавить маркер на карту
//address - внутреннее представление маркера = элемент this.address_list

MapWithMarkerListClass.prototype.MapAddress_Publish = function (addr_id, options) {
  var addr = this.address_list[addr_id];
  options.icon_color = options.icon_color || this.C.Map.marker.icon.color.default;

  //добавить на карту маркер для адреса
  var icons_pool = this.map_icons_pool[options.icon_color];
  var mrk = L.marker([addr.lat, addr.lng], {icon: icons_pool[addr.label_idx]});//custom icon pool. Works

  addr.map_marker = mrk;
  mrk.addr_id = addr_id;
  mrk.on('click', this.map_marker_onClick.bind(this));
  
  mrk.bindTooltip(String(addr.title), {}).openTooltip();//tooltip = address
  //mrk.bindPopup(addr.title);
  mrk.addTo(this.map_obj);

  if (options.pan) {
    //прокрутить вид карты к расположению нового маркера
    this.MapAddress_PanTo(addr);
  }
};

//Карта. Маркер. клик
MapWithMarkerListClass.prototype.map_marker_onClick = function (e) {
  this.log_heading1('map_marker_onClick');
  
  //this.log(e);
  
  var mrk = e.sourceTarget;
  if (mrk.addr_id) {
    //Список на Странице. подсветить адрес
    //this.log('mrk.addr_id['+mrk.addr_id+']');
    var addr = this.address_list[mrk.addr_id];
    this.PageAddress_AnimationStart(addr);
    
    //маркер. подсветить на время. 
    //задержка желательно = времени анимации эл-та списка на странице
    this.MapAddress_AnimationStart(addr);
    this.unique_id_timeout = window.setTimeout(
      this.MapAddress_AnimationStop.bind(this, addr),
      this.C.Map.marker.click_animaiton_delay
    );
  }
  
  //=MouseEvent
  //this.log('originalEvent.constructor.name['+e.originalEvent.constructor.name+']');
  
  //=i wtf???
  //this.log('target.constructor.name['+e.target.constructor.name+']');
  //=i wtf???
  //this.log('sourceTarget.constructor.name['+e.sourceTarget.constructor.name+']');
  //undefined usually
  //this.log('propagatedFrom.constructor.name['+e.propagatedFrom.constructor.name+']');
};

MapWithMarkerListClass.prototype.MapAddress_AnimationStart = function (addr) {
  //сначала убедиться что такой адрес-объект существует. он мог быть удалён по разным причинам
  if (addr.map_marker) {
    this.MapAddress_setState(addr, 'active');
  }
};

MapWithMarkerListClass.prototype.MapAddress_AnimationStop = function (addr) {
  //сначала убедиться что такой адрес-объект существует. он мог быть удалён по разным причинам
  if (addr.map_marker) {
    this.MapAddress_setState(addr, 'default');
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//адрес -> маркер. установить состояние 'default' 'active' и т.д.

MapWithMarkerListClass.prototype.MapAddress_setState = function (addr, state) {
  addr.map_marker.state = state;
  this.MapAddress_Icon_setColor(addr, this.C.Map.marker.icon.color[state]);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//адрес -> маркер. заменить цвет иконки

MapWithMarkerListClass.prototype.MapAddress_Icon_setColor = function (addr, icon_color) {
  addr.map_marker.setIcon(this.map_icons_pool[icon_color][addr.label_idx]);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//адрес -> маркер. изменить текстовую метку
//это делается заменой иконки

MapWithMarkerListClass.prototype.MapAddress_setLabel = function (addr, label_idx) {
  //текущий цвет иконки должен остаться неизменным
  var state = addr.map_marker.state || 'default';
  var icon_color = this.C.Map.marker.icon.color[state];
  addr.map_marker.setIcon(this.map_icons_pool[icon_color][label_idx]);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//прокрутить вид карты к расположению нового маркера
//вызывается в том числе из Drag-and-Drop
MapWithMarkerListClass.prototype.MapAddress_PanTo = function (addr) {
  var lat_lng = new L.LatLng(addr.lat, addr.lng);
  
  if (!this.MapBoundsContains(this.map_obj.getBounds(), lat_lng)) {
    this.map_obj.setView(lat_lng);
  }

  //not works :(
  //if (this.map_obj.getBounds().contains(lat_lng)) {
};

/*
--- this.map_obj.getBounds() sample

looks like Min coords
"_southWest": {
  "lat": 59.663579139024066,
  "lng": 29.74685668945313
},

looks like Max coords
"_northEast": {
  "lat": 60.20707506634915,
  "lng": 30.89767456054688
}

*/
MapWithMarkerListClass.prototype.MapBoundsContains = function (bounds, point) {
  var ne = bounds.getNorthEast();
  var sw = bounds.getSouthWest();
  //intentionally '<' not '<=' to not allow half-visible markers
  var lat = sw.lat < point.lat && point.lat < ne.lat;
  var lng = sw.lng < point.lng && point.lng < ne.lng;
  this.log('sw.lat['+sw.lat+'] point.lat['+point.lat+'] ne.lat['+ne.lat+']');
  this.log('sw.lng['+sw.lng+'] point.lng['+point.lng+'] ne.lng['+ne.lng+']');
  this.log('lat['+lat+'] lng['+lng+']');
  return lng && lat;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//адрес -> маркер. удалить с карты 

MapWithMarkerListClass.prototype.MapAddress_MarkerRemove = function (addr) {
  addr.map_marker.remove();
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//удалить все маркеры с карты

MapWithMarkerListClass.prototype.MapMarker_AllRemove = function () {
  var ids = Object.keys(this.address_list);
  for (var i = 0; i < ids.length; i++) {
    this.MapAddress_MarkerRemove(this.address_list[ids[i]]);
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.MapCreate = function (map_id) {
  this.log_heading2('MapCreate');
  
  var map_element = document.getElementById(map_id);
  if (this.MapLibExists() && map_element) {

    //получить значения по умолчанию из HTML
    var defaults = this.map_options.defaults = this.MapDefaultsFetch(map_element);
    //this.log('Map defaults');
    //this.log(defaults);
    
    //apply fallbacks to defaults
    var peterburg = new L.LatLng(59.939095,30.315868);
    var moscow = new L.LatLng(55.755814,37.617635);
    defaults.loc = defaults.loc || peterburg;
    defaults.zoom = defaults.zoom || this.map_options.zoom_default;
    defaults.autodetect_failed_loc = defaults.autodetect_failed_loc || defaults.loc;
    defaults.autodetect_failed_zoom = defaults.autodetect_failed_zoom || defaults.autodetect_failed_zoom;
    
    //создать карту
    this.map_obj = new L.Map(map_id);

    //NOTE: if site uses HTTPS then tileLayer must use HTTPS too, 
    //else XHR requests for tiles will be blocked by the Browser (FireFox at least)
    
    //tiles server protocol autodetect. should == page protocol
    var protocol = myUtils.http_protocol_detect();
    this.log('protocol autodetected['+protocol+']');

    //-- from leaflet-routing-machine demo
    //attribution: 'Maps by <a href="https://www.mapbox.com/about/maps/">MapBox</a>. ' +
    //  'Routes from <a href="http://project-osrm.org/">OSRM</a>, ' +
    //  'data uses <a href="http://opendatacommons.org/licenses/odbl/">ODbL</a> license'    
    //
    //-- old
    //attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
    
    //L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    L.tileLayer(protocol + '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Maps by <a href="http://openstreetmap.org/">OpenStreetMap</a>.'
        //the following two lines are for leaflet-routing-machine use only
        //+ ' Routes from <a href="http://project-osrm.org/">OSRM</a>, ' +
        //'data uses <a href="http://opendatacommons.org/licenses/odbl/">ODbL</a> license'
      ,maxZoom: 18
    }).addTo(this.map_obj);
    //this.map_obj.attributionControl.setPrefix(''); // Don't show the 'Powered by Leaflet' text.

    //задать координаты по умолчанию
    //если координаты не заданы то карта будет пустая
    this.map_obj.setView(defaults.loc, defaults.zoom);
    
    //test
    //var test_mrk = L.marker(defaults.loc).addTo(this.map_obj);
    
    //no use for markers
    //this.map_obj.on('click', this.map_onClick.bind(this));
    
    //---start user location auto-detect by IP
    if (defaults.autodetect_enabled) {
      this.map_obj.on('locationfound', this.Map_onLocationFound.bind(this));
      this.map_obj.on('locationerror', this.Map_onLocationError.bind(this));
      
      //Note: if geolocation failedif geolocation failed, world view is set 
      //      only if some view is not already set with .setView
      //
      //setView   If true, automatically sets the map view to the user location with respect to detection accuracy, 
      //          or to world view if geolocation failed.
      //maxZoom   The maximum zoom for automatic view setting when using setView option.
      this.map_obj.locate({setView: true, maxZoom: defaults.zoom});
    }
    
    this.log('-----finished ok');
  } else {
    document.getElementById(map_id).innerHTML("карта недоступна");
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//user location auto-detect by IP

MapWithMarkerListClass.prototype.Map_onLocationFound = function (e) {
  this.log_heading3('Map_onLocationFound ['+e.latlng+']');
  this.log('e.latlng');
  this.log(e.latlng);
  
  //var radius = e.accuracy / 2;
  //var location = e.latlng;
  //L.marker(location).addTo(map);
  //L.circle(location, radius).addTo(map);
};

//if user cancels the geolocation prompt
//  e.message[Geolocation error: User denied geolocation prompt.] 
//  e.code[1]
//
//on error, the view is actualy Not set to whole world 
//  only if some view is not already set with .setView
MapWithMarkerListClass.prototype.Map_onLocationError = function (e) {
  this.log_heading3('Map_onLocationError e.message['+e.message+'] e.code['+e.code+']');
  var defaults = this.map_options.defaults;
  this.map_obj.setView(defaults.autodetect_failed_loc, defaults.autodetect_failed_zoom);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//значения по умолчанию. получить из HTML
MapWithMarkerListClass.prototype.MapDefaultsFetch = function (element) {
  var descriptor = {
    loc: {name: 'defaultLocation',  type: 'loc'},
    zoom: {name: 'defaultZoom',  type: 'int'},
    autodetect_enabled: {name: 'autodetectEnabled',  type: 'bool'},
    autodetect_failed_loc: {name: 'autodetectFailedLocation',  type: 'loc'},
    autodetect_failed_zoom: {name: 'autodetectFailedZoom',  type: 'int'}
  };

  return myUtils.Element_datasetFetchValues(element, descriptor, this.MapDefaultsConvert.bind(this));
};

//значения по умолчанию. преобразовать из строк в соотв. типы данных
MapWithMarkerListClass.prototype.MapDefaultsConvert = function (type, val) {
  var output;
  switch (type) {
    case 'loc':
      var a = val.split(',');
      output = new L.LatLng(a[0], a[1]);
      break;
      
    default:
      output = myUtils.datasetValConvert(type, val);
  }
  return output;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//клик на маркере не bubbles для карты
//так что этот обработчик нельзя использовать для кликов на маркерах
MapWithMarkerListClass.prototype.map_onClick = function (e) {
  this.log_heading1('map_onClick');
  
  //this.log(e);
  //=Object
  //this.log('e.constructor.name['+e.constructor.name+']');
  //=Object
  this.log('latlng.constructor.name['+e.latlng.constructor.name+']');
  //=MouseEvent
  //this.log('originalEvent.constructor.name['+e.originalEvent.constructor.name+']');
  
  this.log('target.constructor.name['+e.target.constructor.name+']');
  this.log('sourceTarget.constructor.name['+e.sourceTarget.constructor.name+']');
  //undefined usually
  //this.log('propagatedFrom.constructor.name['+e.propagatedFrom.constructor.name+']');
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//подключена ли библиотека карт?
MapWithMarkerListClass.prototype.MapLibExists = function () {
  return (window.L ? true : false);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//label_idx должен напрямую соотвествовать иконке с корректным номером метки
//label_idx=0 номер=1  label_idx=1 номер=2  label_idx=2 номер=3  ...

MapWithMarkerListClass.prototype.MapIconsPool_Create = function (color) {
  //this.log_enabled = true;

  //LeafLet library sometimes NA. guard against it
  if (myMapIconClass) {
    var pool = this.map_icons_pool[color] = [];
    
    var icon_cls = myMapIconClass;
    var suffix;
    
    //var formatter = new Intl.NumberFormat('en-US', {style: 'decimal', minimumIntegerDigits: 2});

    //начать с 1. при этом иконка с номером "0" будет пропущена
    //индекс массива 0 будет соответствовать иконке с номером 1
    for (var i = this.C.address_list.label.idx_base; i <= 99; i++) {
      suffix = i;
      //suffix = formatter.format(i);
      //this.log(suffix);

      pool.push(new myMapIconClass({
        colorPath: color,
        iconUrl: icon_cls.file_name_base + suffix + icon_cls.file_name_ext,
        iconRetinaUrl: icon_cls.file_name_base_retina + suffix + icon_cls.file_name_ext
      }));
    }
  }
};

//var myTestIcon = new myMapIconClass();

//var greenIcon = new myMapIconClass({iconUrl: 'leaf-green.png'});
//var redIcon = new myMapIconClass({iconUrl: 'leaf-red.png'});
//var orangeIcon = new myMapIconClass({iconUrl: 'leaf-orange.png'});

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Маршруты - представление дополнительное на карте
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//распечатать в консоли
//Application.MapWithMarkerList.polylines_pool
//
//для получения текущего порядка адресов используется this.address_list_index.actual
//Но this.address_list_index.shadow Не используется
//вместо этого для линий реализован отдельный механизм 
//хранения addr.map_routes.prev\next. addr addr_id

//нарисовать все линии маршрута
MapWithMarkerListClass.prototype.MapRoute_AllPublish = function () {
  this.log_heading3('MapRoute_AllPublish');

  //сначала удалить все линии маршрута. это перестраховка т.к обычно линии уже удалены
  this.MapRoute_AllRemove();
  
  var id_lst = this.AddressIndex_getList('actual');
  for (var i = 0; i < id_lst.length; i++) {
    var from_id = id_lst[i];
    var to_id = id_lst[i + 1];
    if (from_id && to_id) {
      this.MapRoute_PublishFromTo(from_id, to_id);
    }
  }
  
};

//удалить все линии маршрута
MapWithMarkerListClass.prototype.MapRoute_AllRemove = function () {
  this.log_heading3('MapRoute_AllRemove');
  
  //delete refs to lines
  var ids = Object.keys(this.address_list);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var addr = this.address_list[id];
    addr.map_routes.prev = {};
    addr.map_routes.next = {};
  }
  
  //delete lines
  this.MapLine_AllRemove();
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//нарисовать две линии маршрута по одному ID. 
//нетривиально. 
//+ необходимо сначала удалить линию предыдущий-следующий если она есть
//  соседние ID ищутся по actual индексу 

MapWithMarkerListClass.prototype.MapAddress_RoutePublish = function (addr_id) {
  this.log_heading4('MapAddress_RoutePublish addr_id['+addr_id+']');
  
  var prev_id = this.AddressIndex_getPrevId(addr_id, 'actual');
  var next_id = this.AddressIndex_getNextId(addr_id, 'actual');
  
  //this.log(this.Address_debug_Id_ToStrMin(addr_id) + this.Address_debug_Id_ToStrMin(prev_id) + this.Address_debug_Id_ToStrMin(next_id));
  

  //удалить линию предыдущий-следующий если она есть
  this.MapRoute_RemoveFromTo(prev_id, next_id);
  
  //добавить две линии от заданного ID до соседних
  this.MapRoute_PublishFromTo(prev_id, addr_id);
  this.MapRoute_PublishFromTo(addr_id, next_id);
  
};

//удаление линий маршрута по одному ID. 
//нетривиально т.к. 
//+ удалить нужно две линии
//+ после удаления необходимо создать новую линию между предыдущим и следующим адресом

MapWithMarkerListClass.prototype.MapAddress_RouteRemove = function (addr_id) {
  this.log_heading4('MapAddress_RouteRemove addr_id['+addr_id+']');

  var addr = this.address_list[addr_id];
  var prev = addr.map_routes.prev;
  var next = addr.map_routes.next;

  //this.log(this.Address_debug_Id_ToStrMin(addr_id) + this.Address_debug_Id_ToStrMin(prev.addr_id) + this.Address_debug_Id_ToStrMin(next.addr_id));

  //удалить две линии до предыдущего и следующего адресов
  this.MapRoute_RemoveFromToObjects(prev.addr, addr);
  this.MapRoute_RemoveFromToObjects(addr, next.addr);
  
  //создать новую линию между предыдущим и следующим адресом
  this.MapRoute_PublishFromTo(prev.addr_id, next.addr_id);
  
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

//нарисовать линию маршрута по паре ID
MapWithMarkerListClass.prototype.MapRoute_PublishFromTo = function (from_id, to_id) {
  this.log_heading5('MapRoute_PublishFromTo. from_id['+from_id+'] to_id['+to_id+']');
  this.log(this.Address_debug_Id_ToStrMin(from_id) + this.Address_debug_Id_ToStrMin(to_id));
  
  var from = this.address_list[from_id];
  var to = this.address_list[to_id];
  
  if (this.Address_hasLatLng(from) && this.Address_hasLatLng(to)) {
    var polyline = this.MapRoute_PublishFromToObjects(from, to);
    
    from.map_routes.next.line = polyline;
    from.map_routes.next.addr_id = to_id;
    from.map_routes.next.addr = to;
    
    to.map_routes.prev.line = polyline;
    to.map_routes.prev.addr_id = from_id;
    to.map_routes.prev.addr = from;
  } else {
    var msg = 'can not draw a line. ';
    msg += 'from_id['+from_id+'] to_id['+to_id+']';
    this.log(msg);
  }
};
//нарисовать линию маршрута по паре адресов - объектов модели
MapWithMarkerListClass.prototype.MapRoute_PublishFromToObjects = function (from, to) {
  //this.log_heading5('MapRoute_PublishFromToObjects');
  
  var polyline = L.polyline(
    [[from.lat, from.lng], [to.lat, to.lng]],
    this.C.Map.route.options_straight
  );
  this.MapLine_Append(polyline);
  
  return polyline;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

//удалить линию между парой адресов по ID
MapWithMarkerListClass.prototype.MapRoute_RemoveFromTo = function (from_id, to_id) {
  this.log_heading5('MapRoute_RemoveFromTo. from_id['+from_id+'] to_id['+to_id+']');
  this.log(this.Address_debug_Id_ToStrMin(from_id) + this.Address_debug_Id_ToStrMin(to_id));
  
  var from = this.address_list[from_id];
  var to = this.address_list[to_id];
  this.MapRoute_RemoveFromToObjects(from, to);
};
//удалить линию между парой адресов по объектам модели
MapWithMarkerListClass.prototype.MapRoute_RemoveFromToObjects = function (from, to) {
  this.log_heading5('MapRoute_RemoveFromToObjects');
  
  if (from && to && from.map_routes.next.line && to.map_routes.prev.line) {
    if (from.map_routes.next.line == to.map_routes.prev.line) {
      this.MapLine_Remove(from.map_routes.next.line);
      from.map_routes.next = {};
      to.map_routes.prev = {};
    } else {
      this.log('warning: line from<->to not match');
      this.log('from.title['+from.title+']');
      this.log('prev= '+this.Address_debug_Id_ToStrMin(from.map_routes.prev.addr_id));
      this.log('next= '+this.Address_debug_Id_ToStrMin(from.map_routes.next.addr_id));
      this.log('to.title['+to.title+']');
      this.log('prev= '+this.Address_debug_Id_ToStrMin(to.map_routes.prev.addr_id));
      this.log('next= '+this.Address_debug_Id_ToStrMin(to.map_routes.next.addr_id));
      //this.log('from.map_routes.next.line['+this.Map_debug_Line_getId(from.map_routes.next.line)+']');
      //this.log('to.map_routes.prev.line['+this.Map_debug_Line_getId(to.map_routes.prev.line)+']');
    }
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

//карта. добавить линию
MapWithMarkerListClass.prototype.MapLine_Append = function (polyline) {
  //this.log_heading6('MapLine_Append');
  
  polyline.addTo(this.map_obj);
  //ID become valid only after .addTo()
  //this.log('polyline.id['+this.Map_debug_Line_getId(polyline)+']');
  
  this.polylines_pool.push(polyline);
};

//карта. удалить линию
MapWithMarkerListClass.prototype.MapLine_Remove = function (polyline) {
  //this.log_heading6('MapLine_Remove');

  if (polyline) {
    //this.log('polyline.id['+this.Map_debug_Line_getId(polyline)+']');
    
    //удалить из глобального списка
    var i = this.polylines_pool.indexOf(polyline);
    this.polylines_pool.splice(i, 1);
    
    //удалить с карты
    polyline.remove();
  }
};

//карта. удалить все ранее нарисованные линии
MapWithMarkerListClass.prototype.MapLine_AllRemove = function () {
  this.log_heading5('MapLine_AllRemove');
  
  //удалить с карты
  for (var i = 0; i < this.polylines_pool.length; i++) {
    this.log('i['+i+'] polylines_pool[i].id['+this.Map_debug_Line_getId(this.polylines_pool[i])+']');
    this.polylines_pool[i].remove();
  }

  //очистить список. должно быть именно [], не '= null' т.к. весь остальной код предполагает polylines_pool = [...]
  this.polylines_pool = [];
};

MapWithMarkerListClass.prototype.Map_debug_Line_getId = function (polyline) {
  return polyline ? polyline._leaflet_id : null;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Маршруты реальные - готовое решение leaflet-routing-machine
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//codename = MapRoutingLib

MapWithMarkerListClass.prototype.MapRoutingLib_AllPublish = function () {
  this.log_heading3('MapRoutingLib_AllPublish');
  
  var waypoints = [];
  
  var id_lst = this.AddressIndex_getList('actual');
  for (var i = 0; i < id_lst.length; i++) {
    var id = id_lst[i];
    var addr = this.address_list[id];
    waypoints.push(L.latLng(addr.lat, addr.lng));
  }
  
  this.MapRoutingLib_NeedObject(waypoints);
  //i am not sure 
  //this.LeafletRoutingMachine.route();
};

MapWithMarkerListClass.prototype.MapRoutingLib_NeedObject = function (waypoints) {
  if (this.LeafletRoutingMachine) {
    this.LeafletRoutingMachine.setWaypoints(waypoints);
  } else {
    //if plugin not instatiated yet - instatiate it
    this.LeafletRoutingMachine = L.Routing.control({
      waypoints: waypoints,
      routeWhileDragging: false,
      suppressDemoServerWarning: true,
      createMarker: this.MapRoutingLib_createMarker.bind(this)
    }).addTo(this.map_obj);
    
    //attach event listeners
    this.LeafletRoutingMachine.on('routingerror', this.MapRoutingLib_onError.bind(this));
 
    //hide the overlaid list of route intermediate points
    this.LeafletRoutingMachine.hide();

    //=object with serviceUrl = https://router.project-osrm.org/route/v1
    //this.log('LeafletRoutingMachine.getRouter()');
    //this.log(this.LeafletRoutingMachine.getRouter());
    
    //=undefined
    //this.log('LeafletRoutingMachine.getRouter().serviceUrl['+this.LeafletRoutingMachine.getRouter().serviceUrl+']');
  }
};

MapWithMarkerListClass.prototype.MapRoutingLib_onError = function (error) {
  this.log_heading3('MapRoutingLib_onError');

  this.log('Error argument');
  this.log(myUtils.Object_toStringPretty(error));
  
  if (this.onError) {
    this.onError('leaflet-routing-machine Error');
  }
};

MapWithMarkerListClass.prototype.MapRoutingLib_AllRemove = function () {
  this.log_heading3('MapRoutingLib_AllRemove');
  
  if (this.LeafletRoutingMachine) {
    //this.LeafletRoutingMachine.remove();//too rough
    this.LeafletRoutingMachine.setWaypoints([]);
  }
};

//createMarker 	Function 	
//Creates a marker to use for a waypoint. 
//The function should have the signature 
//createMarker(<Number> i, <L.Routing.Waypoint> waypoint, <Number> n), 
//where i is the waypoint’s index, waypoint is the waypoint itself, 
//and n is the total number of waypoints in the plan; 
//if return value is falsy, no marker is added for the waypoint
//
//note: i is zero-based

MapWithMarkerListClass.prototype.MapRoutingLib_createMarker = function (i, waypoint) {
  this.log_heading4('MapRoutingLib_createMarker');
  
  var addr_id = this.AddressIndex_getList('actual')[i];
  var addr = this.address_list[addr_id];
  var icon_color = this.C.Map.marker.icon.color.default;
  
  //создать маркер для адреса
  var icons_pool = this.map_icons_pool[icon_color];
  var mrk = L.marker(waypoint.latLng, {icon: icons_pool[addr.label_idx], draggable: false});
  
  //создать взаимные ссылки адрес - маркер
  addr.map_marker = mrk;
  mrk.addr_id = addr_id;
  
  //маркер. добавить UI обработчики
  mrk.on('click', this.map_marker_onClick.bind(this));
  
  //маркер. название
  mrk.bindTooltip(String(addr.title), {}).openTooltip();//tooltip = address
  //mrk.bindPopup(addr.title);
  
  if (this.map_options.marker.on_publish.pan) {
    //прокрутить вид карты к расположению нового маркера
    this.MapAddress_PanTo(addr);
  }
  
  return mrk;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Маршруты реальные - нативное решение
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//codename = MapRouteReal

//реальный маршрут. нарисовать
/*
--sample JSON

  "route":{
    "overview_polyline":"gkylJ_``xDkAdRGPMHo@Ia@OcAUe@?[PwAfCeClEaClE[k@Uk@w@uC_Ka`@WmAoBuHe@kBq@kDiAyFZa@zCiDt@o@nB_C~@{AnBuCLQb@kAJs@Bg@b@cLP_E?W?WxDjAtInCvBn@fCp@pGpB\JDm@|@eQrBk]t@iLBk@`Ct@~DrA`@XjAb@xA`@XyC~HtC|Aj@LJIZE|@H|@JZLPNFNARILQJYF]@cAE_@I[NWH_@~@yD|Lfc@fF|QhCdKlB~GdCdInGvU~@xD`@fBZ~BvBjObDjUxB~N`BvLvIbm@`CrP`BjLLjA?bAK|G]dTU~Sa@pWEpGnHdDnFjCnKhFfAd@xGdDpBfAb@Pj@R^C~FgBr@Yv@c@n@g@z@q@Rp@lAbE`@lA^t@TTJFd@NxHbAvAN|Cf@l@J?P@`@Jl@R^LFX?PIb@g@~CsDlBoBbB}AhGuEXOTCd@BpDj@|Ex@zAR`F|@\NTN`C`C|I`Jh@b@fCpCvAxA~GbHpGnGpCvCdA~@rAnAdAjA~K|KbSdSbDhDrGdHlA`AxAtAL`@F`@Ab@BdAN|@Zn@RPLH\@XIZ]Na@Lg@D_@@}Ad@}@PGxJqBlCa@dGwAbI{AtFy@`KqBrHyA|AKbA@^BhATp@Vt@ZtAz@xArApAbBpB`DjAxBjCvF~BvFzExKtDnJbDxI|BrGhEzMtE|NxArFtCtKzCpKf@hBV^jEtNnDfLxBhI`BtGfCpLPz@nAbJ~A`MdCdPfA`Hz@nGXdEz@lRThH?|@fDrFhK~PlGjKrJ|NnQbXpUt]GzjAfFE@oB?m@cBEAcFu@?SjKy@@?jE@pQ?pO?zD?{D?qOA{Jx@??T",
    "points_gps":[
      {
      "lat":59.93668,
      "lng":30.31568
      },
      {
      "lat":59.93706,
      "lng":30.31261
      }
    ]
  },
*/
MapWithMarkerListClass.prototype.MapRouteReal_AllPublish = function () {
  this.log_heading3('MapRouteReal_AllPublish');
  
  var encoded = this.route_data.json ? this.route_data.json.route.overview_polyline : null;
  var points_arr = this.route_data.json ? this.route_data.json.route.points_gps : null;

  //delete the existing Route if any
  this.MapRouteReal_AllRemove();
  
  //----- draw a new route

  //-- from points_gps. works
  if (points_arr) {
    var waypoints = [];
    for (var i = 0; i < points_arr.length; i++) {
      var wp = points_arr[i];
      waypoints.push([wp.lat, wp.lng]);
    }
    this.route_data.polyline = L.polyline(waypoints, this.C.Map.route.options_actual);
  } else {
    this.route_data.polyline = null;
  }
  
  
  //-- from encoded polyline. this is possible with leaflet.encoded plugin
  //!!! showstopper bug found in the Encoded: the sequence is severely corrupted at some point
  //this is revealed in the official validator
  //the backslash '\' should be escaped like this '\' -> '\\'
  if (encoded) {
    //minor bug in the Encoded: the last element in the Decoded array always have lng = null
    var decoded = L.PolylineUtil.decode(encoded.replace('\\', '\\\\'), 5);
    //this.log('decoded');
    //this.log(decoded);

    //very rough test. draw only some points
    var polyline = L.polyline(decoded.slice(0, Math.round(decoded.length / 3)), this.C.Map.route.options_xperimental);

    //draw all points. //not works :(
    //TypeError: t is null leaflet.js:5:79982
    //var polyline = L.polyline(decoded.pop());

    //Error: Invalid LatLng object: (60.6082, NaN) leaflet.js:5:6614
    //var polyline = L.polyline(L.PolylineUtil.decode(encoded.replace('\\', '\\\\'), 5));//not works :(

    //Error: Invalid LatLng object: (60.6082, NaN) leaflet.js:5:6614
    //var polyline = L.Polyline.fromEncoded(encoded.replace('\\', '\\\\'));//not works :(
    
    //draw the Decoded. currently disabled due to buggy Encoded
    //this.route_data.polyline_xperimental = polyline;
    //polyline.addTo(this.map_obj);
  } else {
    this.route_data.polyline_xperimental = null;
  }
  
  //this better draw last
  if (this.route_data.polyline) {
    this.route_data.polyline.addTo(this.map_obj);
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//реальный маршрут. убрать с карты

MapWithMarkerListClass.prototype.MapRouteReal_AllRemove = function () {
  this.log_heading3('MapRouteReal_AllRemove');
  
  //delete the existing Route if any
  if (this.route_data.polyline) {
    this.route_data.polyline.remove();
  }
  if (this.route_data.polyline_xperimental) {
    this.route_data.polyline_xperimental.remove();
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//реальный маршрут. присутствует ли он? 
//например чтобы рисовать прямые линии если отсутствует
MapWithMarkerListClass.prototype.MapRouteReal_isAvailable = function () {
  return (this.route_data.json ? true : false);
};

//реальный маршрут. более недействителен
MapWithMarkerListClass.prototype.MapRouteReal_AllInvalidate = function () {
  this.log_heading3('MapRouteReal_AllInvalidate');
  
  this.MapRouteReal_AllRemove();
  this.route_data.json = null;
};

//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype._static_properties_init = function () {
  this.log('MapWithMarkerListClass._static_properties_init');
  
  //авто-увеличивающийся ID для эл-тов списка адресов
  //начальное значение большое чтобы не спутать с порядковым номером эл-та в списке
  //этот механизм работает для всех адресов но только в пределах UI
  //для методов back-end используется .db_id
  var af = this.C.address_factory = {};
  af.id_num = 1000;
  af.id_prefix = 'address-';

  //Map constants 
  var map = this.C.Map = {};
  var marker = map.marker = {};
  var icon = marker.icon = {};
  var color = icon.color = {};
  color.default = 'blue';
  color.active = 'yellow';
  
  //задержка желательно = времени анимации эл-та списка на странице
  marker.click_animaiton_delay = 2000;

  var route = map.route = {};
  var opts = route.options_straight = {};
  opts.color = 'red';
  opts.weight = 2;
  var opts = route.options_actual = {};
  opts.color = 'red';//customer's requirement
  //opts.color = 'fuchsia';
  opts.weight = 4;//customer's requirement
  var opts = route.options_xperimental = {};
  opts.color = 'dodgerblue';
  opts.weight = 2;
  
  //Drag-and-Drop constants 
  //var dnd = this.C.DragAndDrop = {};
  
  //BackEnd constants
  this.C.unique_id_timeout_delay = 200;

  //AddressList constants
  var addr_lst = this.C.address_list = {};
  var label = addr_lst.label = {};
  label.idx_base = 1;
};

//-----------------------------------------------------------------------------
//для отладки. добавить несколько маркеров
//-----------------------------------------------------------------------------

MapWithMarkerListClass.test_address_sets = {
//!!! incomplete !!!
  'Peterburg-objects': {
    latlng: [59.939095,30.315868],
    type: 'objects',
    addr_set_a: [
      {lat: 51.5006728, lng: -0.1244324, title: "Петергоф, Санкт-Петербург, Россия"},
      {lat: 51.5006728, lng: -0.1244324, title: "Сестрорецк, Санкт-Петербург, Россия"},
      {lat: 51.5006728, lng: -0.1244324, title: "посёлок городского типа Токсово, Всеволожский район, Ленинградская область, Россия"},
      {lat: 51.5006728, lng: -0.1244324, title: "Отрадное, Кировский район, Ленинградская область, Россия"},
      {lat: 51.5006728, lng: -0.1244324, title: "посёлок Шушары, Пушкинский район, Санкт-Петербург, Россия"}
    ]
  }
  ,

  'PeterburgScroll': {
    latlng: [59.939095,30.315868],
    type: 'strings',
    addr_set_a: [
      'Невский проспект, 3, Санкт-Петербург, Россия',
      'Невский проспект, 5, Санкт-Петербург, Россия',
      'Невский проспект, 17, Санкт-Петербург, Россия',
      'Невский проспект, 19, Санкт-Петербург, Россия',
      'Невский проспект, 21, Санкт-Петербург, Россия',
      'Невский проспект, 23, Санкт-Петербург, Россия',
      'Невский проспект, 25, Санкт-Петербург, Россия',
      'Невский проспект, 27, Санкт-Петербург, Россия',
      'Невский проспект, 33, Санкт-Петербург, Россия',
      'Невский проспект, 51, Санкт-Петербург, Россия',
      'Невский проспект, 53, Санкт-Петербург, Россия',
      'Невский проспект, 55, Санкт-Петербург, Россия',
      'Невский проспект, 57, Санкт-Петербург, Россия',
      'Невский проспект, 59, Санкт-Петербург, Россия',
      'Невский проспект, 61, Санкт-Петербург, Россия',
      'Невский проспект, 63, Санкт-Петербург, Россия',
      'Невский проспект, 65, Санкт-Петербург, Россия',
      'Невский проспект, 67, Санкт-Петербург, Россия',
      'Невский проспект, 69, Санкт-Петербург, Россия',
      'Невский проспект, 71, Санкт-Петербург, Россия',
      'Невский проспект, 77, Санкт-Петербург, Россия',
      'Невский проспект, 79, Санкт-Петербург, Россия',
      'Невский проспект, 81, Санкт-Петербург, Россия',
      'Невский проспект, 83, Санкт-Петербург, Россия',
      'Невский проспект, 91, Санкт-Петербург, Россия'
    ]
  }
  ,
  
  'Peterburg': {
    latlng: [59.939095,30.315868],
    type: 'strings',
    addr_set_a: [
      'Сестрорецк, Санкт-Петербург, Россия',
      'посёлок городского типа Токсово, Всеволожский район, Ленинградская область, Россия',
      'Отрадное, Кировский район, Ленинградская область, Россия',
      'посёлок Шушары, Пушкинский район, Санкт-Петербург, Россия',
      'Петергоф, Санкт-Петербург, Россия'
    ]
  }
  ,
  
  'Moscow': {
    latlng: [55.755814,37.617635],
    type: 'strings',
    addr_set_a: [
      'микрорайон Сходня, Химки, Московская область, Россия',
      'Долгопрудный, Московская область, Россия',
      'район Чертаново Северное, Южный административный округ, Москва, Россия',
      'Реутов, Московская область, Россия'
    ]
  }
  ,
  
  'London': {
    latlng: [51.5056,-0.1213],
    zoom: 14,
    type: 'objects',
    addr_set_a: [
      {lat: 51.5006728, lng: -0.1244324, title: "Big Ben"},
      {lat: 51.503308, lng: -0.119623, title: "London Eye"},
      {lat: 51.5077286, lng: -0.1279688, title: "Nelson's Column"},
    	//{lat: 51.5077286, lng: -0.1279688, title: "Nelson's Column", popup: "<br><a href=\"https://en.wikipedia.org/wiki/Nelson's_Column\">wp</a>"},
      {lat: 51.523011, lng: -0.124183, title: "Russel Square"},
      {lat: 51.499048, lng: -0.1334, title: "St. James's Park tube station, Circle Line, London, United Kingdom"}
    ]
  }
  ,
  add_delay: 2000,
  finalization_timeout: 3
};

MapWithMarkerListClass.prototype.test_AddSeveralMarkersD = function (loc_name) {
  this.PageAddressList_Remove();
  
  this.test_address_add = {state: 'init'};
  var location = this.test_address_add.location = this.C.test_address_sets[loc_name];
  this.test_address_add.addr_set = location.addr_set_a;
  
  var latlng = new L.LatLng(location.latlng[0], location.latlng[1]); 
  this.map_obj.setView(latlng, location.zoom || this.map_options.zoom_default);
  
  //console.clear();
  this.log_heading1('start timer...');
  this.test_address_add.timer = window.setInterval(
    this.test_AddressFill_engine.bind(this), this.C.test_address_sets.add_delay
  );
};

MapWithMarkerListClass.prototype.test_AddressFill_engine = function () {
  var a = this.test_address_add;
  this.log_heading1('timer tick. state['+a.state+']');
  
  switch (a.state) {
    case 'init':
      a.index = 0;
      a.state = (a.location.type == 'strings') ? 'add_string' : 'add_object';
      if (a.location.type == 'objects') {
        a.addr_set_keys = Object.keys(a.addr_set);
        a.addr_id_idx = 10000;
      }
      break;
      
    case 'add_string':
      this.Address_AppendFromString(a.addr_set[a.index]);
      a.index++;
      
      if (a.index >= a.addr_set.length) {
        a.state = 'finalize';
      }
      break;

    case 'add_object':
      var addr = a.addr_set[a.addr_set_keys[a.index]];
      this.test_AddMarker(addr.lat, addr.lng, addr.title, 'test-' + a.addr_id_idx);
      a.index++;
      a.addr_id_idx++;
      if (a.index >= a.addr_set_keys.length) {
        a.state = 'finalize';
      }
      break;
      
    case 'finalize':
      //console.clear();
      a.state = 'wait_all_latlng';
      a.finalization_tmr = 0;
      break;
      
    case 'wait_all_latlng':
      a.finalization_tmr++;
      var timeout = a.finalization_tmr >= this.C.test_address_sets.finalization_timeout;
      if (this.AddressList_AllHas_LatLng() || timeout) {
      
        
        window.clearInterval(a.timer);
      }
      if (!timeout) {
        this.log('test: finished normally');
        if (this.test_ListFillFinish_callback) {
          this.test_ListFillFinish_callback();
        }
      } else {
        this.log('test: finished by timeout');
      }
      break;
      
  }
};

MapWithMarkerListClass.prototype.test_AddMarker = function (lat, lng, addr_str, addr_id) {
  //hackish method
  
  //first, prepare geocode results as if they are pre-fetched
  this.geocode_accelerator.wait_for = addr_str;
  this.geocode_accelerator.json = {
    "lat": lat,
    "lng": lng,
    "address_md": addr_id,
    "result": 1
  };
  
  //simulate user adding address string
  this.Address_AppendFromString(addr_str);
  
  //old
  //this.Backend_Geocode_onFulfill( addr_str, {   lat: lat,   lng: lng   } );
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//=============================================================================
