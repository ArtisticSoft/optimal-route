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
  
  //ключевой объект на странице. карта
  this.map_zoom_default = options.map.zoom_default;
  this.map_obj;
  this.MapCreate(options.map.id);
  
  //иконки маркерами с нарисованным номером 0..99
  this.icons_pool = {};
  this.IconsPoolCreate(this.C.Map.marker.icon.color.default);
  this.IconsPoolCreate(this.C.Map.marker.icon.color.active);

  //---ключевой объект на странице. список адресов
  this.address_list_html = document.getElementById(options.address_list_id);
  this.PageAllAddressesRemove();
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
  this.route_optimize_btn.addEventListener('click', this.route_optimize_btn_onClick.bind(this));
  //ссылка которой можно поделиться. сфомированная при последней оптимизации
  this.link_to_share = false;
  this.onLinkToShareChanged = null;//callback
  //some browsers remember the Enabled state for buttons so make sure it is Disabled
  this.address_list_changed();
  //this.LinkToShare_Set(false);//bad idea. this is an external callback and it is empty at this time
  
  /*
  ключевой массив 
  внутреннее представление адресов из списка
  отсюда данные будут отображаться одновременно на карте как маркеры и на странице
  */
  this.address_list = {};
  //Index для меток списка адресов. после добавления э-та в список будет увеличиваться
  //в будущем возможно отображение этого инекса на символы например A B C
  //может изменяться произвольно после оптимизации маршрута
  //этот механизм работает только для адресов добавленных вручную без использования BackEnd.distribution_address
  this.address_label_idx_to_assign = 1;
}

MapWithMarkerListClass.prototype = new GenericBaseClass();//inherit from
MapWithMarkerListClass.prototype.SuperClass = GenericBaseClass.prototype;

//авто-увеличивающийся ID для эл-тов списка адресов
//начальное значение большое чтобы не спутать с порядковым номером эл-та в списке
//этот механизм работает только для адресов добавленных без использования BackEnd.geocode
//т.е. только для отладки
MapWithMarkerListClass.address_id_to_assign = 1000;

//-----------------------------------------------------------------------------
//Оптимизировать маршрут
//-----------------------------------------------------------------------------

