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
  
  this.back_end = options.back_end;
  
  //--- Карта. ключевой объект на странице
  //опции отображения карты
  this.map_options = {
    zoom_default: options.map.zoom_default,
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
  //вызывается при ошибках LeafletRoutingMachine
  //в будущем возможно будет вызываться при других ошибках
  this.onError = null;
  
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
  }
  
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
  //Application.MapWithMarkerList.addr_id_list
  //Application.MapWithMarkerList.addr_id_list_shadow
  this.addr_id_list = [];
  this.addr_id_list_shadow = null;
  
  //--- вспомогательная структура данных для ускорения backend.geocode 
  this.geocode_accelerator = {};
  
}

MapWithMarkerListClass.prototype = new GenericBaseClass();//inherit from
MapWithMarkerListClass.prototype.SuperClass = GenericBaseClass.prototype;

//авто-увеличивающийся ID для эл-тов списка адресов
//начальное значение большое чтобы не спутать с порядковым номером эл-та в списке
//этот механизм работает только для адресов добавленных без использования BackEnd.geocode

MapWithMarkerListClass.address_id_to_assign = 1000;

//-----------------------------------------------------------------------------
//Добавить Адрес вручную
//-----------------------------------------------------------------------------
/*
ранее добавление адреса выполнялось только после завершения backend.geocode
когда все данные Адреса - и для карты и для страницы готовы

но потребовалось ускорить процесс

для ускорения 

+ на страницу Адрес добавляется сразу, на карту- после завершения backend.geocode 
  если backend.geocode завершён неудачно - Адрес должен быть удалён со страницы
  
+ backend.geocode теперь может запускаться заранее, до добавления адреса
  в момент когда пользователь делает выбор из списка предположений
  
TODO
check if this addr string is already present in the list

*/
MapWithMarkerListClass.prototype.Address_AppendFromString = function (addr_str) {
  this.log_heading2('Address_AppendFromString');
  
  //защита от повторных кликов кнопки Добавить
  //сейчас эта защита не актуальна т.к. поле ввода очищается сразу после вызова данного метода
  //но оставлена для красоты
  if (this.addr_str_to_add_shadow != addr_str && addr_str && addr_str.length) {
    this.log('addr_str ['+addr_str+']');
    
    //защита от добавления дубля
    if (!this.AddressList_findId_byTitle(addr_str)) {

      //this.AddressList_debug_Dump();

      //информировать приложение что ссылка недействительна
      this.LinkToShare_Set(null);
      
      //Модель. добавить адрес
      //добавить неполные данные которые будут дополнены после завершения Backend.Geocode
      //ID будет назначен временный, при помощи fall-back механизма
      var addr_id = this.Address_AddFromLatLng(0, 0, addr_str);
      this.log('temporary addr_id assigned ['+addr_id+']');
      //отметить что этот адрес полу-готовый чтобы к нему например не создавались линии на карте
      this.address_list[addr_id].incomplete = true;

      //вспомогательный список. добавить ID 
      this.AddressList_Append(addr_id, 'actual');
      
      //Список на Странице. добавить адрес
      this.PageAddress_Publish(addr_id);
      
      //проверить выполнилось ли ускоренное получение результата backend.geocode 
      //или возможно ещё не выполнилось но было запущено
      if (addr_str == this.geocode_accelerator.wait_for) {
        //если результаты backend.geocode готовы то сразу дополнить полу-готовый адрес
        if (this.geocode_accelerator.json) {
          this.log('feeling lucky! the GeoCode result is already available');
          //трюк. имитируется завершение backend.geocode 
          this.Backend_Geocode_onFulfill(addr_id, this.geocode_accelerator.json);
        } else {
          //ускоренное получение результата backend.geocode 
          //было запущено но пока ещё не выполнилось
          //отметить что нужен вызов 
          //Backend_Geocode_onFulfill \ Backend_Geocode_onReject после завершения
          this.geocode_accelerator.addr_id = addr_id;
          this.geocode_accelerator.call_settle_on_finish = true;
        }
      } else {
        //backend.geocode - старт
        this.back_end.XHR_Start(
          this.back_end.AddressGeocode, 
          {address: addr_str}, 
          this.Backend_Geocode_onFulfill.bind(this, addr_id),
          this.Backend_Geocode_onReject.bind(this, addr_id)
        )
      }
    } else {
      this.log('ignored. address already exists');
    }
    this.addr_str_to_add_shadow = addr_str;
    
  } else {
    this.log('ignored. input data is either empty or looks the same as the previous one');
  }
};

