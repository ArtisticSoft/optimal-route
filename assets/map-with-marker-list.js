'use strict';
//=============================================================================
/*
карта и список маркеров
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function MapWithMarkerListClass(options) {
  //this.C = this.constructor;
  this.C = MapWithMarkerListClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  this.back_end = options.back_end;
  
  //--- Карта. ключевой объект на странице
  this.map_zoom_default = options.map.zoom_default;
  this.map_obj;
  this.MapCreate(options.map.id);
  
  //иконки маркерами с нарисованным номером 0..99
  this.icons_pool = {};
  this.MapIconsPool_Create(this.C.Map.marker.icon.color.default);
  this.MapIconsPool_Create(this.C.Map.marker.icon.color.active);
  
  //Линии маршрутов, глобальный список. используется для удаления всех линий
  this.polylines_pool = [];

  //--- Список адресов. ключевой объект на странице
  this.address_list_html = document.getElementById(options.address_list_id);
  this.PageAllAddresses_Remove();
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
  this.onLinkToShareChanged = null;//callback

  //--- ключевой ассоциативный массив 
  //внутренняя модель адресов из списка
  //отсюда данные будут отображаться одновременно на карте как маркеры и на странице
  this.address_list = {};
  //Index для меток списка адресов. после добавления э-та в список будет увеличиваться
  //  начинается с 0
  //  отображается в текстовую метку добавлением 1
  //  напрямую, без преобразования отображается в индекс иконки маркера на карте
  //
  //  в будущем возможно отображение этого инекса на символы например A B C
  //
  //  может изменяться произвольно после оптимизации маршрута
  //
  //  этот механизм работает только для адресов добавленных вручную 
  //  без использования BackEnd.distribution_address
  this.address_label_idx_to_assign = 0;
  
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
  
}

MapWithMarkerListClass.prototype = new GenericBaseClass();//inherit from
MapWithMarkerListClass.prototype.SuperClass = GenericBaseClass.prototype;

//авто-увеличивающийся ID для эл-тов списка адресов
//начальное значение большое чтобы не спутать с порядковым номером эл-та в списке
//этот механизм работает только для адресов добавленных без использования BackEnd.geocode
//т.е. только для отладки
MapWithMarkerListClass.address_id_to_assign = 1000;

//-----------------------------------------------------------------------------
//Добавить Адрес вручную
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.AddressAddFromString = function (addr_str) {
  this.log('AddressAddFromString');
  
  //защита от повторных кликов кнпоки Добавить
  if (this.addr_str_to_add_shadow != addr_str && addr_str && addr_str.length) {
    this.log('addr_str ['+addr_str+']');
    this.back_end.XHR_Start(
      this.back_end.AddressGeocode, 
      {address: addr_str}, 
      this.BackendGeocodeFulfilled.bind(this, addr_str)
    )
    
    this.addr_str_to_add_shadow = addr_str;
  } else {
    this.log('ignored. input data looks the same as the previous one');
  }
};

//добавить адрес из структуры данных возвращённой из BackEnd
MapWithMarkerListClass.prototype.BackendGeocodeFulfilled = function (addr_str, json) {
  this.log('BackendGeocodeFulfilled');

  this.log('json');
  this.log(json);
  
  //добавить адрес в модель
  var id = this.Address_AddFromLatLng(json.lat, json.lng, addr_str, json.address_md);
  
  //добавить адрес в представления
  this.MapAddress_Publish(id, true);
  this.PageAddress_Publish(id);
  
  //если существует сохранённый последний эл-т списка то
  //добавить линию
  if (this.addr_id_list_shadow && this.addr_id_list_shadow.length) {
    var from_id = this.addr_id_list_shadow[this.addr_id_list_shadow.length - 1];
    this.MapRoute_PublishFromTo(from_id, id);
  }
  
  //добавить адрес в список ID
  this.addr_id_list.push(id);
  
  this.AddressesAll_AfterChange();
}

//-----------------------------------------------------------------------------
//Адрес - удаление вручную
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.address_delete_onClick = function (e) {
  this.log('address_delete_onClick');
  
  //получить ID из э-лта представления
  var id = this.PageAddress_IdFromEvent(e);
  
  //удалить из представления на карте. До удаления из модели
  this.MapAddress_MarkerRemove(id);
  this.MapAddress_RouteRemove(id);
  
  //удалить из представления на странице
  this.PageAddress_Remove(id);

  //удалить из модели
  delete this.address_list[id];
  
  //перенумеровать список адресов
  this.AddressesAll_LabelsRefresh();
  
  this.AddressesAll_AfterChange();//здесь будет обновлено состояние кнопки Оптимизировать
};

//-----------------------------------------------------------------------------
//Адрес в списке Перемещён вручную
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.Addresses_ItemMoved = function (element) {
  this.log('Addresses_ItemMoved');
  
  var id = this.PageAddress_getId(element);
  
  //удалить линии маршрутов
  this.MapAddress_RouteRemove(id);
  
  //перенумеровать список адресов
  this.AddressesAll_LabelsRefresh();
  
  //добавить новые линии маршрутов
  this.MapRoute_Publish(id);
  
  this.AddressesAll_AfterChange();
};

//-----------------------------------------------------------------------------
//Оптимизировать маршрут
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.route_optimize_btn_onClick = function (e) {
  this.log('route_optimize_btn_onClick');
  
  var addresses = this.PageAllAddresses_getIdArray().join(',');
  
  //защита от повторных кликов кнпоки Оптимизировать
  if (this.address_lst_to_optimize_shadow != addresses && addresses && addresses.length) {
    this.log('addresses ['+addresses+']');
    
    //информировать приложение что ссылка недействительна
    this.LinkToShare_Set(null);

    //запустить сортировку списка адресов. процесс включает в себя promise resolve
    //по завершении будет сформирована новая ссылка
    this.back_end.XHR_Start(
      this.back_end.DistributionAddress, 
      {address: addresses}, 
      this.BackendOptimizeRouteFulfilled.bind(this)
    )
    
    this.address_lst_to_optimize_shadow = addresses;
  } else {
    this.log('ignored. input data looks the same as previous one');
  }
};

/*
json sample 
{
  "address": {
    "1": "93c6c7590475e6ad865f3bd63e823319",
    "2": "de995f447bae6478753b7cd7133fffe7",
    "3": "d7436ab02856289762f4e029062f3ba7"
  },
  "md_list": "efbdfdeb023668bab6c044601346b395",
  "result": 1
}
*/
MapWithMarkerListClass.prototype.BackendOptimizeRouteFulfilled = function (json) {
  this.log('BackendOptimizeRouteFulfilled');

  this.log(json);
  //this.debug_addr_id_list_pair_compare(this.addr_id_list_shadow, json.address);
  
  //удалить все линии маршрутов
  this.MapRouteAll_Remove();
  
  //пере-сортировать список адресов
  this.PageAddressesAll_ReorderByIdAssociativeArray(json.address);
  
  //перенумеровать список адресов
  this.AddressesAll_LabelsRefresh();
  
  //добавить все линии маршрутов
  this.MapRouteAll_Publish();
  
  this.AddressesAll_AfterChange(json);
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
//Добавить Адрес в модель по координатам (+ Строка + Метка)
//
//label_idx - Индекс метки идентифицирующей маркер в UI 
//  индекс должен начинаться с "1" для совместимости с backEnd
//  это именно индекс а не сама метка 
//  сейчас индекс отображаться напрямую 1 2 3 но в будущем возможно например A B C
//
//title - адрес или часть адреса, 
//  на карте будет отображаться в ToolTip или PopUp

MapWithMarkerListClass.prototype.Address_AddFromLatLng = function (lat, lng, title, addr_id, label_idx) {
  //this.log('Address_AddFromLatLng lat lng['+lat+']['+lng+'] title['+title+']');
  
  addr_id = addr_id || 'address-list-item-' + this.C.address_id_to_assign;
  label_idx = label_idx || this.address_label_idx_to_assign;
  
  if (this.address_list[addr_id]) {
    throw 'address id ['+addr_id+'] already exists'
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
  this.address_label_idx_to_assign++;

  //this.log('id=['+id+']');
  //this.log(addr);
  
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

MapWithMarkerListClass.prototype.AddressesAll_LabelsRefresh = function () {
  this.log('AddressesAll_LabelsRefresh');
  
  var addr_id_list = this.addr_id_list = this.PageAllAddresses_getIdArray();
  var lst_shadow = this.addr_id_list_shadow;
  
  //this.log('addr_id_list');
  //this.log(addr_id_list);
  //this.log('lst_shadow');
  //this.log(lst_shadow);
  
  for (var i = 0; i < addr_id_list.length; i++) {
    var id = addr_id_list[i];

    //this.log('i['+i+'] page id['+id+'] shadow id['+lst_shadow[i]+']');
    if (id != lst_shadow[i]) {
      //this.log('id mismatch. update label...');

      //обновить Модель
      this.address_list[id].label_idx = i;
      //обновить представление на странице
      this.PageAddress_setLabel(id, i);
      //обновить представление на карте
      this.MapAddress_setLabel(id, i);
    }
  }
  //скорректировать локальный счётчик Label чтобы следующий адрес добавленый вручную получил корректную Label
  this.address_label_idx_to_assign = addr_id_list.length;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//список изменился - эл-т добавлен \ перемещён \ удалён и т.д.
//  json - этот параметр передаётся если есть готовый UID списка адресов 
//    и его не требуется формировать отдельно
//    так бывает после некоторых операций например Оптимизация 

MapWithMarkerListClass.prototype.AddressesAll_AfterChange = function (json) {
  //обновить состояние кнопки Оптимизировать
  this.route_optimize_btn.disabled = !this.address_list_html.hasChildNodes();
  
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
    this.DistributionHandStart.bind(this),
    this.C.unique_id_timeout_delay
  );
};

MapWithMarkerListClass.prototype.DistributionHandStart = function () {
  this.log('DistributionHandStart');
  
  var address_list_joined = this.PageAllAddresses_getIdArray().join(',');
  
  if (address_list_joined) {
    var query = {};
    query.address = address_list_joined;
    if (this.address_list_uid && this.address_list_uid.length) {
      query.md_list = this.address_list_uid;
    }
    
    this.back_end.XHR_Start(
      this.back_end.DistributionHand, 
      query, 
      this.DistributionHandFulfilled.bind(this)
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
MapWithMarkerListClass.prototype.DistributionHandFulfilled = function (json) {//json должен быть последним
  this.log('DistributionHandFulfilled');
  this.log(json);
  
  //сформировать ссылку которой можно поделиться
  this.LinkToShare_BuildFromJson(json);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//получить ID предыдущего\следующего адреса по данному ID
//для определения предыдущего\следующего используется 
//необязательный параметр addr_id_list
//по умолчанию = this.addr_id_list_shadow
//можно передавать this.addr_id_list

MapWithMarkerListClass.prototype.Address_getPrevId = function (addr_id, addr_id_list) {
  return this.Address_getSiblingId(addr_id, -1, addr_id_list);
};

MapWithMarkerListClass.prototype.Address_getNextId = function (addr_id, addr_id_list) {
  return this.Address_getSiblingId(addr_id, 1, addr_id_list);
};

MapWithMarkerListClass.prototype.Address_getSiblingId = function (addr_id, offset, addr_id_list) {
  //this.log('Address_getSiblingId addr_id['+addr_id+'] offset['+offset+']');
  var addr_id_list = addr_id_list || this.addr_id_list_shadow;
  var idx = addr_id_list.indexOf(addr_id);
  return addr_id_list[idx + offset];
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//label = метка сейчас 1 2 3...  в будущем может стать A B C или I II III IV...
//используется при
//  добавлении адреса в различные представления

MapWithMarkerListClass.prototype.Address_LabelIdx_toString = function (label_idx) {
  return label_idx + this.C.address_list.label.idx_base;
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
  li.dataset.dragAndDrop = 'js-draggable';
  //li.setAttribute('js-draggable', '');//old style

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
  img.dataset.dragAndDrop = 'js-exclude';
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

MapWithMarkerListClass.prototype.PageAddress_setLabel = function (addr_id, label_idx) {
  var addr = this.address_list[addr_id];
  var label_elem = addr.page_element.childNodes[0];
  label_elem.innerHTML = this.PageAddress_LabelIdx_Format(label_idx);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.PageAddress_AnimationStart = function (addr_id) {
  var addr = this.address_list[addr_id];
  myUtils.Element_animation_start(addr.page_element, 'item-active-anim');
  //item_html.classList.add('item-active-anim');
};

MapWithMarkerListClass.prototype.PageAddress_AnimationStop = function (addr_id) {
  var addr = this.address_list[addr_id];
  addr.page_element.classList.remove('item-active-anim');
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//удалить все адреса из представления на странице

MapWithMarkerListClass.prototype.PageAllAddresses_Remove = function () {
  myUtils.Element_Clear(this.address_list_html);
};

//удалить адрес из представления на странице

MapWithMarkerListClass.prototype.PageAddress_Remove = function (addr_id) {
  this.address_list_html.removeChild(this.address_list[addr_id].page_element);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//получить внутренний ID адреса по событию, 
//произошедшему в одном из дочерних эл-тов Адреса
MapWithMarkerListClass.prototype.PageAddress_IdFromEvent = function (evt) {
  return this.PageAddress_getId(this.PageAddress_ElementFromEvent(evt));
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

MapWithMarkerListClass.prototype.PageAllAddresses_getIdArray = function () {
  var children = this.address_list_html.childNodes;
  var id_array = [];
  
  for (var i = 0; i < children.length; i++) {
    var id = this.PageAddress_getId(children[i]);
    id_array[i] = id;
  }
  
  return id_array;
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
MapWithMarkerListClass.prototype.PageAddressesAll_ReorderByIdAssociativeArray = function (associative_array) {
  this.log('PageAddressesAll_ReorderByIdAssociativeArray');
  
  if (associative_array instanceof Object) {
    this.PageAddressesAll_ReorderByIdList(Object.values(associative_array));//not work in IE
    
    //var addr_id_list = [];
    //var keys = Object.keys(associative_array);
    //for (var i = 0; i < keys.length; i++) {
    //  addr_id_list.push(associative_array[keys[i]]);
    //}
    //this.PageAddressesAll_ReorderByIdList(addr_id_list);
  } else if (associative_array instanceof Array) {
    this.PageAddressesAll_ReorderByIdList(associative_array);
  } else {
    this.log('Warning: argument has an unknown type');
  }
};

MapWithMarkerListClass.prototype.PageAddressesAll_ReorderByIdList = function (addr_id_list) {
  this.log('PageAddressesAll_ReorderByIdList');
  
  //this.log('addr_id_list');
  //this.log(addr_id_list);
  
  if (addr_id_list.length) {
    //авто-определить начальный индекс
    var idx_base = addr_id_list[0] ? 0 : 1;
    //=live nodes list
    var children = this.address_list_html.childNodes;
    
    for (var i = idx_base; i < addr_id_list.length; i++) {
      var id = addr_id_list[i];
      var existing_elem = children[i - idx_base];
      //this.log('existing_elem');
      //this.log(existing_elem);
      var existing_id = this.PageAddress_getId(existing_elem);
      //this.log('i['+i+'] id['+id+'] existing_id['+existing_id +']');
      if (id != existing_id) {
        var new_elem = this.address_list[id].page_element;
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
  this.log('draggable_onMouseDown');
  if (e.button == myUtilsClass.mouse.button.main) {
    var dragged = this.crafted_DnD_DraggableTest(e.target);
    if (dragged) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();//not sure this is neceassary
      this.crafted_DnD_onDragStart(e, dragged);
    }
  }
};

MapWithMarkerListClass.prototype.crafted_DnD_onDragStart = function (e, dragged) {
  this.log('crafted_DnD_onDragStart');
  
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
    var id = this.PageAddress_getId(dnd.dragged_node);
    this.MapAddress_setState(id, 'active');
    this.MapAddress_PanTo(id);
    //animation Will restart on each Node remove\append. stop the animaiton to prevent restarts
    //animation might be in progress if the corresponding marker is clicked shortly before
    this.PageAddress_AnimationStop(id);
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
  this.log('document_onMouseMove');
  //! important to check isTrusted. this prevents infinite recursion 
  //because synthetic 'mousemove' event is created in this handler
  if (this.crafted_DnD_isDragging() && e.isTrusted) {
    e.preventDefault();
    this.crafted_DnD_onDragMove(e);
  }
};

//closest native method named 'DragOver' but it has different meaning
MapWithMarkerListClass.prototype.crafted_DnD_onDragMove = function (e) {
  //this.log('crafted_DnD_onDragMove');//!uncomment this only for debug
  
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
  this.log('document_onMouseUp');
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
  this.log('crafted_DnD_onDragEnd');
  var dnd = this.DragAndDrop;

  //e.preventDefault();//this must be done outside because this can't be done for synthetic evt
  
  //if dragged is an Address, indicate this on the map
  if (dnd.dragged_node.classList.contains('address')) {
    var id = this.PageAddress_getId(dnd.dragged_node);
    this.MapAddress_setState(id, 'default');
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
MapWithMarkerListClass.prototype.crafted_DnD_DraggableTest = function (target) {
  var draggable = null;
  if (target.dataset.dragAndDrop != 'js-exclude') {
    if (this.crafted_DnD_isElementDraggable(target)) {
      draggable = target;
    }
    if (this.crafted_DnD_isElementDraggable(target.parentNode)) {
      draggable = target.parentNode;
    }
  }
  return draggable;
};

MapWithMarkerListClass.prototype.crafted_DnD_isElementDraggable = function (elem) {
  return elem.dataset.dragAndDrop == 'js-draggable';
  //return elem.hasAttribute('js-draggable');//old style
};

/*
TODO: 
utils - make a fun parentNode_climb_hasAttribute

modern way to read the attribute
this.address_list_html.dataset.dragAndDrop - should return 'js-droppable'

MapWithMarkerListClass.prototype.crafted_DnD_DroppableTest = function (target) {
  var droppable = null;
  if (target.hasAttribute('js-droppable')) {
    droppable = target;
  }
  if (target.parentNode.hasAttribute('js-droppable')) {
    droppable = target.parentNode;
  }
  return droppable;
};
*/

//this might be used by another technologies for example Touch
MapWithMarkerListClass.prototype.crafted_DnD_isDragging = function (target) {
  return this.DragAndDrop.dragged_node !== null;
};

MapWithMarkerListClass.prototype.Dragged_setPos = function (dragged, e) {
  var pos = myUtils.xy_add(this.MouseEvent_getPos(e), this.DragAndDrop.initial_offset);
  myUtils.Element_styleTopLeft_from_xy(dragged, pos);
  //myUtils.Element_styleTopLeft_from_xy(dragged, this.MouseEvent_getPos(e));
};
MapWithMarkerListClass.prototype.MouseEvent_getPos = function (e) {
  return {x: e.pageX, y: e.pageY};//relative to document?
  //return {x: e.clientX, y: e.clientY};//relative to window
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//prevent some default behaviors
//this Not prevents text selection by mouse

MapWithMarkerListClass.prototype.draggable_onClick = function (e) {
  this.log('draggable_onClick');
  e.preventDefault();
  return false;
};
MapWithMarkerListClass.prototype.draggable_onDblClick = function (e) {
  this.log('draggable_onDblClick');
  e.preventDefault();
  return false;
};
MapWithMarkerListClass.prototype.draggable_onContextMenu = function (e) {
  this.log('draggable_onContextMenu');
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
  //this.log('crafted_DnD_Droppable_onDragOver ');
  
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
  this.log('draggable_onTouchStart');
  //this.TouchEvent_dump(e);
  
  var touches = e.changedTouches;
  if (touches.length) {
    var dragged = this.crafted_DnD_DraggableTest(e.target);
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
  this.log('document_onTouchMove');
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
  this.log('document_onTouchEnd');
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
  this.log('document_onTouchCancel');
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

//подключена ли библиотека карт?
MapWithMarkerListClass.prototype.MapExists = function () {
  return (window.L ? true : false);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//добавить маркер на карту
//address - внутреннее представление маркера = элемент this.address_list

MapWithMarkerListClass.prototype.MapAddress_Publish = function (addr_id, map_pan, icon_color) {
  if (this.MapExists()) {
  
    var addr = this.address_list[addr_id];
    icon_color = icon_color || this.C.Map.marker.icon.color.default;

    //добавить на карту маркер для адреса
    var icons_pool = this.icons_pool[icon_color];
    var m = L.marker([addr.lat, addr.lng], {icon: icons_pool[addr.label_idx]});//custom icon pool. Works

    addr.map_marker = m;
    m.item_id = addr_id;
    m.on('click', this.map_marker_onClick.bind(this));
    
    m.bindTooltip(String(addr.title), {}).openTooltip();//tooltip = address
    //m.bindPopup(addr.title);
    m.addTo(this.map_obj);

    if (map_pan) {
      //прокрутить вид карты к расположению нового маркера
      var lat_lng = new L.LatLng(addr.lat, addr.lng); 

      //too obtrusive. zoom level lost
      //this.map_obj.setView(lat_lng, this.map_zoom_default);

      this.map_obj.setView(lat_lng);//retain the current zoom level
    }
  }
};

MapWithMarkerListClass.prototype.map_marker_onClick = function (e) {
  this.log('---map_marker_onClick');
  
  //this.log(e);
  
  var m = e.sourceTarget;
  if (m.item_id) {
    //this.log('m.item_id['+m.item_id+']');
    this.PageAddress_AnimationStart (m.item_id);
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


//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//адрес -> маркер. установить состояние 'default' 'active' и т.д.

MapWithMarkerListClass.prototype.MapAddress_setState = function (addr_id, state) {
  this.MapAddress_Icon_setColor(addr_id, this.C.Map.marker.icon.color[state]);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//адрес -> маркер. заменить цвет иконки

MapWithMarkerListClass.prototype.MapAddress_Icon_setColor = function (addr_id, icon_color) {
  if (this.MapExists()) {
    var addr = this.address_list[addr_id];
    addr.map_marker.setIcon(this.icons_pool[icon_color][addr.label_idx]);
  }

  //too rough
  //this.MapAddress_MarkerRemove(addr_id);
  //this.MapAddress_Publish(addr_id, false, icon_color);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//адрес -> маркер. изменить текстовую метку
//это делается заменой иконки

MapWithMarkerListClass.prototype.MapAddress_setLabel = function (addr_id, label_idx) {
  if (this.MapExists()) {
    var addr = this.address_list[addr_id];
    addr.map_marker.setIcon(this.icons_pool[this.C.Map.marker.icon.color.default][label_idx]);
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//вызывается из Drag-and-Drop
MapWithMarkerListClass.prototype.MapAddress_PanTo = function (addr_id) {
  if (this.MapExists()) {
    var addr = this.address_list[addr_id];
    var lat_lng = new L.LatLng(addr.lat, addr.lng);
    
    //var bounds = this.map_obj.getBounds();
    //bounds.getNorthWest();
    
    //Marker.getLatLng()

    //not works :(
    //if (this.map_obj.getBounds().contains(lat_lng)) {

    //not works :(
    //if (this.MapBoundsContains(this.map_obj.getBounds(), lat_lng)) {
      this.map_obj.setView(lat_lng);
      //this.map_obj.setView(lat_lng, this.map_zoom_default);//too obtrusive. zoom adjustment lost
    //}
  }
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

MapWithMarkerListClass.prototype.MapAddress_MarkerRemove = function (addr_id) {
  if (this.MapExists()) {
    var addr = this.address_list[addr_id];
    addr.map_marker.remove();
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//удалить все маркеры с карты

MapWithMarkerListClass.prototype.MapAllAddresses_MarkerRemove = function () {
  var ids = Object.keys(this.address_list);
  for (var i = 0; i < ids.length; i++) {
    this.MapAddress_MarkerRemove(ids[i]);
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.MapCreate = function (map_id) {
  this.log('MapCreate');
  if (this.MapExists()) {
    this.map_obj = new L.Map(map_id);

    //NOTE: if site uses HTTPS then tileLayer must use HTTPS too, 
    //else XHR requests for tiles will be blocked by the Browser (FireFox at least)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(this.map_obj);
    this.map_obj.attributionControl.setPrefix(''); // Don't show the 'Powered by Leaflet' text.

    var moscow = new L.LatLng(55.755814,37.617635); 
    var peterburg = new L.LatLng(59.939095,30.315868); 
    
    //без этой строки карта пустая
    this.map_obj.setView(peterburg, this.map_zoom_default);
    
    //no use for markers
    //this.map_obj.on('click', this.map_onClick.bind(this));
    
    this.log('-----finished ok');
  } else {
    document.getElementById(map_id).innerHTML("карта недоступна");
  }
};

//клик на маркере не bubbles для карты
MapWithMarkerListClass.prototype.map_onClick = function (e) {
  this.log('---map_onClick');
  
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

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//label_idx должен напрямую соотвествовать иконке с корректным номером метки
//label_idx=0 номер=1  label_idx=1 номер=2  label_idx=2 номер=3  ...

MapWithMarkerListClass.prototype.MapIconsPool_Create = function (color) {
  //this.log_enabled = true;
  
  var pool = this.icons_pool[color] = [];
  
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

//нарисовать все линии маршрута
MapWithMarkerListClass.prototype.MapRouteAll_Publish = function () {
  this.log('MapRouteAll_Publish');
  
  this.polylines_pool = [];
  
  for (var i = 0; i < this.addr_id_list.length; i++) {
    var from_id = this.addr_id_list[i];
    var to_id = this.addr_id_list[i + 1];
    this.MapRoute_PublishFromTo(from_id, to_id);
  }
};

//нарисовать две линии маршрута по одному ID. 
//нетривиально. 
//необходимо сначала удалить линию предыдущий-следующий если она есть
//соседние ID ищутся по this.addr_id_list
MapWithMarkerListClass.prototype.MapRoute_Publish = function (addr_id) {
  this.log('MapRoute_Publish');
  var prev_id = this.Address_getPrevId(addr_id, this.addr_id_list);
  var next_id = this.Address_getNextId(addr_id, this.addr_id_list);
  
  //удалить линию предыдущий-следующий если она есть
  this.MapRoute_RemoveFromTo(prev_id, next_id);
  
  //добавить две линии от заданного ID до соседних
  this.MapRoute_PublishFromTo(prev_id, addr_id);
  this.MapRoute_PublishFromTo(addr_id, next_id);
};

//нарисовать линию маршрута по паре ID
MapWithMarkerListClass.prototype.MapRoute_PublishFromTo = function (from_id, to_id) {
  //this.log('MapRoute_PublishFromTo. from_id['+from_id+'] to_id['+to_id+']');
  this.MapRoute_PublishFromToObjects(this.address_list[from_id], this.address_list[to_id]);
};
//нарисовать линию маршрута по паре адресов - объектов модели
MapWithMarkerListClass.prototype.MapRoute_PublishFromToObjects = function (from_addr, to_addr) {
  //this.log('MapRoute_PublishFromToObjects');
  
  if (from_addr && to_addr && this.MapExists()) {
    var polyline = L.polyline(
      [[from_addr.lat, from_addr.lng], [to_addr.lat, to_addr.lng]],
      this.C.Map.route.options_default
    ).addTo(this.map_obj);
    from_addr.map_routes.next.line = polyline;
    to_addr.map_routes.prev.line = polyline;
    this.polylines_pool.push(polyline);
  }
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//удаление линий маршрута для определённого адреса
//нетривиально т.к. 
//+ удалить нужно две линии
//+ после удаления необходимо создать новую линию между предыдущим и следующим адресом

MapWithMarkerListClass.prototype.MapAddress_RouteRemove = function (addr_id) {
  this.log('MapAddress_RouteRemove');
  var addr = this.address_list[addr_id];

  //удалить две линии до предыдущего и следующего адресов
  this.MapRoute_Remove(addr.map_routes.prev.line);
  this.MapRoute_Remove(addr.map_routes.next.line);
  
  //создать новую линию между предыдущим и следующим адресом
  this.MapRoute_PublishFromTo(this.Address_getPrevId(addr_id), this.Address_getNextId(addr_id));
};

//удалить линию между парой адресов по ID
MapWithMarkerListClass.prototype.MapRoute_RemoveFromTo = function (from_id, to_id) {
  this.MapRoute_RemoveFromToObjects(this.address_list[from_id], this.address_list[to_id]);
};
//удалить линию между парой адресов по объектам модели
MapWithMarkerListClass.prototype.MapRoute_RemoveFromToObjects = function (from_addr, to_addr) {
  //this.log('MapRoute_RemoveFromToObjects');
  
  if (from_addr && to_addr && this.MapExists()) {
    if (from_addr.map_routes.next.line == to_addr.map_routes.prev.line && from_addr.map_routes.next.line && to_addr.map_routes.prev.line) {
      this.MapRoute_Remove(from_addr.map_routes.next.line);
    }
  }
};

//карта. удалить произвольную линию
MapWithMarkerListClass.prototype.MapRoute_Remove = function (polyline) {
  //this.log('MapRoute_Remove');

  if (polyline) {
    //удалить из глобального списка
    var i = this.polylines_pool.indexOf(polyline);
    this.polylines_pool.splice(i, 1);
    //удалить с карты
    polyline.remove();
  }
};

//карта. удалить все линии
MapWithMarkerListClass.prototype.MapRouteAll_Remove = function () {
  this.log('MapRouteAll_Remove');
  
  for (var i = 0; i < this.polylines_pool.length; i++) {
    this.polylines_pool[i].remove();
  }
  this.polylines_pool = null;
};

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

  var route = map.route = {};
  var opts = route.options_default = {};
  opts.color = 'red';
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

MapWithMarkerListClass.prototype.test_AddMarker = function (lat, lng, addr_str) {
  //hackish method
  this.BackendGeocodeFulfilled( addr_str, {   lat: lat,   lng: lng   } );
};

MapWithMarkerListClass.prototype.test_AddSeveralMarkers = function () {
  this.PageAllAddresses_Remove();

  var london = new L.LatLng(51.5056,-0.1213);

  this.test_AddMarker(51.5006728, -0.1244324, "Big Ben");
  this.test_AddMarker(51.503308, -0.119623, "London Eye");
  this.test_AddMarker(51.5077286, -0.1279688, "Nelson's Column");
  //this.test_AddMarker(51.5077286, -0.1279688, "Nelson's Column<br><a href=\"https://en.wikipedia.org/wiki/Nelson's_Column\">wp</a>");
  this.test_AddMarker(51.523011, -0.124183, "Russel Square");
  this.test_AddMarker(51.499048, -0.1334, "St. James's Park tube station, Circle Line, London, United Kingdom");

  this.map_obj.setView(london, 14);
  console.clear();
};

MapWithMarkerListClass.prototype.test_AddSeveralMarkersB = function () {
  this.PageAllAddresses_Remove();
  
  this.AddressAddFromString('микрорайон Сходня, Химки, Московская область, Россия');
  this.AddressAddFromString('Долгопрудный, Московская область, Россия');
  this.AddressAddFromString('район Чертаново Северное, Южный административный округ, Москва, Россия');
  this.AddressAddFromString('Реутов, Московская область, Россия');
  
  console.clear();
};

MapWithMarkerListClass.prototype.test_AddSeveralMarkersC = function () {
  this.PageAllAddresses_Remove();
  
  this.AddressAddFromString('Петергоф, Санкт-Петербург, Россия');
  this.AddressAddFromString('Сестрорецк, Санкт-Петербург, Россия');
  this.AddressAddFromString('посёлок городского типа Токсово, Всеволожский район, Ленинградская область, Россия');
  this.AddressAddFromString('Отрадное, Кировский район, Ленинградская область, Россия');
  this.AddressAddFromString('посёлок Шушары, Пушкинский район, Санкт-Петербург, Россия');

  console.clear();
};

/*
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
Кудрово
Кудрово, Заневское городское поселение, Всеволожский район, Ленинградская область, Россия

Стрельна
id="7bb5fe9d0337643260cff7ba0098d2bf"
посёлок Стрельна, Петродворцовый район, Санкт-Петербург, Россия

Всеволожский
id="b43bd9e0ba6cb664d4370b71f4c174ee"
коттеджный посёлок Всеволожский, Щегловское сельское поселение, Всеволожский район, Ленинградская область, Россия

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//test set by default

id="940050d87b35f5d5b4c9dfccc23ee42a"
Сестрорецк, Санкт-Петербург, Россия

id="c94436551cab9d529e0d2b37c65f7ca5"
посёлок Шушары, Пушкинский район, Санкт-Петербург, Россия

id="73b597d460eac6b77e8581373b9bbf8a"
Отрадное, Кировский район, Ленинградская область, Россия

id="7779ef26500d8464266252036f107b3b"
Петергоф, Санкт-Петербург, Россия

id="c7e30dfce50e3549d96de1c864ddae19"
посёлок Парголово, Санкт-Петербург, Россия

id="3d8b31c09d3c899cce1098a53d434552"
посёлок городского типа Токсово, Всеволожский район, Ленинградская область, Россия


*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//=============================================================================