MapWithMarkerListClass.prototype.route_optimize_btn_onClick = function (e) {
  this.log('route_optimize_btn_onClick. starting BackEnd.DistributionAddress...');
  
  var addresses = this.address_list_concatenate('id');
  
  //защита от повторных кликов кнпоки Оптимизировать
  if (this.addresses_last_optimized != addresses) {
    this.log('addresses ['+addresses+']');
    
    this.LinkToShare_Set(false);//link-to-share no longer valid

    this.back_end.XHR_Start(
      this.back_end.DistributionAddress, 
      {address: addresses}, 
      this.BackendOptimizeRouteFulfilled.bind(this)
    )
    
    this.addresses_last_optimized = addresses;
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

  //пере-сортировать список адресов
  this.address_list_reorder_by_id_list(json.address);
  
  //сформировать ссылку которой можно поделиться
  this.LinkToShare_Set(this.back_end.LinkToShareFromJson(json));
};

MapWithMarkerListClass.prototype.address_list_reorder_by_id_list = function (addr_id_lst) {
  this.log('address_list_reorder_by_id_list');
  
  //внутреннее представление списка: назначить новые Label
  //+ создать массив id сортированый по возрастанию Label
  var id_sorted = [];
  var keys = Object.keys(addr_id_lst);
  var k;
  var id;
  var addr;
  for (var i = 0; i < keys.length; i++) {
    k = keys[i];
    id = addr_id_lst[k];
    addr = this.address_list[id];
    if (addr) {
      addr.label = k;//1,2,3... но в будущем может стать например A,B,C...
      id_sorted[k] = id;
    }
  }
  //скорректировать локальный счётчик Label чтобы следующий адрес добавленый вручную получил корректную Label
  this.address_label_idx_to_assign = k + 1;
  
  //this.log('---this.address_list');
  //this.log(this.address_list);
  //this.log('---id_sorted');
  //this.log(id_sorted);

  this.AddressesAllPublishTo('all', id_sorted);

};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//объединить заданное поле для всех адресов из списка в строку
//поле может = 'id'

MapWithMarkerListClass.prototype.address_list_concatenate = function (property) {
  var concatenated = '';
  var ids = Object.keys(this.address_list);
  var id;
  var v;
  
  for (var i = 0; i < ids.length; i++) {
    id = ids[i];
    if (concatenated.length) {
      concatenated += ',';
    }
    if (property == 'id') {
      v = id;
    } else {
      v = this.address_list[id][property];
    }
    concatenated += v;
  }
  return concatenated;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

//список изменился - эл-т добавлен или удалён. обновить состояние кнопки Оптимизировать
MapWithMarkerListClass.prototype.address_list_changed = function (e) {
  var disabled = !this.address_list_html.hasChildNodes();
  //some browsers remember the Enabled state for buttons so make sure it is Disabled
  this.route_optimize_btn.disabled = disabled;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//внешний интерфейс для обновления эл-тов управления например кнопки Поделиться ссылкой

MapWithMarkerListClass.prototype.LinkToShare_Set = function (link) {
  this.link_to_share = link;
  if (this.onLinkToShareChanged) {
    this.onLinkToShareChanged(link);
  }
};

//-----------------------------------------------------------------------------
//Address list - Model
//-----------------------------------------------------------------------------
/*
добавить маркер по адресу. запуск метода BackEnd.geocode
*/

MapWithMarkerListClass.prototype.AddressAddFromString = function (address) {
  this.log('AddressAddFromString. starting BackEnd.geocode...');
  
  //защита от повторных кликов кнпоки Добавить
  if (this.address_last_added != address) {
    this.log('address ['+address+']');
    this.back_end.XHR_Start(
      this.back_end.AddressGeocode, 
      {address: address}, 
      this.BackendGeocodeFulfilled.bind(this, address)
    )
    
    this.address_last_added = address;
  } else {
    this.log('ignored. input data looks the same as previous one');
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
/*
добавить маркер из структуры данных возвращённой из BackEnd
*/

MapWithMarkerListClass.prototype.BackendGeocodeFulfilled = function (address, json) {
  this.log('BackendGeocodeFulfilled');
  //this.log('address ['+address+'] json.address_md['+json.address_md+']');
  this.AddressAddFromLatLng(json.lat, json.lng, address, json.address_md);
}

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
/*
label - метка идентифицирующая маркер в UI например 1 2 3 или A B C
title - адрес или часть адреса, будет отображаться в PopUp
*/

MapWithMarkerListClass.prototype.AddressAddFromLatLng = function (lat, lng, title, addr_id, label) {
  //this.log('AddressAddFromLatLng lat lng['+lat+']['+lng+'] title['+title+']');
  
  addr_id = addr_id || 'address-list-item-' + this.C.address_id_to_assign;
  label = label || this.address_label_idx_to_assign;
  
  if (this.address_list[addr_id]) {
    throw 'address id ['+addr_id+'] already exists'
  }
  
  var addr = {
    lat: lat,
    lng: lng,
    label: label, 
    title: title,
    map_marker: null
  };
  
  this.address_list[addr_id] = addr;
  
  this.C.address_id_to_assign += 1;
  this.address_label_idx_to_assign += 1; 

  //this.log('id=['+id+']');
  //this.log(addr);
  
  this.MapAddressPublish(addr_id, true);
  this.PageAddressPublish(addr_id);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//перенумеровать адреса в том порядке как они расположены в представлении на странице

MapWithMarkerListClass.prototype.AddressesAllRenumber = function () {
  this.log('AddressesAllRenumber');
  var children = this.address_list_html.childNodes;
  
  for (var i = 0; i < children.length; i++) {
    var v = i + 1;
    var item = children[i];
    //update internal list
    this.address_list[item.id].label = v;
    //update the presentation on page
    var label = item.childNodes[0];
    label.innerHTML = this.PageLabelFormat(v);
  }
  
  //update map markers
  this.AddressesAllPublishTo('map');
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//обновить весь внутренний список адресов в указанных представлениях

MapWithMarkerListClass.prototype.AddressesAllPublishTo = function (destination, addr_id_lst) {
  this.log('AddressesAllPublishTo');
  
  var destination_map = {
    'all':   {page: true, map: true},
    'page':   {page: true},
    'map':    {map: true}
  };

  var addr_id_lst = addr_id_lst || Object.keys(this.address_list);
  
  //clear presentations
  if (destination_map[destination].page) {
    this.PageAllAddressesRemove();
  }
  if (destination_map[destination].map) {
    this.MapAllAddressesRemove();
  }

  //populate presentations
  for (var i = 0; i < addr_id_lst.length; i++) {
    var id = addr_id_lst[i];
    var addr = this.address_list[id];
    //массив начинается с индекса=0 а Label с 1 так что addr может оказаться пустым
    if (addr) {
      if (destination_map[destination].page) {
        this.PageAddressPublish(id);
      }
      if (destination_map[destination].map) {
        this.MapAddressPublish(id);
      }
    }
  }
};

//-----------------------------------------------------------------------------
//Page - Presentation
//-----------------------------------------------------------------------------
//добавить адрес в представление на странице
//marker - внутреннее представление маркера = элемент this.address_list

MapWithMarkerListClass.prototype.PageAddressPublish = function (addr_id) {
  var address = this.address_list[addr_id];
  var li = document.createElement('li');
  address.page_element = li;
  li.id = addr_id;
  li.classList.add('address');
  li.setAttribute('js_draggable', '');

  //<span>1. </span>
  var label = document.createElement('span');
  label.innerHTML = this.PageLabelFormat(address.label);
  li.appendChild(label);
  
  var txt = document.createTextNode(address.title);
  li.appendChild(txt);

  var spacer = document.createElement('span');
  spacer.classList.add('spacer-r');
  spacer.innerHTML = '&nbsp;';
  li.appendChild(spacer);
  
  var img = document.createElement('img');
  img.src = "./assets/images/hamburger-gray.svg";
  li.appendChild(img);

  this.address_list_html.appendChild(li);
  this.address_list_changed();
};

MapWithMarkerListClass.prototype.PageLabelFormat = function (label_val) {
  return label_val + '&nbsp;.&nbsp;';
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.PageAddressAnimationStart = function (addr_id) {
  var address = this.address_list[addr_id];
  myUtils.Element_animation_start(address.page_element, 'item-active-anim');
  //item_html.classList.add('item-active-anim');
};

MapWithMarkerListClass.prototype.PageAddressAnimationStop = function (addr_id) {
  var address = this.address_list[addr_id];
  address.page_element.classList.remove('item-active-anim');
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//удалить все адреса из представления на странице

MapWithMarkerListClass.prototype.PageAllAddressesRemove = function () {
  myUtils.Element_Clear(this.address_list_html);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//DnD crafted
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
    this.MapAddressMarkerSetState(dnd.dragged_node.id, 'active');
    this.MapAddressPanTo(dnd.dragged_node.id);
    //animation Will restart on each Node remove\append. stop the animaiton to prevent restarts
    //animation might be in progress if the corresponding marker is clicked shortly before
    this.PageAddressAnimationStop(dnd.dragged_node.id);
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
    this.MapAddressMarkerSetState(dnd.dragged_node.id, 'default');
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
  
  this.AddressesAllRenumber();

  dragged.classList.remove('dragged');
  dnd.dragged_node = null;
  
  //restore focus
  dnd.saved.focus.focus();
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//utils 

//this might be used by another technologies for example Touch
MapWithMarkerListClass.prototype.crafted_DnD_DraggableTest = function (target) {
  var draggable = null;
  if (target.hasAttribute('js_draggable')) {
    draggable = target;
  }
  if (target.parentNode.hasAttribute('js_draggable')) {
    draggable = target.parentNode;
  }
  return draggable;
};

/*
TODO: utils - make a fun parentNode_climb_hasAttribute
MapWithMarkerListClass.prototype.crafted_DnD_DroppableTest = function (target) {
  var droppable = null;
  if (target.hasAttribute('js_droppable')) {
    droppable = target;
  }
  if (target.parentNode.hasAttribute('js_droppable')) {
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
​​target: <li id="93c6c7590475e6ad865f3bd63e823319" js_draggable="">
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
//Maps powered by LeafLet - Presentation
//-----------------------------------------------------------------------------
/*
подключена ли библиотека карт?
*/
MapWithMarkerListClass.prototype.MapExists = function () {
  return (window.L ? true : false);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
/*
добавить маркер на карту
address - внутреннее представление маркера = элемент this.address_list
*/

MapWithMarkerListClass.prototype.MapAddressPublish = function (addr_id, map_pan, icon_color) {
  if (this.MapExists()) {
  
    var address = this.address_list[addr_id];
    icon_color = icon_color || this.C.Map.marker.icon.color.default;

    //добавить на карту маркер для адреса
    var icons_pool = this.icons_pool[icon_color];
    var m = L.marker([address.lat, address.lng], {icon: icons_pool[address.label]});//custom icon pool. Works

    address.map_marker = m;
    m.item_id = addr_id;
    m.on('click', this.map_marker_onClick.bind(this));
    
    m.bindTooltip(String(address.title), {}).openTooltip();//tooltip = address
    //m.bindPopup(address.title);
    m.addTo(this.map_obj);

    if (map_pan) {
      //прокрутить вид карты к расположению нового маркера
      var lat_lng = new L.LatLng(address.lat, address.lng); 

      //this.map_obj.setView(lat_lng, 20);//very zoomed. streets are clearly visible
      //this.map_obj.setView(lat_lng, 5);//medium zoom. nearby cities are visible
      this.map_obj.setView(lat_lng, this.map_zoom_default);
    }
  }
};

MapWithMarkerListClass.prototype.map_marker_onClick = function (e) {
  this.log('---map_marker_onClick');
  
  //this.log(e);
  
  var m = e.sourceTarget;
  if (m.item_id) {
    //this.log('m.item_id['+m.item_id+']');
    this.PageAddressAnimationStart (m.item_id);
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

MapWithMarkerListClass.prototype.MapAddressMarkerSetState = function (addr_id, state) {
  this.MapAddressIconColorReplace(addr_id, this.C.Map.marker.icon.color[state]);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//адрес -> маркер. заменить цвет иконки

MapWithMarkerListClass.prototype.MapAddressIconColorReplace = function (addr_id, icon_color) {
  if (this.MapExists()) {
    var address = this.address_list[addr_id];
    address.map_marker.setIcon(this.icons_pool[icon_color][address.label]);
  }

  //too rough
  //this.MapAddressRemove(addr_id);
  //this.MapAddressPublish(addr_id, false, icon_color);
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -

MapWithMarkerListClass.prototype.MapAddressPanTo = function (addr_id) {
  if (this.MapExists()) {
    var address = this.address_list[addr_id];
    var lat_lng = new L.LatLng(address.lat, address.lng);
    
    //var bounds = this.map_obj.getBounds();
    //bounds.getNorthWest();
    
    //Marker.getLatLng()

    //not works :(
    //if (this.map_obj.getBounds().contains(lat_lng)) {

    //not works :(
    //if (this.MapBoundsContains(this.map_obj.getBounds(), lat_lng)) {
      this.map_obj.setView(lat_lng, this.map_zoom_default);
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

MapWithMarkerListClass.prototype.MapAddressRemove = function (addr_id) {
  if (this.MapExists()) {
    var address = this.address_list[addr_id];
    address.map_marker.remove();
  }
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
//удалить все маркеры с карты

MapWithMarkerListClass.prototype.MapAllAddressesRemove = function () {
  var ids = Object.keys(this.address_list);
  for (var i = 0; i < ids.length; i++) {
    this.MapAddressRemove(ids[i]);
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

    var london = new L.LatLng(51.5056,-0.1213); 
    var moscow = new L.LatLng(55.755814,37.617635); 
    
    //без этой строки карта пустая
    this.map_obj.setView(moscow, this.map_zoom_default);
    //this.map_obj.setView(moscow, 13);
    
    //no use for markers
    //this.map_obj.on('click', this.map_onClick.bind(this));
    
    this.log('-----finished ok');
  } else {
    document.getElementById(map_id).innerHTML("карта недоступна");
  }
};

/*клик на маркере не bubbles для карты*/
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

MapWithMarkerListClass.prototype.IconsPoolCreate = function (color) {
  //this.log_enabled = true;
  
  var pool = this.icons_pool[color] = [];
  
  var icon_cls = myMapIconClass;
  var suffix;
  
  //var formatter = new Intl.NumberFormat('en-US', {style: 'decimal', minimumIntegerDigits: 2});

  for (var i = 0; i <= 99; i++) {
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

MapWithMarkerListClass.prototype._static_properties_init = function () {
  this.log('MapWithMarkerListClass._static_properties_init');
  
  //constants related to Map
  var map = this.C.Map = {};
  var marker = map.marker = {};
  var icon = marker.icon = {};
  var color = icon.color = {};
  color.default = 'blue';
  color.active = 'yellow';
  
  //constants related to suggestions HTML 
  var dnd = this.C.DragAndDrop = {};
  dnd.target_over_classes = ['drag-target-over-before', 'drag-target-over-after'];
  
};

//-----------------------------------------------------------------------------
/*
для отладки. добавить несколько маркеров
*/

MapWithMarkerListClass.prototype.test_AddSeveralMarkers = function () {
  this.PageAllAddressesRemove();

  this.AddressAddFromLatLng(51.5006728, -0.1244324, "Big Ben");
  this.AddressAddFromLatLng(51.503308, -0.119623, "London Eye");
  this.AddressAddFromLatLng(51.5077286, -0.1279688, "Nelson's Column");
  //this.AddressAddFromLatLng(51.5077286, -0.1279688, "Nelson's Column<br><a href=\"https://en.wikipedia.org/wiki/Nelson's_Column\">wp</a>");
};

MapWithMarkerListClass.prototype.test_AddSeveralMarkersB = function () {
  this.PageAllAddressesRemove();
  
  this.AddressAddFromString('микрорайон Сходня, Химки, Московская область, Россия');
  this.AddressAddFromString('Долгопрудный, Московская область, Россия');
  this.AddressAddFromString('район Чертаново Северное, Южный административный округ, Москва, Россия');
  this.AddressAddFromString('Реутов, Московская область, Россия');
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//=============================================================================