//дополнить адрес из структуры данных возвращённой из BackEnd
//TODO
//check if this addr_id is already present in the list
MapWithMarkerListClass.prototype.Backend_Geocode_onFulfill = function (addr_id_tmp, json) {
  this.log_heading2('Backend_Geocode_onFulfill addr_id_tmp['+addr_id_tmp+']');

  this.log('json');
  this.log(json);

  //this.AddressList_debug_Dump();
  
  //Модель. дополнить данные. ID при этом заменяется
  //TODO: return not ID but status 'ok' 'duplicate' 'not_found' etc...
  var addr_id = this.Address_merge_GeoCode(addr_id_tmp, json.address_md, json.lat, json.lng);
  
  if (addr_id) {
    var addr = this.address_list[addr_id];

    //вспомогательный список. заменить ID
    this.AddressList_Replace(addr_id_tmp, addr_id, 'actual');
    
    //Список на Странице. обновить ID
    this.PageAddress_setId(this.address_list[addr_id].page_element, addr_id);
    
    //отметить адрес как полностью сформированный
    //должно быть до добавления линий
    delete this.address_list[addr_id].incomplete;
    
    //карта. добавить адрес
    this.MapUpdate_AddressAppend(addr_id);
    
    //this.AddressList_debug_Dump();
    
    //this.Map_debug_Route_AllDump();
    
    this.AddressList_AfterChange();
  } else {
    //адрес не найден по addr_id_tmp
    this.log('Warning: address not found by addr_id_tmp['+addr_id_tmp+']');
    //удалить полу-готовый адрес
    this.Backend_Geocode_onReject(addr_id_tmp);
  }
}

//backend.geocode завершён неудачно
//удалить полу-готовый адрес
//
//возможно адрес был удалён вручную(например) пока выполнялся запрос к backEnd
//это значит что удалять полу-готовый адрес необходимо мягко,
//проверяя сначала его наличие
MapWithMarkerListClass.prototype.Backend_Geocode_onReject = function (addr_id_tmp) {
  this.log_heading2('Backend_Geocode_onReject addr_id_tmp['+addr_id_tmp+']');

  //Список на Странице. удалить из
  //  особый случай. объект возможно уже удалён из модели данных
  //  по этой причине нельзя использовать обычное удаление по объекту addr
  this.PageAddress_FindByIdAndRemove(addr_id_tmp);

  //вспомогательный список. удалить ID
  if (this.AddressList_getIdList_byWhere('actual').includes(addr_id_tmp)) {
    this.AddressList_Remove(addr_id_tmp, 'actual');
  }

  //Модель. удалить
  if (this.address_list[addr_id_tmp]) {
    delete this.address_list[addr_id_tmp];
  }
  
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//ускорение backend.geocode 
//  может запускаться заранее, до добавления адреса
//  в момент когда пользователь делает выбор из списка предположений
//
//addr_str служит уникальным идентификатором запроса к backEnd
//благодаря этому идентификатору
//если будет одновремено несколько запросов 
//то результат выполнения будет учтён только у последнего из запущеных запросов

MapWithMarkerListClass.prototype.Address_Append_earlyPeek = function (addr_str) {
  this.log_heading2('Address_Append_earlyPeek');
  this.log('addr_str ['+addr_str+']');

  this.geocode_accelerator = {wait_for: addr_str};
  //json=null означает что запрос ещё не завершён
  this.geocode_accelerator.json = null;

  //backend.geocode - старт
  this.back_end.XHR_Start(
    this.back_end.AddressGeocode, 
    {address: addr_str}, 
    this.Backend_Geocode_earlyPeek_onFulfill.bind(this, addr_str),
    this.Backend_Geocode_earlyPeek_onReject.bind(this, addr_str)
  )
};

//сохранить структуру данных возвращённую из BackEnd
MapWithMarkerListClass.prototype.Backend_Geocode_earlyPeek_onFulfill = function (addr_str, json) {
  this.log_heading2('Backend_Geocode_earlyPeek_onFulfill');
  
  this.log('json');
  this.log(json);

  if (addr_str == this.geocode_accelerator.wait_for) {
    this.geocode_accelerator.json = json;
    if (this.geocode_accelerator.call_settle_on_finish) {
      this.Backend_Geocode_onFulfill(this.geocode_accelerator.addr_id, json);
    }
  }
};

//backend.geocode завершён неудачно
//
//в каком случае может быть вызван этот обработчик. последовательность событий
//
//+ Address_Append_earlyPeek. [addr_str] remembered, XHR_Start back_end.AddressGeocode
//+ Address_AppendFromString. [addr_id_tmp] assigned, geocode_accelerator.call_settle_on_finish = true
//+ back_end.AddressGeocode Failed. the whole Append should be rolled back

MapWithMarkerListClass.prototype.Backend_Geocode_earlyPeek_onReject = function (addr_str) {
  this.log_heading2('Backend_Geocode_earlyPeek_onReject');

  if (addr_str == this.geocode_accelerator.wait_for) {
    if (this.geocode_accelerator.call_settle_on_finish) {
      this.Backend_Geocode_onReject(this.geocode_accelerator.addr_id);
    }
  }
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

/*
TODO: integrate this

  //if dragged is an Address, indicate this on the map
  if (dnd.current.dragged.classList.contains('address')) {
    var addr = this.PageAddress_getAddrObj(dnd.current.dragged);
    this.MapAddress_setState(addr, 'active');
    this.MapAddress_PanTo(addr);
    //animation Will restart on each Node remove\append. stop the animaiton to prevent restarts
    //animation might be in progress if the corresponding marker is clicked shortly before
    this.PageAddress_AnimationStop(addr);
  }
  
*/

/*
TODO: 

  this.onDrop = null;


TODO: integrate this

  //if dragged is an Address, indicate this on the map
  if (dnd.current.dragged.classList.contains('address')) {
    var addr = this.PageAddress_getAddrObj(dnd.current.dragged);
    this.MapAddress_setState(addr, 'default');
  }
    

*/

MapWithMarkerListClass.prototype.Addresses_ItemMoved = function (element) {
  this.log_heading2('Addresses_ItemMoved');
  
  //проверить изменился ли порядок эл-тов
  //бывает что эл-т был перемещён в ту-же самую позицию
  this.addr_id_list = this.PageAddressList_getIdArray();
  if (!this.AddressList_ActualEqualShadow()) {
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
  
  var address_list_joined = this.PageAddressList_getIdArray().join(',');
  
  //защита от повторных кликов кнпоки Оптимизировать
  if (this.address_lst_to_optimize_shadow != address_list_joined && address_list_joined.length) {
    this.log('address_list_joined ['+address_list_joined+']');
    
    //информировать приложение что ссылка недействительна
    this.LinkToShare_Set(null);
    
    //запустить сортировку списка адресов. процесс включает в себя promise resolve
    //по завершении будет сформирована новая ссылка
    var query = {address: address_list_joined};
    this.Query_includeListUID(query);
    
    this.back_end.XHR_Start(
      this.back_end.DistributionAddress, 
      query, 
      this.Backend_OptimizeRoute_onFulfill.bind(this)
    )
    
    this.address_lst_to_optimize_shadow = address_list_joined;
  } else {
    this.log('ignored. input data looks the same as previous one');
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
  //this.debug_addr_id_list_pair_compare(this.addr_id_list_shadow, json.address);

  this.route_data.json = json;
  this.MapRoute_Render();
  
  //карта. удалить
  this.MapUpdate_AllSortBefore();
  
  //пере-сортировать список адресов
  this.PageAddressList_ReorderByIdAssociativeArray(json.address);
  
  //перенумеровать список адресов
  this.AddressList_LabelsRefresh();
  
  //карта. добавить 
  this.MapUpdate_AllSortAfter();
  
  //md_list из json будет сохранён
  this.AddressList_AfterChange(json);
};

//обновить состояние кнопки Оптимизировать
MapWithMarkerListClass.prototype.route_optimize_btn_state_update = function () {
  //должно быть как минимум 2 адреса чтобы был маршрут
  //не исключено что Оптимизировать имеет смысл только если имеется 3 адреса
  this.route_optimize_btn.disabled = this.address_list_html.childNodes.length < 2;
};

//реальный маршрут. нативное решение. нарисовать
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
MapWithMarkerListClass.prototype.MapRoute_Render = function () {
  var encoded = this.route_data.json.route.overview_polyline;
  var points_arr = this.route_data.json.route.points_gps;

  //delete the existing Route if any
  if (this.route_data.polyline) {
    this.route_data.polyline.remove();
  }
  if (this.route_data.polyline_xperimental) {
    this.route_data.polyline_xperimental.remove();
  }
  
  //----- draw a new route

  //-- from points_gps. works
  var waypoints = [];
  for (var i = 0; i < points_arr.length; i++) {
    var wp = points_arr[i];
    waypoints.push([wp.lat, wp.lng]);
  }
  this.route_data.polyline = L.polyline(waypoints, this.C.Map.route.options_actual);
  
  //-- from encoded polyline. this is possible with leaflet.encoded plugin
  //the backslash '\' should be escaped like this '\' -> '\\'

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
  
  this.route_data.polyline_xperimental = polyline;
  polyline.addTo(this.map_obj);
  
  //this better draw last
  this.route_data.polyline.addTo(this.map_obj);
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

MapWithMarkerListClass.prototype.Address_AddFromLatLng = function (lat, lng, title, addr_id, label_idx) {
  //this.log('Address_AddFromLatLng lat lng['+lat+']['+lng+'] title['+title+']');
  
  addr_id = addr_id || 'address-' + this.C.address_id_to_assign;
  label_idx = label_idx || Object.keys(this.address_list).length;
  
  if (this.address_list[addr_id]) {
    throw 'addr_id ['+addr_id+'] already exists'
  }
  
  var addr = {
    lat: lat,
    lng: lng,
    label_idx: label_idx, 
    title: title,
    //Map refs
    map_marker: null,
    map_routes: {prev: {}, next: {}},
    //Page refs
    page_element: null
  };
  
  this.address_list[addr_id] = addr;
  
  this.C.address_id_to_assign++;

  //this.log('addr_id=['+addr_id+']');
  //this.log(addr);
  
  return addr_id;
};

//дополнить незавершённый адрес результатом выполнения backend.geocode 
//
//нетривиально - необходимо присвоить новый ID
//
//при этом учесть что 
//- такой ID может уже существовать. такое возможно если один и тот-же адрес добавляется второй раз
//- временный ID может быть не найден. такое возможно если пока выполялся запрос объект был удалён

MapWithMarkerListClass.prototype.Address_merge_GeoCode = function (addr_id_tmp, addr_id_new, lat, lng) {
  var addr_id;
  var addr = this.address_list[addr_id_tmp];

  //пока выполнялся метод BackEnd, данные которого переданы данной ф-ии
  //адрес мог быть удалён. проверка на это
  if (addr) {
    //дополнить данные
    addr.lat = lat;
    addr.lng = lng;
    
    //заменить ID в модели
    //сначала проверить существует ли уже такой ID который требуется merge
    if (!this.address_list[addr_id_new]) {
      this.address_list[addr_id_new] = addr;
      delete this.address_list[addr_id_tmp];
      addr_id = addr_id_new;
    } else {
      //this.log('Warning: address addr_id_new duplicate ['+addr_id_new+'] addr_id_tmp['+addr_id_tmp+']');
      //looks like the Address to be merged is a duplicate
      //delete it from model
      delete this.address_list[addr_id_tmp];
    }
  } else {
    //this.log('Warning: address not found in this.address_list by addr_id_tmp['+addr_id_tmp+']');
  }
  return addr_id;
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
  
  var addr_id_list = this.addr_id_list = this.PageAddressList_getIdArray();
  var lst_shadow = this.addr_id_list_shadow;
  
  //this.log('addr_id_list');
  //this.log(addr_id_list);
  //this.log('lst_shadow');
  //this.log(lst_shadow);
  
  for (var i = 0; i < addr_id_list.length; i++) {
    var addr_id = addr_id_list[i];

    //this.log('i['+i+'] page addr_id['+addr_id+'] shadow addr_id['+lst_shadow[i]+']');
    if (addr_id != lst_shadow[i]) {
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
  this.addr_id_list_shadow = this.addr_id_list;
  
  if (!json) {
    //информировать приложение что ссылка недействительна
    this.LinkToShare_Set(null);
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
  
  var address_list_joined = this.PageAddressList_getIdArray().join(',');
  
  if (address_list_joined.length) {
    var query = {address: address_list_joined};
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
    var addr = this.address_list[k];
    if (!(addr.lat && addr.lng)) {
      ok = false;
      break;
    }
  }
  return ok;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

MapWithMarkerListClass.prototype.debug_addr_id_list_pair_compare = function (addr_id_list_old, addr_id_list_new) {
  this.log('debug_addr_id_list_pair_compare');
  
  //авто-определить начальный индекс
  var idx_base = addr_id_list_new[0] ? 0 : 1;
  this.log('addr_id_list_old.length['+addr_id_list_old.length+'] addr_id_list_new.length['+addr_id_list_new.length - idx_base+'] equal=['+(addr_id_list_old.length == addr_id_list_new.length - idx_base)+']');
  
  var is_diff = false;
  
  for (var i = 0; i < addr_id_list_old.length; i++) {
    var old_id = addr_id_list_old[i];
    var new_id = addr_id_list_new[i + idx_base];
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

MapWithMarkerListClass.prototype.Address_getPrevId = function (addr_id, where) {
  return this.Address_getSiblingId(addr_id, -1, where);
};

MapWithMarkerListClass.prototype.Address_getNextId = function (addr_id, where) {
  return this.Address_getSiblingId(addr_id, 1, where);
};

MapWithMarkerListClass.prototype.Address_getLastId = function (where) {
  return this.Address_getSiblingId(null, -1, where);
};

MapWithMarkerListClass.prototype.Address_getIndex = function (addr_id, where) {
  return this.Address_getSiblingId(addr_id, 0, where);
};

MapWithMarkerListClass.prototype.Address_getSiblingId = function (addr_id, offset, where) {
  //this.log('Address_getSiblingId addr_id['+addr_id+'] offset['+offset+'] where['+where+']');
  
  var addr_id_list = this.AddressList_getIdList_byWhere(where);
  var id;
  
  if (addr_id_list && addr_id_list.length) {
    if (addr_id) {
      var i = addr_id_list.indexOf(addr_id);
      id = addr_id_list[i + offset];
    } else {
      if (offset >= 0) {
        id = addr_id_list[offset];
      } else {
        id = addr_id_list[addr_id_list.length + offset];
      }
    }
  }
  return id;
};

MapWithMarkerListClass.prototype.AddressList_getIdList_byWhere = function (where) {
  where = where || 'shadow';
  return {'actual': this.addr_id_list, 'shadow': this.addr_id_list_shadow}[where];
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//вспомогательный список. добавить ID
MapWithMarkerListClass.prototype.AddressList_Append = function (addr_id, where) {
  var addr_id_list = this.AddressList_getIdList_byWhere(where);
  addr_id_list.push(addr_id);
};

//вспомогательный список. удалить ID 
MapWithMarkerListClass.prototype.AddressList_Remove = function (addr_id, where) {
  var addr_id_list = this.AddressList_getIdList_byWhere(where);
  var i = addr_id_list.indexOf(addr_id);
  addr_id_list.splice(i, 1);
};

//вспомогательный список. заменить ID
MapWithMarkerListClass.prototype.AddressList_Replace = function (addr_id_old, addr_id_new, where) {
  var addr_id_list = this.AddressList_getIdList_byWhere(where);
  var i = addr_id_list.indexOf(addr_id_old);
  addr_id_list[i] = addr_id_new;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

//сравнить текущий массив с shadow
MapWithMarkerListClass.prototype.AddressList_ActualEqualShadow = function () {
  var equal = false;
  var actual = this.AddressList_getIdList_byWhere('actual');
  var shadow = this.AddressList_getIdList_byWhere('shadow');
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

MapWithMarkerListClass.prototype.AddressList_debug_Dump = function () {
  this.log('AddressList_debug_Dump');
  //this.AddressList_debug_DumpLength('addr_id_list', this.addr_id_list);
  //this.AddressList_debug_DumpLength('addr_id_list_shadow', this.addr_id_list_shadow);

  var concat1 = '';
  var concat2 = '';
  var s;
  var len_arr = [
    this.addr_id_list ? this.addr_id_list.length : 0, 
    this.addr_id_list_shadow ? this.addr_id_list_shadow.length : 0
  ];

  for (var i = 0; i < Math.max(len_arr[0], len_arr[1]); i++) {
    var id = this.addr_id_list ? this.addr_id_list[i] : '';
    var id_shadow = this.addr_id_list_shadow ? this.addr_id_list_shadow[i] : '';
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
  this.log('addr_id_list        len['+len_arr[0]+'] ['+concat1+']');
  this.log('addr_id_list_shadow len['+len_arr[1]+'] ['+concat2+']');
};

MapWithMarkerListClass.prototype.AddressList_debug_DumpLength = function (name, list) {
  if (list) {
    this.log(''+name+'.length['+list.length+']');
  } else {
    this.log(''+name+' has no length');
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

//удалить адрес из представления на странице
//  особый случай. объект уже удалён из модели данных

MapWithMarkerListClass.prototype.PageAddress_FindByIdAndRemove = function (addr_id) {
  var elem = this.PageAddress_ElementById(addr_id);
  if (elem) {
    this.address_list_html.removeChild(elem);
  }
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
  var id_array = [];
  
  for (var i = 0; i < children.length; i++) {
    var addr_id = this.PageAddress_getId(children[i]);
    id_array[i] = addr_id;
  }
  
  return id_array;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//найти эл-т на странице по ID

MapWithMarkerListClass.prototype.PageAddress_ElementById = function (addr_id) {
  var elem;
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
//this.addr_id_list_shadow здесь не используется т.к список изменяется днамически
//и shadow станет неактуальным уже после первого изменения

//обёртка конвертирующая объект-ассоциативный массив в простой массив
//внимание: иногда BackEnd возвращает не ассоциативный а простой массив, необходима проверка на это
MapWithMarkerListClass.prototype.PageAddressList_ReorderByIdAssociativeArray = function (associative_array) {
  this.log_heading5('PageAddressList_ReorderByIdAssociativeArray');
  
  if (associative_array instanceof Object) {
    this.PageAddressList_ReorderByIdList(Object.values(associative_array));//not work in IE
    
    //var addr_id_list = [];
    //var keys = Object.keys(associative_array);
    //for (var i = 0; i < keys.length; i++) {
    //  addr_id_list.push(associative_array[keys[i]]);
    //}
    //this.PageAddressList_ReorderByIdList(addr_id_list);
  } else if (associative_array instanceof Array) {
    this.PageAddressList_ReorderByIdList(associative_array);
  } else {
    this.log('Warning: argument has an unknown type');
  }
};

MapWithMarkerListClass.prototype.PageAddressList_ReorderByIdList = function (addr_id_list) {
  this.log_heading5('PageAddressList_ReorderByIdList');
  
  //this.log('addr_id_list');
  //this.log(addr_id_list);
  
  if (addr_id_list.length) {
    //авто-определить начальный индекс
    var idx_base = addr_id_list[0] ? 0 : 1;
    //=live nodes list
    var children = this.address_list_html.childNodes;
    
    for (var i = idx_base; i < addr_id_list.length; i++) {
      var addr_id = addr_id_list[i];
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
    this.log('Warning: addr_id_list is empty');
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
  
  //if dragged is an Address, indicate this on the map
  if (dnd.dragged_node.classList.contains('address')) {
    var addr = this.PageAddress_getAddrObj(dnd.dragged_node);
    this.MapAddress_setState(addr, 'active');
    this.MapAddress_PanTo(addr);
    //animation Will restart on each Node remove\append. stop the animaiton to prevent restarts
    //animation might be in progress if the corresponding marker is clicked shortly before
    this.PageAddress_AnimationStop(addr);
  }
  
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
  
  this.Addresses_ItemMoved(dragged);

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
      //Not work :(
      //this.MapRoutingLib_AddressAppend(addr_id);
      break;
      
    case 'crafted':
      //карта. добавить маркер
      this.MapAddress_Publish(addr_id, {pan: true});
      //карта. добавить линии до предыдущего + следующего
      this.MapRoute_Publish(addr_id);
      break;
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.MapUpdate_AddressRemoveBefore = function (addr_id) {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllRemove();
      //Not work :(
      //this.MapRoutingLib_AddressRemove(addr_id);
      break;
      
    case 'crafted':
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
      break;
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.MapUpdate_AddressMoveBefore = function (addr_id) {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllRemove();
      //Not work :(
      //this.MapRoutingLib_AddressMoveBefore(addr_id);
      break;
      
    case 'crafted':
      //удалить линии маршрутов
      this.MapAddress_RouteRemove(addr_id);
      break;
  }
};

MapWithMarkerListClass.prototype.MapUpdate_AddressMoveAfter = function (addr_id) {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllPublish();
      //Not work :(
      //this.MapRoutingLib_AddressMoveAfter(addr_id);
      break;
      
    case 'crafted':
      //добавить новые линии маршрутов
      this.MapRoute_Publish(addr_id);
      break;
  }
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
      break;
  }
};

MapWithMarkerListClass.prototype.MapUpdate_AllSortAfter = function () {
  switch (this.map_options.renderer) {
    case 'routing-lib':
      this.MapRoutingLib_AllPublish();
      break;
      
    case 'crafted':
      //добавить все линии маршрутов
      this.MapRoute_AllPublish();
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
    var lat_lng = new L.LatLng(addr.lat, addr.lng); 

    //too obtrusive. zoom level lost
    //this.map_obj.setView(lat_lng, this.map_options.zoom_default);

    this.map_obj.setView(lat_lng);//retain the current zoom level
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
//вызывается из Drag-and-Drop
MapWithMarkerListClass.prototype.MapAddress_PanTo = function (addr) {
  var lat_lng = new L.LatLng(addr.lat, addr.lng);
  
  //var bounds = this.map_obj.getBounds();
  //bounds.getNorthWest();
  
  //Marker.getLatLng()

  //not works :(
  //if (this.map_obj.getBounds().contains(lat_lng)) {

  //not works :(
  //if (this.MapBoundsContains(this.map_obj.getBounds(), lat_lng)) {
    this.map_obj.setView(lat_lng);
    //this.map_obj.setView(lat_lng, this.map_options.zoom_default);//too obtrusive. zoom adjustment lost
  //}
};

MapWithMarkerListClass.prototype.MapBoundsContains = function (bounds, point) {
  var ne = bounds.getNorthEast();
  var sw = bounds.getSouthWest();
  this.log('');
  var lng = ne.lng < point.lng && point.lng < sw.lng;
  var lat = ne.lat < point.lat && point.lat < sw.lat;
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
  if (this.MapExists()) {
    this.map_obj = new L.Map(map_id);

    //NOTE: if site uses HTTPS then tileLayer must use HTTPS too, 
    //else XHR requests for tiles will be blocked by the Browser (FireFox at least)
    
    //autodetect
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
      attribution: 'Maps by <a href="http://openstreetmap.org/">OpenStreetMap</a>. ' +
        'Routes from <a href="http://project-osrm.org/">OSRM</a>, ' +
        'data uses <a href="http://opendatacommons.org/licenses/odbl/">ODbL</a> license',
      maxZoom: 18
    }).addTo(this.map_obj);
    //this.map_obj.attributionControl.setPrefix(''); // Don't show the 'Powered by Leaflet' text.

    var peterburg = new L.LatLng(59.939095,30.315868);
    var moscow = new L.LatLng(55.755814,37.617635);
    
    //без этой строки карта пустая
    this.map_obj.setView(peterburg, this.map_options.zoom_default);
    
    //no use for markers
    //this.map_obj.on('click', this.map_onClick.bind(this));
    
    this.log('-----finished ok');
  } else {
    document.getElementById(map_id).innerHTML("карта недоступна");
  }
};

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
MapWithMarkerListClass.prototype.MapExists = function () {
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
//для получения текущего порядка адресов используется this.addr_id_list
//Но this.addr_id_list_shadow Не используется
//вместо этого для линий реализован отдельный механизм 
//хранения addr.map_routes.prev\next. addr addr_id

//нарисовать все линии маршрута
MapWithMarkerListClass.prototype.MapRoute_AllPublish = function () {
  this.log_heading3('MapRoute_AllPublish');

  this.polylines_pool = [];
  
  for (var i = 0; i < this.addr_id_list.length; i++) {
    var from_id = this.addr_id_list[i];
    var to_id = this.addr_id_list[i + 1];
    if (from_id && to_id) {
      this.MapRoute_PublishFromTo(from_id, to_id);
    }
  }
  
  //this.Map_debug_Route_AllDump('After');
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
//  соседние ID ищутся по this.addr_id_list

MapWithMarkerListClass.prototype.MapRoute_Publish = function (addr_id) {
  this.log_heading4('MapRoute_Publish');
  
  //this.Map_debug_Route_AllDump('Before');

  var prev_id = this.Address_getPrevId(addr_id, 'actual');
  var next_id = this.Address_getNextId(addr_id, 'actual');
  
  //удалить линию предыдущий-следующий если она есть
  this.MapRoute_RemoveFromTo(prev_id, next_id);
  
  //добавить две линии от заданного ID до соседних
  this.MapRoute_PublishFromTo(prev_id, addr_id);
  this.MapRoute_PublishFromTo(addr_id, next_id);
  
  //this.Map_debug_Route_AllDump('After');
};

//удаление линий маршрута по одному ID. 
//нетривиально т.к. 
//+ удалить нужно две линии
//+ после удаления необходимо создать новую линию между предыдущим и следующим адресом

MapWithMarkerListClass.prototype.MapAddress_RouteRemove = function (addr_id) {
  this.log_heading4('MapAddress_RouteRemove addr_id['+addr_id+']');

  //this.Map_debug_Route_AllDump('Before');

  var addr = this.address_list[addr_id];
  var prev = addr.map_routes.prev;
  var next = addr.map_routes.next;

  //удалить две линии до предыдущего и следующего адресов
  this.MapRoute_RemoveFromToObjects(prev.addr, addr);
  this.MapRoute_RemoveFromToObjects(addr, next.addr);
  
  //создать новую линию между предыдущим и следующим адресом
  this.MapRoute_PublishFromTo(prev.addr_id, next.addr_id);
  
  //this.Map_debug_Route_AllDump('After');
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

//нарисовать линию маршрута по паре ID
MapWithMarkerListClass.prototype.MapRoute_PublishFromTo = function (from_id, to_id) {
  this.log_heading5('MapRoute_PublishFromTo. from_id['+from_id+'] to_id['+to_id+']');
  
  var from = this.address_list[from_id];
  var to = this.address_list[to_id];
  
  if (from && to && !from.incomplete && !to.incomplete) {
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
    msg += ' from.incomplete['+ (from_id ? from.incomplete : '') +'] to.incomplete['+ (to_id ? to.incomplete : '') +']';
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
  var from = this.address_list[from_id];
  var to = this.address_list[to_id];
  this.MapRoute_RemoveFromToObjects(from, to);
};
//удалить линию между парой адресов по объектам модели
MapWithMarkerListClass.prototype.MapRoute_RemoveFromToObjects = function (from, to) {
  //this.log_heading5('MapRoute_RemoveFromToObjects');
  
  if (from && to) {
    if (from.map_routes.next.line == to.map_routes.prev.line && from.map_routes.next.line && to.map_routes.prev.line) {
      this.MapLine_Remove(from.map_routes.next.line);
      from.map_routes.next = {};
      to.map_routes.prev = {};
    } else {
      this.log('warning: line from<->to not match or not exists');
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
  
  for (var i = 0; i < this.polylines_pool.length; i++) {
    //this.log('i['+i+'] polylines_pool[i].id['+this.Map_debug_Line_getId(this.polylines_pool[i])+']');
    this.polylines_pool[i].remove();
  }
  this.polylines_pool = null;
};

MapWithMarkerListClass.prototype.Map_debug_Line_getId = function (polyline) {
  return polyline ? polyline._leaflet_id : null;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//debug

//call from console
//Application.MapWithMarkerList.Map_debug_Route_AllDump()
MapWithMarkerListClass.prototype.Map_debug_Route_AllDump = function (comment) {
  this.log_heading4('Map_debug_Route_AllDump comment['+comment+']');
  var err_cnt = 0;

  err_cnt += this.Map_debug_Polylines_AllDump();
  
  //Object.keys(this.address_list);//poor option
  err_cnt += this.Map_debug_Routes_Dump_ForAddrIdList('this.addr_id_list', this.addr_id_list);

  err_cnt += this.Map_debug_Routes_Dump_ForAddrIdList('this.addr_id_list_shadow', this.addr_id_list_shadow);

  if (err_cnt) {
    this.log('--- !!! errors found :( ['+err_cnt+']');
  } else {
    this.log('no errors :)');
  }
  return err_cnt;
};

MapWithMarkerListClass.prototype.Map_debug_Polylines_AllDump = function () {
  var err_cnt = 0;
  var txt = '---\n';

  if (this.polylines_pool && this.polylines_pool.length) {
    txt += 'polylines_pool.length['+this.polylines_pool.length+']\n';
    
    var lines_collected = this.Map_debug_Routes_Collect_ForAddrIdList(this.addr_id_list);
    var lines_collected_shadow = this.Map_debug_Routes_Collect_ForAddrIdList(this.addr_id_list_shadow);
    
    for (var i = 0; i < this.polylines_pool.length; i++) {
      var line = this.polylines_pool[i];
      txt += 'i['+i+'] polylines_pool[i].id['+this.Map_debug_Line_getId(line)+']\n';
      
      if (!lines_collected.includes(line)) {
        txt += '! this line not found in [addr_id_list]\n';
        err_cnt++;
      }
      if (!lines_collected_shadow.includes(line)) {
        txt += '! this line not found in [addr_id_list_shadow]\n';
        err_cnt++;
      }
      
    }
  } else {
    txt += 'polylines_pool empty\n';
  }
  
  //if (true) {
  if (err_cnt) {
    this.log(txt);
  }

  return err_cnt;
};

MapWithMarkerListClass.prototype.Map_debug_Routes_Dump_ForAddrIdList = function (name, addr_id_list) {
  var err_cnt = 0;
  var warn_cnt = 0;
  var txt = '---['+name+']\n';

  if (addr_id_list && addr_id_list.length) {
    txt += 'list.length['+addr_id_list.length+']\n';

    for (var i = 0; i < addr_id_list.length; i++) {
      var id = addr_id_list[i];
      var addr = this.address_list[id];
      var routes = addr.map_routes;
      
      if (routes.prev.line || routes.next.line) {
        //txt += 'i['+i+'] addr_id['+id+']\n';

        //txt += 'routes.prev.line.id['+this.Map_debug_Line_getId(routes.prev.line)+'] routes.next.line.id['+this.Map_debug_Line_getId(routes.next.line)+']\n';

        var d = routes.prev;
        if (d.line && !this.polylines_pool.includes(d.line)) {
          txt += 'i['+i+'] addr_id['+id+']\n';
          txt += '! line Not in polylines_pool .prev.line.id['+this.Map_debug_Line_getId(d.line)+'] .prev.addr_id['+d.addr_id+']\n';
          err_cnt++;
        }

        var d = routes.next;
        if (d.line && !this.polylines_pool.includes(d.line)) {
          txt += 'i['+i+'] addr_id['+id+']\n';
          txt += '! line Not in polylines_pool .next.line.id['+this.Map_debug_Line_getId(d.line)+'] .next.addr_id['+d.addr_id+']\n';
          err_cnt++;
        }

      } else {
        txt += 'i['+i+'] addr_id['+id+']\n';
        txt += 'no lines\n';
        warn_cnt++;
      }
    }
  } else {
    txt += 'list empty\n';
  }
  
  //if (true) {
  if (err_cnt || warn_cnt) {
    txt += 'err_cnt['+err_cnt+'] warn_cnt['+warn_cnt+']\n';
    this.log(txt);
  }

  return err_cnt;
};

MapWithMarkerListClass.prototype.Map_debug_Routes_Collect_ForAddrIdList = function (addr_id_list) {
  if (addr_id_list && addr_id_list.length) {
    //this.log('addr_id_list.length['+addr_id_list.length+']');
    
    var lines_collected = [];

    for (var i = 0; i < addr_id_list.length; i++) {
      var id = addr_id_list[i];
      var addr = this.address_list[id];
      var routes = addr.map_routes;
      //this.log('i['+i+'] addr_id['+id+']');

      var d = routes.prev;
      if (d.line) {
        if (!lines_collected.includes(d.line)) {
          lines_collected.push(d.line);
        }
      }

      var d = routes.next;
      if (d.line) {
        if (!lines_collected.includes(d.line)) {
          lines_collected.push(d.line);
        }
      }

    }
  } else {
    //this.log('list empty');
  }
  
  return lines_collected;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Маршруты реальные - готовое решение leaflet-routing-machine
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//codename = MapRoutingLib

MapWithMarkerListClass.prototype.MapRoutingLib_AllPublish = function () {
  this.log_heading3('MapRoutingLib_AllPublish');
  
  var waypoints = [];
  
  for (var i = 0; i < this.addr_id_list.length; i++) {
    var id = this.addr_id_list[i];
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

/*
Abandoned
//dirty hack: delete routing control. currently this is the only way to see the Routes
MapWithMarkerListClass.prototype.MapRoutingLib_HackIt = function () {
  this.log_heading3('MapRoutingLib_HackIt');
  
  if (this.LeafletRoutingMachine) {
    this.LeafletRoutingMachine.remove();
  }
};
*/

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
  
  var addr_id = this.AddressList_getIdList_byWhere('actual')[i];
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
    this.map_obj.setView(new L.LatLng(addr.lat, addr.lng));//retain the current zoom level
  }
  
  return mrk;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
/*
Not works with spliceWaypoints. the easy way is to use setWaypoints for the full addr list

MapWithMarkerListClass.prototype.MapRoutingLib_AddressAppend = function (addr_id) {
  this.log_heading3('MapRoutingLib_AddressAppend');

  var addr = this.address_list[addr_id];
  var latlng = L.latLng(addr.lat, addr.lng);
  
  //this.log('addr');
  //this.log(addr);
  //this.log('latlng');
  //this.log(latlng);

  if (this.LeafletRoutingMachine) {
    this.LeafletRoutingMachine.spliceWaypoints(-1, 0, latlng);
  } else {
    this.MapRoutingLib_NeedObject([latlng]);
  }
};
*/

/*
All
Abandoned

MapWithMarkerListClass.prototype.MapRoutingLib_AddressRemove = function (addr_id) {
  this.log_heading3('MapRoutingLib_AddressRemove. addr_id['+addr_id+']');
  var i = this.MapRoutingLib_AddressGetIndex(addr_id);
  if (i >= 0) {
    this.LeafletRoutingMachine.spliceWaypoints(i, 1);
  } else {
    this.log('warning: address not found id['+addr_id+']');
  }
};

MapWithMarkerListClass.prototype.MapRoutingLib_AddressMoveBefore = function (addr_id) {
  this.log_heading3('MapRoutingLib_AddressMoveBefore. addr_id['+addr_id+']');
  this.MapRoutingLib_AddressRemove(addr_id);
};

MapWithMarkerListClass.prototype.MapRoutingLib_AddressMoveAfter = function (addr_id) {
  this.log_heading3('MapRoutingLib_AddressMoveAfter. addr_id['+addr_id+']');
  var addr = this.address_list[addr_id];
  var i = this.Address_getIndex(addr_id, 'actual');
  this.LeafletRoutingMachine.spliceWaypoints(i, 0, L.latLng(addr.lat, addr.lng));
};

MapWithMarkerListClass.prototype.MapRoutingLib_AddressGetIndex = function (addr_id) {
  //this.log_heading4('MapRoutingLib_AddressGetIndex. addr_id['+addr_id+']');
  
  var addr = this.address_list[addr_id];
  var idx = -1;
  var waypoints = this.LeafletRoutingMachine.getWaypoints();

  for (var i = 0; i < waypoints.length; i++) {
    var wp = waypoints[i];
    if (addr.lat == wp.latLng.lat && addr.lng == wp.latLng.lng) {
      idx = i;
      break;
    }
  }
  return idx;
};
*/
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype._static_properties_init = function () {
  this.log('MapWithMarkerListClass._static_properties_init');
  
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
  opts.color = 'fuchsia';
  opts.weight = 2;
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
      
        //this make a sense only for no-pause Add Add Add...
        //this.MapRoute_AllRemove();
        //this.MapRoute_AllPublish();
        
        window.clearInterval(a.timer);
      }
      if (timeout) {
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
